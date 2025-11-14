const express = require('express');
const router = express.Router();
const adblock = require('../utils/adblock');
const { loadSettings, saveSettings } = require('../utils/settings');
const { logActivity } = require('../utils/activityLogger');

// GET /adblock - Main adblock page
router.get('/', async (req, res) => {
    try {
        const settings = await loadSettings();
        const stats = await adblock.getAdblockStats();
        const whitelist = await adblock.loadWhitelist();
        
        // Ensure adblock settings have defaults
        const adblockSettings = settings.adblock || {
            enabled: false,
            sources: {},
            autoUpdate: true,
            updateInterval: 24,
            whitelist: []
        };
        
        res.render('adblock/index', {
            title: 'DNS Adblock - NDash',
            settings: adblockSettings,
            stats,
            whitelist,
            sources: adblock.BLOCKLIST_SOURCES
        });
    } catch (error) {
        console.error('Error loading adblock page:', error);
        res.render('error', {
            title: 'Error',
            message: 'Failed to load adblock settings',
            error: error
        });
    }
});

// POST /adblock/toggle - Enable/disable adblock
router.post('/toggle', async (req, res) => {
    try {
        const settings = await loadSettings();
        const enabled = req.body.enabled === 'true';
        
        settings.adblock = settings.adblock || {};
        settings.adblock.enabled = enabled;
        
        await saveSettings(settings);
        
        // Apply configuration
        const result = await adblock.applyAdblockConfig(enabled);
        
        await logActivity(
            enabled ? 'Adblock Enabled' : 'Adblock Disabled',
            `DNS Adblock ${enabled ? 'enabled' : 'disabled'}${result.domains ? ` (${result.domains} domains)` : ''}`,
            'admin'
        );
        
        res.json({
            success: true,
            message: result.message,
            domains: result.domains
        });
    } catch (error) {
        console.error('Error toggling adblock:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /adblock/update - Update blocklists
router.post('/update', async (req, res) => {
    try {
        const settings = await loadSettings();
        const sourcesToUpdate = req.body.sources ? req.body.sources.split(',') : null;
        
        // Update blocklists
        const result = await adblock.updateBlocklists(sourcesToUpdate);
        
        // Reapply configuration if enabled
        if (settings.adblock && settings.adblock.enabled) {
            await adblock.applyAdblockConfig(true);
        }
        
        await logActivity(
            'Blocklist Updated',
            `Updated ${result.success.length} blocklists (${result.totalDomains} domains)`,
            'admin'
        );
        
        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Error updating blocklists:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /adblock/whitelist/add - Add domain to whitelist
router.post('/whitelist/add', async (req, res) => {
    try {
        const domain = req.body.domain;
        
        if (!domain) {
            return res.status(400).json({
                success: false,
                error: 'Domain is required'
            });
        }
        
        const whitelist = await adblock.addToWhitelist(domain);
        
        // Reapply configuration if adblock is enabled
        const settings = await loadSettings();
        if (settings.adblock && settings.adblock.enabled) {
            await adblock.applyAdblockConfig(true);
        }
        
        await logActivity(
            'Whitelist Updated',
            `Added ${domain} to whitelist`,
            'admin'
        );
        
        res.json({
            success: true,
            whitelist
        });
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /adblock/whitelist/remove - Remove domain from whitelist
router.post('/whitelist/remove', async (req, res) => {
    try {
        const domain = req.body.domain;
        
        if (!domain) {
            return res.status(400).json({
                success: false,
                error: 'Domain is required'
            });
        }
        
        const whitelist = await adblock.removeFromWhitelist(domain);
        
        // Reapply configuration if adblock is enabled
        const settings = await loadSettings();
        if (settings.adblock && settings.adblock.enabled) {
            await adblock.applyAdblockConfig(true);
        }
        
        await logActivity(
            'Whitelist Updated',
            `Removed ${domain} from whitelist`,
            'admin'
        );
        
        res.json({
            success: true,
            whitelist
        });
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /adblock/stats - Get adblock statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await adblock.getAdblockStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting adblock stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
