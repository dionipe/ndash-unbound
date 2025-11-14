const fs = require('fs-extra');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Default settings
const DEFAULT_SETTINGS = {
    zones: {
        autoReload: true,
        validateBeforeReload: true,
        backupEnabled: true,
        autoGeneratePTR: true
    },
    unbound: {
        version: 'Unbound',
        configPath: '/etc/unbound',
        confPath: '/etc/unbound/unbound.conf',
        localZonesPath: '/etc/unbound/local.d',
        controlSocket: '/var/run/unbound.ctl',
        logFile: '/var/log/unbound.log'
    },
    resolver: {
        enabled: true,
        forwardingEnabled: true,
        upstreamDNS: [
            { name: 'Cloudflare Primary', address: '1.1.1.1', port: 53, enabled: true },
            { name: 'Cloudflare Secondary', address: '1.0.0.1', port: 53, enabled: true },
            { name: 'Google Primary', address: '8.8.8.8', port: 53, enabled: true },
            { name: 'Google Secondary', address: '8.8.4.4', port: 53, enabled: true }
        ],
        cacheSize: {
            msg: 16,  // MB
            rrset: 32  // MB
        },
        cacheTTL: {
            min: 300,     // 5 minutes
            max: 86400    // 24 hours
        },
        performance: {
            numThreads: 2,
            prefetch: true,
            prefetchKey: true
        },
        security: {
            hideIdentity: true,
            hideVersion: true,
            dnssec: true
        },
        access: {
            allowedNetworks: [
                { network: '127.0.0.0/8', description: 'Localhost', enabled: true },
                { network: '10.0.0.0/8', description: 'Private Network 10.x', enabled: true },
                { network: '172.16.0.0/12', description: 'Private Network 172.16-31.x', enabled: true },
                { network: '192.168.0.0/16', description: 'Private Network 192.168.x', enabled: true }
            ]
        },
        logging: {
            verbosity: 1,
            logQueries: false,
            logReplies: false
        }
    },
    adblock: {
        enabled: false,
        sources: {
            stevenblack: true,
            adguard: true,
            malware: true,
            easylist: false,
            tracking: false,
            geoghegan: false
        },
        autoUpdate: true,
        updateInterval: 24, // hours
        whitelist: []
    }
};

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * Load settings from file or return defaults
 */
async function loadSettings() {
    try {
        await fs.ensureFile(SETTINGS_FILE);
        const fileContent = await fs.readFile(SETTINGS_FILE, 'utf8');
        
        if (!fileContent || fileContent.trim() === '') {
            // File is empty, save and return defaults
            await saveSettings(DEFAULT_SETTINGS);
            return DEFAULT_SETTINGS;
        }
        
        const settings = JSON.parse(fileContent);
        return deepMerge(DEFAULT_SETTINGS, settings);
    } catch (error) {
        console.warn('Failed to load settings, using defaults:', error.message);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save settings to file
 */
async function saveSettings(settings) {
    try {
        await fs.ensureDir(path.dirname(SETTINGS_FILE));
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
        console.log('✓ Settings saved successfully');
        return true;
    } catch (error) {
        console.error('✗ Failed to save settings:', error.message);
        throw error;
    }
}

/**
 * Update specific settings
 */
async function updateSettings(updates) {
    const currentSettings = await loadSettings();
    const newSettings = {
        ...currentSettings,
        zones: {
            ...currentSettings.zones,
            ...updates.zones
        },
        unbound: {
            ...currentSettings.unbound,
            ...updates.unbound
        }
    };
    await saveSettings(newSettings);
    return newSettings;
}

/**
 * Get a specific setting value
 */
async function getSetting(category, key) {
    const settings = await loadSettings();
    return settings[category] ? settings[category][key] : undefined;
}

module.exports = {
    loadSettings,
    saveSettings,
    updateSettings,
    getSetting,
    DEFAULT_SETTINGS
};
