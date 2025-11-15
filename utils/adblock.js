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
    // Hagezi Multi Series - Comprehensive blocklists
    hagezi_light: {
        name: 'Hagezi Multi Light',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/light.txt',
        description: 'Light protection - Basic ads, tracking, and malware blocking',
        enabled: false
    },
    hagezi_normal: {
        name: 'Hagezi Multi Normal',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/normal.txt',
        description: 'All-round protection - Ads, affiliate, tracking, phishing, malware',
        enabled: false
    },
    hagezi_pro: {
        name: 'Hagezi Multi Pro (Recommended)',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt',
        description: 'Extended protection - Comprehensive blocking with balanced approach',
        enabled: true
    },
    hagezi_pro_plus: {
        name: 'Hagezi Multi Pro++',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.plus.txt',
        description: 'Maximum protection - Aggressive blocking with some restrictions',
        enabled: false
    },
    hagezi_ultimate: {
        name: 'Hagezi Multi Ultimate',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/ultimate.txt',
        description: 'Aggressive protection - Strict blocking for maximum privacy',
        enabled: false
    },
    
    // Hagezi Specialized Blocklists
    hagezi_tif: {
        name: 'Hagezi Threat Intelligence Feeds',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/tif.txt',
        description: 'Malware, cryptojacking, scam, spam, and phishing protection',
        enabled: false
    },
    hagezi_fake: {
        name: 'Hagezi Fake/Scam',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/fake.txt',
        description: 'Block fake stores, streaming rip-offs, and scam sites',
        enabled: false
    },
    hagezi_popup: {
        name: 'Hagezi Pop-up Ads',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/popup.txt',
        description: 'Block annoying and malicious pop-up advertisements',
        enabled: false
    },
    hagezi_doh_bypass: {
        name: 'Hagezi DoH/VPN Bypass',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/doh.txt',
        description: 'Prevent DNS over HTTPS and VPN bypass attempts',
        enabled: false
    },
    hagezi_tlds: {
        name: 'Hagezi Most Abused TLDs',
        url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/tlds.txt',
        description: 'Block domains from most abused top-level domains',
        enabled: false
    },
    
    // Legacy blocklists (keeping for compatibility)
    stevenblack: {
        name: 'Steven Black Hosts',
        url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
        description: 'Unified hosts file with adware + malware',
        enabled: false
    },
    adguard: {
        name: 'AdGuard DNS Filter',
        url: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
        description: 'AdGuard DNS filter for blocking ads',
        enabled: false
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
        enabled: false
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
 * Download a blocklist from URL or copy local file
 */
async function downloadBlocklist(url, filename) {
    return new Promise(async (resolve, reject) => {
        const filepath = path.join(BLOCKLIST_DIR, filename);
        
        // Handle local files
        if (url.startsWith('file:')) {
            const localPath = url.substring(5); // Remove 'file:' prefix
            
            try {
                await fs.copy(localPath, filepath);
                console.log(`✓ Copied local file ${filename}`);
                resolve(filepath);
            } catch (error) {
                reject(new Error(`Failed to copy local file: ${error.message}`));
            }
            return;
        }
        
        // Handle remote URLs
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': 'NDash-Adblock/1.0 (https://github.com/dionipe/ndash-unbound)'
            }
        };
        const file = fs.createWriteStream(filepath);
        
        protocol.get(url, options, (response) => {
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
 * Parse simple domain list format (one domain per line)
 */
function parseDomainList(content) {
    const domains = new Set();
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments, empty lines, and invalid domains
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }
        
        // Basic domain validation
        if (/^[a-z0-9][a-z0-9\-\.]*[a-z0-9]$/i.test(trimmed)) {
            domains.add(trimmed.toLowerCase());
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
 * Parse RPZ (Response Policy Zone) format
 */
function parseRPZFormat(content) {
    const domains = new Set();
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments, empty lines, and SOA/NS records
        if (!trimmed || trimmed.startsWith(';') || trimmed.includes('SOA') || trimmed.includes('NS')) {
            continue;
        }
        
        // RPZ format: domain CNAME . or domain A 0.0.0.0
        // Extract domain from lines like: *.domain.com CNAME .
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3) {
            let domain = parts[0].toLowerCase();
            
            // Remove wildcard prefix if present
            if (domain.startsWith('*.')) {
                domain = domain.substring(2);
            }
            
            // Remove trailing dot
            if (domain.endsWith('.')) {
                domain = domain.slice(0, -1);
            }
            
            // Basic domain validation
            if (/^[a-z0-9][a-z0-9\-\.]*[a-z0-9]$/i.test(domain)) {
                domains.add(domain);
            }
        }
    }
    
    return Array.from(domains);
}

/**
 * Load whitelist from disk
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
 * Save whitelist to disk
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
    const normalized = domain.toLowerCase();
    if (!whitelist.includes(normalized)) {
        whitelist.push(normalized);
        await saveWhitelist(whitelist);
    }
    return whitelist;
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
            } else if (content.includes('CNAME') || content.includes('SOA') || source.url.includes('.rpz')) {
                domains = parseRPZFormat(content);
            } else {
                // Assume it's a simple domain list (one domain per line)
                domains = parseDomainList(content);
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
            } else if (/^komdigi(_|-)part_/.test(file) || file.startsWith('komdigi_')) {
                // Use domain list parser for komdigi
                domains = parseDomainList(content);
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
