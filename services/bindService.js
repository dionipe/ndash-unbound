const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../config');
const bindConfig = require('../utils/bindConfig');

/**
 * Bind Service - Handles all interactions with Bind DNS server
 */
class BindService {
    constructor() {
        this.zonesPath = config.bind.zonesPath;
        this.confPath = config.bind.confPath;
        this.namedConfLocal = '/etc/bind/named.conf.local';
    }

    /**
     * Initialize - Ensure directories exist
     */
    async initialize() {
        try {
            await fs.ensureDir(this.zonesPath);
            console.log(`✓ Bind zones directory ready: ${this.zonesPath}`);
            return true;
        } catch (error) {
            console.error(`✗ Failed to initialize Bind service: ${error.message}`);
            return false;
        }
    }

    /**
     * List all zones from named.conf.local
     */
    async listZones() {
        try {
            const configContent = await fs.readFile(this.namedConfLocal, 'utf8');
            const zones = [];
            
            // Parse zone blocks from named.conf.local
            const zoneRegex = /zone\s+"([^"]+)"\s+\{[^}]*file\s+"([^"]+)";[^}]*\}/g;
            let match;
            
            while ((match = zoneRegex.exec(configContent)) !== null) {
                const zoneName = match[1];
                const zoneFile = match[2];
                const fullPath = zoneFile.startsWith('/') ? zoneFile : path.join('/etc/bind', zoneFile);
                
                // Get zone file stats
                let lastModified = new Date();
                let recordCount = 0;
                
                try {
                    const stats = await fs.stat(fullPath);
                    lastModified = stats.mtime;
                    
                    // Count records in zone file
                    const zoneContent = await fs.readFile(fullPath, 'utf8');
                    const records = this.parseZoneFile(zoneContent);
                    recordCount = records.length;
                } catch (err) {
                    console.warn(`Warning: Could not read zone file ${fullPath}`);
                }
                
                zones.push({
                    id: zones.length + 1,
                    name: zoneName,
                    type: 'master',
                    file: fullPath,
                    status: 'active',
                    records: recordCount,
                    lastModified: lastModified
                });
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
            
            // Read and parse zone file
            const zoneContent = await fs.readFile(zone.file, 'utf8');
            const records = this.parseZoneFile(zoneContent);
            
            return {
                zone,
                records
            };
        } catch (error) {
            throw new Error(`Failed to get zone: ${error.message}`);
        }
    }

    /**
     * Create a new zone
     */
    async createZone(data) {
        try {
            const zoneName = data.name || data.zoneName;
            const options = {
                type: data.type || 'master',
                nameserver: data.nameserver || `ns1.${zoneName}.`,
                email: data.email || `admin.${zoneName}.`,
                ...data
            };
            
            // Remove trailing dot from zone name for file path
            const zoneFileName = zoneName.replace(/\.$/, '');
            const zoneFile = path.join(this.zonesPath, `db.${zoneFileName}`);
            
            // Check if zone already exists
            const existingZones = await this.listZones();
            if (existingZones.find(z => z.name === zoneName)) {
                throw new Error(`Zone ${zoneName} already exists`);
            }
            
            // Generate zone file content
            const zoneContent = this.generateZoneFile(zoneName, options);
            
            // Write zone file
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Created zone file: ${zoneFile}`);
            
            // Add zone to named.conf.local
            await bindConfig.addZoneToConfig(zoneName, zoneFile);
            console.log(`✓ Added zone to named.conf.local`);
            
            // Reload Bind
            await this.reloadBind();
            
            return {
                success: true,
                name: zoneName,
                file: zoneFile,
                type: options.type || 'master'
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
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Read current zone file
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Increment serial number
            zoneContent = this.incrementSerial(zoneContent);
            
            // Format and add new record
            const recordLine = this.formatRecord(record);
            
            // Add record before the closing of file
            zoneContent += `\n${recordLine}`;
            
            // Write updated zone file
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Added record to ${zoneName}`);
            
            // Check zone syntax
            await this.checkZone(zoneName, zoneFile);
            
            // Reload Bind
            await this.reloadBind();
            
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
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Read current zone file
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Increment serial number
            zoneContent = this.incrementSerial(zoneContent);
            
            // Remove the record line
            const lines = zoneContent.split('\n');
            const filteredLines = lines.filter(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith(';') || !trimmed) return true;
                
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 4) {
                    const name = parts[0];
                    const type = parts.includes('IN') ? parts[parts.indexOf('IN') + 1] : parts[3];
                    
                    if (name === recordName && type === recordType) {
                        return false; // Remove this line
                    }
                }
                return true;
            });
            
            zoneContent = filteredLines.join('\n');
            
            // Write updated zone file
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Deleted record from ${zoneName}`);
            
            // Reload Bind
            await this.reloadBind();
            
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
            const { zone } = await this.getZone(zoneName);
            const zoneFile = zone.file;
            
            // Read current zone file
            let zoneContent = await fs.readFile(zoneFile, 'utf8');
            
            // Increment serial number
            zoneContent = this.incrementSerial(zoneContent);
            
            // Find and replace the record line
            const lines = zoneContent.split('\n');
            let recordFound = false;
            
            const updatedLines = lines.map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith(';') || !trimmed) return line;
                
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 4) {
                    const name = parts[0];
                    const type = parts.includes('IN') ? parts[parts.indexOf('IN') + 1] : parts[3];
                    
                    // Match old record by name and type
                    if (name === oldRecord.name && type === oldRecord.type && !recordFound) {
                        recordFound = true;
                        // Replace with new record
                        return this.formatRecord(newRecord);
                    }
                }
                return line;
            });
            
            if (!recordFound) {
                throw new Error(`Record not found: ${oldRecord.name} ${oldRecord.type}`);
            }
            
            zoneContent = updatedLines.join('\n');
            
            // Write updated zone file
            await fs.writeFile(zoneFile, zoneContent, 'utf8');
            console.log(`✓ Updated record in ${zoneName}`);
            
            // Check zone syntax
            await this.checkZone(zoneName, zoneFile);
            
            // Reload Bind
            await this.reloadBind();
            
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
            const { zone } = await this.getZone(zoneName);
            
            // Remove from named.conf.local
            await bindConfig.removeZoneFromConfig(zoneName);
            
            // Backup zone file before deleting
            const backupFile = `${zone.file}.backup.${Date.now()}`;
            await fs.copy(zone.file, backupFile);
            console.log(`✓ Backed up zone file to ${backupFile}`);
            
            // Delete zone file
            await fs.remove(zone.file);
            console.log(`✓ Deleted zone file`);
            
            // Validate config before reload
            try {
                const { exec } = require('child_process');
                await new Promise((resolve, reject) => {
                    exec('named-checkconf', (error, stdout, stderr) => {
                        if (error) {
                            reject(new Error(`Config validation failed: ${stderr || error.message}`));
                        } else {
                            resolve();
                        }
                    });
                });
                console.log(`✓ Config validated successfully`);
            } catch (validationError) {
                // Restore backup if validation fails
                console.error(`✗ Config validation failed, attempting to restore...`);
                throw validationError;
            }
            
            // Reload Bind
            await this.reloadBind();
            
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to delete zone: ${error.message}`);
        }
    }

    /**
     * Generate zone file content
     */
    generateZoneFile(zoneName, options = {}) {
        const ttl = options.ttl || 3600;
        
        // Ensure nameserver and email end with single dot
        let ns = options.nameserver || `ns1.${zoneName}.`;
        let email = options.email || `admin.${zoneName}.`;
        
        // Remove any trailing dots, then add exactly one
        ns = ns.replace(/\.+$/, '') + '.';
        email = email.replace(/\.+$/, '') + '.';
        
        const serial = this.generateSerial();
        
        // Check if this is a reverse zone (in-addr.arpa)
        const isReverseZone = zoneName.includes('in-addr.arpa');
        
        // Extract hostname from NS record for A record
        const nsHostname = ns.slice(0, -1).split('.')[0];
        
        // For reverse zones, extract the network prefix
        let networkPrefix = '';
        let domainForPTR = options.domain || 'example.com.';
        if (isReverseZone) {
            // Extract network from zone name (e.g., "215.142.103.in-addr.arpa." -> "103.142.215")
            const parts = zoneName.replace(/\.?in-addr\.arpa\.?$/, '').split('.');
            networkPrefix = parts.reverse().join('.');
            
            // Ensure domain ends with single dot
            domainForPTR = domainForPTR.replace(/\.+$/, '') + '.';
        }
        
        let zoneContent = `; Zone file for ${zoneName}
; Generated by NDash on ${new Date().toISOString()}

$TTL ${ttl}
@       IN      SOA     ${ns} ${email} (
                        ${serial}       ; Serial
                        7200            ; Refresh
                        3600            ; Retry
                        1209600         ; Expire
                        3600 )          ; Minimum TTL

; Name servers
@       IN      NS      ${ns}
`;

        if (isReverseZone) {
            // For reverse zones, add NS glue record with proper IP
            const firstOctet = networkPrefix.split('.')[0];
            zoneContent += `${ns}   IN      A       ${networkPrefix}.${firstOctet}\n`;
            
            // Auto-generate PTR records for IPs 1-254
            zoneContent += `\n; PTR records (auto-generated)\n`;
            zoneContent += `; Format: <last-octet> IN PTR <hostname>.<domain>\n`;
            for (let i = 1; i <= 254; i++) {
                const hostname = `host${i}`;
                zoneContent += `${i}       IN      PTR     ${hostname}.${domainForPTR}\n`;
            }
        } else {
            // For forward zones, add standard A records
            zoneContent += `\n; A records
@       IN      A       127.0.0.1
${nsHostname}   IN      A       127.0.0.1
`;
        }
        
        return zoneContent;
    }

    /**
     * Parse zone file to extract records
     */
    parseZoneFile(content) {
        const records = [];
        const lines = content.split('\n');
        let id = 1;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith(';') || !trimmed || trimmed.startsWith('$')) {
                continue;
            }
            
            // Skip SOA record (multi-line)
            if (trimmed.includes('SOA')) {
                continue;
            }
            
            // Parse record line
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4 && parts.includes('IN')) {
                const inIndex = parts.indexOf('IN');
                const name = parts[0];
                const type = parts[inIndex + 1];
                const value = parts.slice(inIndex + 2).join(' ');
                
                records.push({
                    id: id++,
                    name,
                    type,
                    value,
                    ttl: !isNaN(parts[1]) ? parseInt(parts[1]) : 3600
                });
            }
        }
        
        return records;
    }

    /**
     * Format record for zone file
     */
    formatRecord(record) {
        const name = record.name.padEnd(15);
        const ttl = (record.ttl || 3600).toString().padEnd(8);
        const type = record.type.padEnd(8);
        
        if (record.type === 'MX') {
            const priority = record.priority || 10;
            return `${name} ${ttl} IN ${type} ${priority} ${record.value}`;
        } else if (record.type === 'SRV') {
            const priority = record.priority || 10;
            const weight = record.weight || 0;
            const port = record.port || 0;
            return `${name} ${ttl} IN ${type} ${priority} ${weight} ${port} ${record.value}`;
        } else {
            return `${name} ${ttl} IN ${type} ${record.value}`;
        }
    }

    /**
     * Generate serial number (YYYYMMDDNN format)
     */
    generateSerial() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}01`;
    }

    /**
     * Increment serial number in zone file
     */
    incrementSerial(zoneContent) {
        const serialRegex = /(\d{10})\s*;\s*Serial/i;
        const match = zoneContent.match(serialRegex);
        
        if (match) {
            const currentSerial = match[1];
            const newSerial = (parseInt(currentSerial) + 1).toString();
            return zoneContent.replace(serialRegex, `${newSerial}       ; Serial`);
        }
        
        return zoneContent;
    }

    /**
     * Check zone syntax
     */
    async checkZone(zoneName, zoneFile) {
        try {
            const { stdout, stderr } = await execPromise(`named-checkzone ${zoneName} ${zoneFile}`);
            console.log(`✓ Zone syntax check passed for ${zoneName}`);
            return true;
        } catch (error) {
            console.error(`✗ Zone syntax check failed: ${error.message}`);
            throw new Error(`Zone syntax error: ${error.stderr || error.message}`);
        }
    }

    /**
     * Reload Bind service
     */
    async reloadBind() {
        try {
            const { stdout, stderr } = await execPromise('rndc reload');
            console.log(`✓ Bind reloaded successfully`);
            return { success: true, message: stdout };
        } catch (error) {
            console.error(`✗ Failed to reload Bind: ${error.message}`);
            throw new Error(`Bind reload failed: ${error.stderr || error.message}`);
        }
    }

    /**
     * Get Bind status
     */
    async getBindStatus() {
        try {
            const { stdout } = await execPromise('rndc status');
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
}

module.exports = new BindService();
