const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../config');
const unboundUtil = require('../utils/unbound');
const settingsUtil = require('../utils/settings');
const sslCertificate = require('../utils/sslCertificate');
const { activityLogger } = require('../utils/activityLogger');

/**
 * Unbound Service - Handles all interactions with Unbound DNS server
 */
class UnboundService {
    constructor() {
        this.confPath = config.unbound.confPath;
        this.localZonesPath = config.unbound.localZonesPath;
        this.includesDir = config.unbound.includesDir;
    }

    /**
     * Initialize - Ensure directories exist
     */
    async initialize() {
        try {
            await fs.ensureDir(this.localZonesPath);
            console.log(`✓ Unbound local zones directory ready: ${this.localZonesPath}`);
            
            // Ensure main config includes the local zones directory
            await this.ensureIncludeDirective();
            
            // Ensure SSL certificates for DoT/DoH are available
            await sslCertificate.ensureCertificates();
            
            return true;
        } catch (error) {
            console.error(`✗ Failed to initialize Unbound service: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensure unbound.conf includes the local zones directory
     */
    async ensureIncludeDirective() {
        try {
            const mainConf = await fs.readFile(this.confPath, 'utf8');
            const includeDirective = `include: "${this.includesDir}/*.conf"`;
            
            if (!mainConf.includes(includeDirective)) {
                console.log(`⚠ Include directive not found, adding to ${this.confPath}`);
                const updatedConf = mainConf + `\n# NDash local zones\n${includeDirective}\n`;
                await fs.writeFile(this.confPath, updatedConf, 'utf8');
                console.log(`✓ Added include directive to unbound.conf`);
            }
        } catch (error) {
            console.warn(`Warning: Could not update unbound.conf: ${error.message}`);
        }
    }

    /**
     * List all local zones from zone config files
     */
    async listZones() {
        try {
            const zones = [];
            const files = await fs.readdir(this.localZonesPath);
            
            for (const file of files) {
                if (!file.endsWith('.conf')) continue;
                
                const filePath = path.join(this.localZonesPath, file);
                const content = await fs.readFile(filePath, 'utf8');
                
                // Parse zone configuration
                const zoneMatch = content.match(/local-zone:\s+"([^"]+)"\s+(\w+)/);
                if (zoneMatch) {
                    const zoneName = zoneMatch[1];
                    const zoneType = zoneMatch[2];
                    
                    // Count records
                    const recordMatches = content.match(/local-data:/g);
                    const recordCount = recordMatches ? recordMatches.length : 0;
                    
                    // Get file stats
                    const stats = await fs.stat(filePath);
                    
                    zones.push({
                        id: zones.length + 1,
                        name: zoneName,
                        type: zoneType,
                        file: filePath,
                        status: 'active',
                        records: recordCount,
                        lastModified: stats.mtime
                    });
                }
            }
            
            return zones;
        } catch (error) {
            console.error(`Error listing zones: ${error.message}`);
            return [];
        }
    }

    /**
     * Get zone details
     */
    async getZone(zoneName) {
        try {
            const zones = await this.listZones();
            const zone = zones.find(z => z.name === zoneName);
            
            if (!zone) {
                throw new Error(`Zone ${zoneName} not found`);
            }
            
            // Read and parse zone config file
            const zoneContent = await fs.readFile(zone.file, 'utf8');
            const records = this.parseZoneConfig(zoneContent, zoneName);
            
            return {
                zone,
                records
            };
        } catch (error) {
            throw new Error(`Failed to get zone: ${error.message}`);
        }
    }

    /**
     * Create a new local zone
     */
    async createZone(data) {
        try {
            // Get and clean zone name
            let zoneName = (data.name || data.zoneName || '').trim();
            
            // Validate zone name
            if (!zoneName) {
                throw new Error('Zone name is required');
            }
            
            // Remove any extra spaces
            zoneName = zoneName.replace(/\s+/g, '');
            
            // Load settings
            const settings = await settingsUtil.loadSettings();
            
            const options = {
                type: data.type || 'static',
                ...data
            };
            
            // Generate config file name
            const zoneFileName = zoneName.replace(/\.$/, '');
            const zoneFile = path.join(this.localZonesPath, `${zoneFileName}.conf`);
            
            // Check if zone already exists
            const existingZones = await this.listZones();
            if (existingZones.find(z => z.name === zoneName)) {
                throw new Error(`Zone ${zoneName} already exists`);
            }
            
            // Generate initial zone configuration with basic records
            const initialRecords = [
                { name: '@', type: 'A', value: data.defaultIP || '127.0.0.1', ttl: 3600 },
                { name: 'ns1', type: 'A', value: data.nameserverIP || '127.0.0.1', ttl: 3600 }
            ];
            
            const zoneContent = unboundUtil.generateLocalZoneConfig(
                { name: zoneName, type: options.type },
                initialRecords
            );
            
            // Backup if enabled
            if (settings.zones.backupEnabled) {
                const backupDir = path.join(this.localZonesPath, 'backups');
                await fs.ensureDir(backupDir);
                console.log(`✓ Backup enabled - directory ready: ${backupDir}`);
            }
            
            // Write zone config file
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Created zone config file: ${zoneFile}`);
            
            // Validate configuration if enabled
            if (settings.zones.validateBeforeReload) {
                await this.checkConfig();
                console.log(`✓ Configuration validation passed`);
            }
            
            // Reload Unbound if auto-reload is enabled
            if (settings.zones.autoReload) {
                await this.reloadUnbound();
                console.log(`✓ Auto-reload enabled - Unbound reloaded`);
            } else {
                console.log(`⚠ Auto-reload disabled - Manual reload required`);
            }
            
            // Log activity
            await activityLogger.zoneCreated(zoneName, {
                type: options.type,
                zoneFile: zoneFile
            });
            
            return {
                success: true,
                name: zoneName,
                file: zoneFile,
                type: options.type
            };
        } catch (error) {
            throw new Error(`Failed to create zone: ${error.message}`);
        }
    }

    /**
     * Add record to zone
     */
    async addRecord(zoneName, record) {
        try {
            // Load settings
            const settings = await settingsUtil.loadSettings();
            
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Backup if enabled
            if (settings.zones.backupEnabled) {
                const backupFile = `${zoneFile}.backup.${Date.now()}`;
                await fs.copy(zoneFile, backupFile);
                console.log(`✓ Backup created: ${backupFile}`);
            }
            
            // Read current zone config
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Format and add new record
            const recordLine = this.formatRecord(zoneName, record);
            
            // Add record before the end of the file
            zoneContent = zoneContent.trimEnd() + `\n${recordLine}\n`;
            
            // Write updated zone config
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Added record to ${zoneName}`);
            
            // Check config syntax if validation is enabled
            if (settings.zones.validateBeforeReload) {
                await this.checkConfig();
                console.log(`✓ Configuration validation passed`);
            }
            
            // Reload Unbound if auto-reload is enabled
            if (settings.zones.autoReload) {
                await this.reloadUnbound();
                console.log(`✓ Auto-reload enabled - Unbound reloaded`);
            }
            
            // Log activity
            await activityLogger.recordCreated(zoneName, record.name, record.type, {
                value: record.value,
                ttl: record.ttl
            });
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to add record: ${error.message}`);
        }
    }

    /**
     * Delete record from zone
     */
    async deleteRecord(zoneName, recordName, recordType) {
        try {
            // Load settings
            const settings = await settingsUtil.loadSettings();
            
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Backup if enabled
            if (settings.zones.backupEnabled) {
                const backupFile = `${zoneFile}.backup.${Date.now()}`;
                await fs.copy(zoneFile, backupFile);
                console.log(`✓ Backup created: ${backupFile}`);
            }
            
            // Read current zone config
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Remove the record line
            const lines = zoneContent.split('\n');
            const filteredLines = lines.filter(line => {
                const trimmed = line.trim();
                
                // Match local-data line
                const match = trimmed.match(/local-data:\s+"([^"]+)\.?\s+\d*\s*IN\s+(\w+)\s+(.+)"/);
                if (match) {
                    const [, fqdn, type] = match;
                    const name = fqdn.replace(`.${zoneName}`, '').replace(zoneName, '@');
                    
                    if ((name === recordName || fqdn === recordName) && type === recordType) {
                        return false; // Remove this line
                    }
                }
                return true;
            });
            
            zoneContent = filteredLines.join('\n');
            
            // Write updated zone config
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Deleted record from ${zoneName}`);
            
            // Reload Unbound if auto-reload is enabled
            if (settings.zones.autoReload) {
                await this.reloadUnbound();
                console.log(`✓ Auto-reload enabled - Unbound reloaded`);
            }
            
            // Log activity
            await activityLogger.recordDeleted(zoneName, recordName, recordType);
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to delete record: ${error.message}`);
        }
    }

    /**
     * Update/Edit record in zone
     */
    async updateRecord(zoneName, oldRecord, newRecord) {
        try {
            // Load settings
            const settings = await settingsUtil.loadSettings();
            
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Backup if enabled
            if (settings.zones.backupEnabled) {
                const backupFile = `${zoneFile}.backup.${Date.now()}`;
                await fs.copy(zoneFile, backupFile);
                console.log(`✓ Backup created: ${backupFile}`);
            }
            
            // Read current zone config
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Find and replace the record line
            const lines = zoneContent.split('\n');
            let recordFound = false;
            
            const updatedLines = lines.map(line => {
                const trimmed = line.trim();
                
                const match = trimmed.match(/local-data:\s+"([^"]+)\.?\s+\d*\s*IN\s+(\w+)\s+(.+)"/);
                if (match && !recordFound) {
                    const [, fqdn, type] = match;
                    const name = fqdn.replace(`.${zoneName}`, '').replace(zoneName, '@');
                    
                    // Match old record by name and type
                    if ((name === oldRecord.name || fqdn === oldRecord.name) && type === oldRecord.type) {
                        recordFound = true;
                        // Replace with new record
                        return this.formatRecord(zoneName, newRecord);
                    }
                }
                return line;
            });
            
            if (!recordFound) {
                throw new Error(`Record not found: ${oldRecord.name} ${oldRecord.type}`);
            }
            
            zoneContent = updatedLines.join('\n');
            
            // Write updated zone config
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Updated record in ${zoneName}`);
            
            // Check config syntax if validation is enabled
            if (settings.zones.validateBeforeReload) {
                await this.checkConfig();
                console.log(`✓ Configuration validation passed`);
            }
            
            // Reload Unbound if auto-reload is enabled
            if (settings.zones.autoReload) {
                await this.reloadUnbound();
                console.log(`✓ Auto-reload enabled - Unbound reloaded`);
            }
            
            // Log activity
            await activityLogger.recordUpdated(zoneName, newRecord.name, newRecord.type, {
                oldValue: oldRecord.value,
                newValue: newRecord.value,
                ttl: newRecord.ttl
            });
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to update record: ${error.message}`);
        }
    }

    /**
     * Delete zone
     */
    async deleteZone(zoneName) {
        try {
            // Load settings
            const settings = await settingsUtil.loadSettings();
            
            const { zone } = await this.getZone(zoneName);
            
            // Backup zone config before deleting (always backup on delete)
            const backupFile = `${zone.file}.backup.${Date.now()}`;
            await fs.copy(zone.file, backupFile);
            console.log(`✓ Backed up zone config to ${backupFile}`);
            
            // Delete zone config file
            await fs.remove(zone.file);
            console.log(`✓ Deleted zone config file`);
            
            // Validate config before reload if enabled
            if (settings.zones.validateBeforeReload) {
                try {
                    await this.checkConfig();
                    console.log(`✓ Config validated successfully`);
                } catch (validationError) {
                    // Restore backup if validation fails
                    console.error(`✗ Config validation failed, restoring backup...`);
                    await fs.copy(backupFile, zone.file);
                    throw validationError;
                }
            }
            
            // Reload Unbound if auto-reload is enabled
            if (settings.zones.autoReload) {
                await this.reloadUnbound();
                console.log(`✓ Auto-reload enabled - Unbound reloaded`);
            }
            
            // Log activity
            await activityLogger.zoneDeleted(zoneName, {
                backupFile: backupFile
            });
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to delete zone: ${error.message}`);
        }
    }

    /**
     * Parse zone configuration to extract records
     */
    parseZoneConfig(content, zoneName) {
        const records = [];
        const lines = content.split('\n');
        let id = 1;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || !trimmed) {
                continue;
            }
            
            // Parse local-data directive
            const match = trimmed.match(/local-data:\s+"([^"]+)\.?\s+(\d+)?\s*IN\s+(\w+)\s+(.+)"/);
            if (match) {
                const [, fqdn, ttl, type, value] = match;
                
                // Extract record name relative to zone
                let name = fqdn;
                if (fqdn === zoneName || fqdn === `${zoneName}.`) {
                    name = '@';
                } else if (fqdn.endsWith(`.${zoneName}`)) {
                    name = fqdn.replace(`.${zoneName}`, '');
                } else if (fqdn.endsWith(`.${zoneName}.`)) {
                    name = fqdn.replace(`.${zoneName}.`, '');
                }
                
                let recordValue = value.trim();
                let priority = null;
                let weight = null;
                let port = null;
                
                // Parse MX priority
                if (type === 'MX') {
                    const parts = recordValue.split(/\s+/);
                    priority = parseInt(parts[0]);
                    recordValue = parts.slice(1).join(' ');
                }
                
                // Parse SRV fields
                if (type === 'SRV') {
                    const parts = recordValue.split(/\s+/);
                    priority = parseInt(parts[0]);
                    weight = parseInt(parts[1]);
                    port = parseInt(parts[2]);
                    recordValue = parts.slice(3).join(' ');
                }
                
                // Remove quotes from TXT records
                if (type === 'TXT') {
                    recordValue = recordValue.replace(/^"(.*)"$/, '$1');
                }
                
                const record = {
                    id: id++,
                    name,
                    type,
                    value: recordValue,
                    ttl: ttl ? parseInt(ttl) : 3600
                };
                
                if (priority !== null) record.priority = priority;
                if (weight !== null) record.weight = weight;
                if (port !== null) record.port = port;
                
                records.push(record);
            }
        }
        
        return records;
    }

    /**
     * Format record for Unbound local-data directive
     */
    formatRecord(zoneName, record) {
        const fqdn = record.name === '@' || record.name === zoneName 
            ? zoneName 
            : record.name.endsWith('.') 
                ? record.name 
                : `${record.name}.${zoneName}`;
        
        const ttl = record.ttl || 3600;
        
        if (record.type === 'MX') {
            const priority = record.priority || 10;
            return `    local-data: "${fqdn}. ${ttl} IN ${record.type} ${priority} ${record.value}"`;
        } else if (record.type === 'SRV') {
            const priority = record.priority || 10;
            const weight = record.weight || 0;
            const port = record.port || 0;
            return `    local-data: "${fqdn}. ${ttl} IN ${record.type} ${priority} ${weight} ${port} ${record.value}"`;
        } else if (record.type === 'TXT') {
            // Ensure TXT value is quoted
            const value = record.value.includes('"') ? record.value : `"${record.value}"`;
            return `    local-data: "${fqdn}. ${ttl} IN ${record.type} ${value}"`;
        } else {
            return `    local-data: "${fqdn}. ${ttl} IN ${record.type} ${record.value}"`;
        }
    }

    /**
     * Check Unbound configuration syntax
     */
    async checkConfig() {
        try {
            const { stdout, stderr } = await execPromise('unbound-checkconf');
            console.log(`✓ Configuration check passed`);
            return true;
        } catch (error) {
            console.error(`✗ Configuration check failed: ${error.message}`);
            throw new Error(`Config syntax error: ${error.stderr || error.message}`);
        }
    }

    /**
     * Reload Unbound service
     */
    async reloadUnbound() {
        try {
            const { stdout, stderr } = await execPromise('unbound-control reload');
            console.log(`✓ Unbound reloaded successfully`);
            
            // Log activity
            await activityLogger.unboundReloaded();
            
            return { success: true, message: stdout };
        } catch (error) {
            console.error(`✗ Failed to reload Unbound: ${error.message}`);
            throw new Error(`Unbound reload failed: ${error.stderr || error.message}`);
        }
    }

    /**
     * Get Unbound status
     */
    async getUnboundStatus() {
        try {
            const { stdout } = await execPromise('unbound-control status');
            return {
                success: true,
                status: 'running',
                details: stdout
            };
        } catch (error) {
            return {
                success: false,
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Flush zone cache
     */
    async flushZone(zoneName) {
        try {
            await unboundUtil.flushZone(zoneName);
            console.log(`✓ Flushed cache for zone ${zoneName}`);
            
            // Log activity
            await activityLogger.log('cache', 'flush_zone', {
                zone: zoneName
            });
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to flush zone cache: ${error.message}`);
        }
    }

    /**
     * Get Unbound statistics
     */
    async getStatistics() {
        try {
            const stats = await unboundUtil.getStatistics();
            return {
                success: true,
                data: stats
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get SSL certificate information
     */
    async getSSLCertificateInfo() {
        try {
            const certInfo = await sslCertificate.getCertificateInfo();
            return {
                success: true,
                data: certInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Regenerate SSL certificates
     */
    async regenerateSSLCertificates() {
        try {
            await sslCertificate.generateCertificate();
            return {
                success: true,
                message: 'SSL certificates regenerated successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new UnboundService();
