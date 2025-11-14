const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const ADBLOCK_CONFIG_FILE = '/etc/unbound/unbound.conf.d/ndash-adblock.conf';
const BLOCKLIST_DIR = path.join(__dirname, '../data/blocklists');
const WHITELIST_FILE = path.join(__dirname, '../data/adblock-whitelist.json');

// Popular blocklist sources
const BLOCKLIST_SOURCES = {
    stevenblack: {
        name: 'Steven Black Hosts',
        url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
        description: 'Unified hosts file with adware + malware',
        enabled: true
    },
    adguard: {
        name: 'AdGuard DNS Filter',
        url: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
        description: 'AdGuard DNS filter for blocking ads',
        enabled: true
    },
    easylist: {
        name: 'EasyList',
        url: 'https://easylist.to/easylist/easylist.txt',
        description: 'Primary filter list for blocking ads',
        enabled: false
    },
    malware: {
        name: 'Malware Domain List',
        url: 'https://www.malwaredomainlist.com/hostslist/hosts.txt',
        description: 'Block known malware domains',
        enabled: true
    },
    tracking: {
        name: 'EasyPrivacy',
        url: 'https://easylist.to/easylist/easyprivacy.txt',
        description: 'Block tracking and analytics',
        enabled: false
    },
    geoghegan: {
        name: 'Geoghegan StopForumSpam',
        url: 'https://www.stopforumspam.com/downloads/toxic_domains_whole.txt',
        description: 'Block toxic domains from StopForumSpam',
        enabled: false
    }
};

/**
 * Initialize adblock directories and files
 */
async function initialize() {
    try {
        await fs.ensureDir(BLOCKLIST_DIR);
        
        if (!await fs.pathExists(WHITELIST_FILE)) {
            await fs.writeJson(WHITELIST_FILE, { domains: [] }, { spaces: 2 });
        }
        
        console.log('✓ Adblock initialized');
        return true;
    } catch (error) {
        console.error('Error initializing adblock:', error);
        return false;
    }
}

/**
 * Download a blocklist from URL
 */
async function downloadBlocklist(url, filename) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const filepath = path.join(BLOCKLIST_DIR, filename);
        const file = fs.createWriteStream(filepath);
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✓ Downloaded ${filename}`);
                resolve(filepath);
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

/**
 * Parse hosts file format to extract domains
 */
function parseHostsFile(content) {
    const domains = new Set();
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }
        
        // Parse hosts file format: 0.0.0.0 domain.com or 127.0.0.1 domain.com
        const match = trimmed.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9][a-z0-9\-\.]*[a-z0-9])$/i);
        if (match) {
            const domain = match[1].toLowerCase();
            if (domain && domain !== 'localhost' && !domain.startsWith('localhost.')) {
                domains.add(domain);
            }
        }
    }
    
    return Array.from(domains);
}

/**
 * Parse AdBlock Plus format
 */
function parseAdBlockFormat(content) {
    const domains = new Set();
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments, metadata, and empty lines
        if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
            continue;
        }
        
        // Extract domain from various adblock formats
        // ||domain.com^ format
        const domainMatch = trimmed.match(/^\|\|([a-z0-9][a-z0-9\-\.]*[a-z0-9])\^?/i);
        if (domainMatch) {
            domains.add(domainMatch[1].toLowerCase());
            continue;
        }
        
        // Simple domain format
        if (/^[a-z0-9][a-z0-9\-\.]*[a-z0-9]$/i.test(trimmed)) {
            domains.add(trimmed.toLowerCase());
        }
    }
    
    return Array.from(domains);
}

/**
 * Update blocklists from sources
 */
async function updateBlocklists(sources = null) {
    await initialize();
    
    // Load current settings to get enabled sources
    const settingsUtil = require('./settings');
    const settings = await settingsUtil.loadSettings();
    
    const sourcesToUpdate = sources || Object.keys(BLOCKLIST_SOURCES).filter(
        key => settings.adblock && settings.adblock.sources && settings.adblock.sources[key]
    );
    
    const results = {
        success: [],
        failed: [],
        totalDomains: 0
    };
    
    for (const sourceKey of sourcesToUpdate) {
        const source = BLOCKLIST_SOURCES[sourceKey];
        if (!source) continue;
        
        try {
            console.log(`Downloading ${source.name}...`);
            const filename = `${sourceKey}.txt`;
            const filepath = await downloadBlocklist(source.url, filename);
            
            // Parse the downloaded file
            const content = await fs.readFile(filepath, 'utf8');
            let domains;
            
            // Detect format and parse accordingly
            if (content.includes('0.0.0.0') || content.includes('127.0.0.1')) {
                domains = parseHostsFile(content);
            } else {
                domains = parseAdBlockFormat(content);
            }
            
            results.success.push({
                source: sourceKey,
                name: source.name,
                domains: domains.length
            });
            
            results.totalDomains += domains.length;
            
        } catch (error) {
            console.error(`Failed to update ${source.name}:`, error.message);
            results.failed.push({
                source: sourceKey,
                name: source.name,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Load whitelist
 */
async function loadWhitelist() {
    try {
        const data = await fs.readJson(WHITELIST_FILE);
        return data.domains || [];
    } catch (error) {
        return [];
    }
}

/**
 * Save whitelist
 */
async function saveWhitelist(domains) {
    try {
        await fs.writeJson(WHITELIST_FILE, { domains }, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Error saving whitelist:', error);
        return false;
    }
}

/**
 * Add domain to whitelist
 */
async function addToWhitelist(domain) {
    const whitelist = await loadWhitelist();
    if (!whitelist.includes(domain)) {
        whitelist.push(domain.toLowerCase());
        await saveWhitelist(whitelist);
    }
    return whitelist;
}

/**
 * Remove domain from whitelist
 */
async function removeFromWhitelist(domain) {
    let whitelist = await loadWhitelist();
    whitelist = whitelist.filter(d => d !== domain.toLowerCase());
    await saveWhitelist(whitelist);
    return whitelist;
}

/**
 * Generate Unbound adblock configuration
 */
async function generateAdblockConfig(enabled = true) {
    if (!enabled) {
        return null;
    }
    
    await initialize();
    
    // Load all blocklists
    const allDomains = new Set();
    const files = await fs.readdir(BLOCKLIST_DIR);
    
    for (const file of files) {
        if (!file.endsWith('.txt')) continue;
        
        try {
            const filepath = path.join(BLOCKLIST_DIR, file);
            const content = await fs.readFile(filepath, 'utf8');
            
            let domains;
            if (content.includes('0.0.0.0') || content.includes('127.0.0.1')) {
                domains = parseHostsFile(content);
            } else {
                domains = parseAdBlockFormat(content);
            }
            
            domains.forEach(d => allDomains.add(d));
        } catch (error) {
            console.error(`Error processing ${file}:`, error.message);
        }
    }
    
    // Remove whitelisted domains
    const whitelist = await loadWhitelist();
    whitelist.forEach(d => allDomains.delete(d));
    
    // Generate Unbound config
    let config = `# NDash Adblock Configuration
# Generated automatically by NDash
# Total blocked domains: ${allDomains.size}
# Last updated: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - Changes will be overwritten

server:
`;

    // Add local-zone entries to block domains
    for (const domain of allDomains) {
        config += `    local-zone: "${domain}" always_nxdomain\n`;
    }
    
    return { config, totalDomains: allDomains.size };
}

/**
 * Apply adblock configuration
 */
async function applyAdblockConfig(enabled = true) {
    try {
        if (!enabled) {
            // Remove config file if exists
            if (await fs.pathExists(ADBLOCK_CONFIG_FILE)) {
                await fs.remove(ADBLOCK_CONFIG_FILE);
                console.log('✓ Adblock configuration removed');
            }
            
            // Reload Unbound
            await execAsync('sudo unbound-control reload');
            
            return { 
                success: true, 
                message: 'Adblock disabled',
                domains: 0
            };
        }
        
        // Generate config
        const result = await generateAdblockConfig(true);
        
        if (!result) {
            throw new Error('Failed to generate adblock configuration');
        }
        
        // Ensure directory exists
        await fs.ensureDir(path.dirname(ADBLOCK_CONFIG_FILE));
        
        // Write config file
        await fs.writeFile(ADBLOCK_CONFIG_FILE, result.config, 'utf8');
        console.log('✓ Adblock configuration written');
        console.log(`  Blocking ${result.totalDomains} domains`);
        
        // Verify configuration
        try {
            await execAsync('sudo unbound-checkconf');
            console.log('✓ Configuration validated');
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
        
        // Reload Unbound
        try {
            await execAsync('sudo unbound-control reload');
            console.log('✓ Unbound reloaded');
        } catch (error) {
            console.warn('Warning: Could not reload Unbound:', error.message);
        }
        
        return { 
            success: true, 
            message: 'Adblock configuration applied successfully',
            domains: result.totalDomains
        };
        
    } catch (error) {
        console.error('✗ Failed to apply adblock configuration:', error.message);
        throw error;
    }
}

/**
 * Get adblock statistics
 */
async function getAdblockStats() {
    try {
        const enabled = await fs.pathExists(ADBLOCK_CONFIG_FILE);
        
        if (!enabled) {
            return {
                enabled: false,
                blockedDomains: 0,
                whitelistedDomains: 0
            };
        }
        
        // Count blocked domains from config
        const content = await fs.readFile(ADBLOCK_CONFIG_FILE, 'utf8');
        const lines = content.split('\n');
        const blockedCount = lines.filter(line => line.includes('local-zone:')).length;
        
        // Get whitelist count
        const whitelist = await loadWhitelist();
        
        return {
            enabled: true,
            blockedDomains: blockedCount,
            whitelistedDomains: whitelist.length,
            lastUpdated: (await fs.stat(ADBLOCK_CONFIG_FILE)).mtime
        };
    } catch (error) {
        console.error('Error getting adblock stats:', error);
        return {
            enabled: false,
            blockedDomains: 0,
            whitelistedDomains: 0,
            error: error.message
        };
    }
}

module.exports = {
    BLOCKLIST_SOURCES,
    initialize,
    updateBlocklists,
    loadWhitelist,
    saveWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    generateAdblockConfig,
    applyAdblockConfig,
    getAdblockStats
};
