const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const settingsUtil = require('../utils/settings');
const resolverConfig = require('../utils/resolverConfig');

// Get settings page
router.get('/', async (req, res) => {
    try {
        // Load current settings
        const settings = await settingsUtil.loadSettings();
        
        // Add server info
        settings.server = {
            port: 3000,
            nodeVersion: process.version,
            platform: process.platform,
            uptime: Math.floor(process.uptime()),
        };

        res.render('settings/index', {
            title: 'Settings',
            settings,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load settings: ' + error.message
        });
    }
});

// Update settings
router.post('/', async (req, res) => {
    try {
        const { autoReload, validateBeforeReload, backupEnabled, autoGeneratePTR } = req.body;
        
        console.log('Received POST data:', req.body);
        console.log('autoReload:', autoReload, '=', autoReload === 'on');
        console.log('validateBeforeReload:', validateBeforeReload, '=', validateBeforeReload === 'on');
        console.log('backupEnabled:', backupEnabled, '=', backupEnabled === 'on');
        console.log('autoGeneratePTR:', autoGeneratePTR, '=', autoGeneratePTR === 'on');
        
        // Update settings
        const updates = {
            zones: {
                autoReload: autoReload === 'on',
                validateBeforeReload: validateBeforeReload === 'on',
                backupEnabled: backupEnabled === 'on',
                autoGeneratePTR: autoGeneratePTR === 'on'
            }
        };
        
        await settingsUtil.updateSettings(updates);
        
        console.log('✓ Settings updated:', updates.zones);
        res.redirect('/settings?success=' + encodeURIComponent('Settings updated successfully'));
    } catch (error) {
        console.error('Error updating settings:', error);
        res.redirect('/settings?error=' + encodeURIComponent(error.message));
    }
});

// Get Unbound status
router.get('/status', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // Check if unbound service is active
        let isRunning = false;
        try {
            const { stdout: statusOut } = await execPromise('systemctl is-active unbound');
            isRunning = statusOut.trim() === 'active';
        } catch (e) {
            isRunning = false;
        }

        // Get Unbound version (if available)
        let version = 'N/A';
        try {
            const { stdout: versionOut } = await execPromise('unbound -V 2>/dev/null');
            version = versionOut.split('\n')[0] || 'Unbound';
        } catch (e) {
            // ignore
        }

        // Get unbound-control status output
        let controlStatus = '';
        try {
            const { stdout: ctlOut } = await execPromise('unbound-control status 2>&1');
            controlStatus = ctlOut;
        } catch (e) {
            controlStatus = e.message;
        }

        res.json({
            success: true,
            status: isRunning ? 'running' : 'stopped',
            version,
            controlStatus
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Get resolver status
router.get('/resolver/status', async (req, res) => {
    try {
        const status = await resolverConfig.getResolverStatus();
        const stats = await resolverConfig.getResolverStats();
        
        res.json({
            success: true,
            status,
            stats
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Update resolver settings
router.post('/resolver', async (req, res) => {
    try {
        const currentSettings = await settingsUtil.loadSettings();
        const defaultResolver = settingsUtil.DEFAULT_SETTINGS.resolver;
        
        // Ensure resolver settings exist
        if (!currentSettings.resolver) {
            currentSettings.resolver = defaultResolver;
        }
        
        // Ensure upstreamDNS exists
        if (!currentSettings.resolver.upstreamDNS) {
            currentSettings.resolver.upstreamDNS = defaultResolver.upstreamDNS;
        }
        
        // Ensure access.allowedNetworks exists
        if (!currentSettings.resolver.access || !currentSettings.resolver.access.allowedNetworks) {
            currentSettings.resolver.access = currentSettings.resolver.access || {};
            currentSettings.resolver.access.allowedNetworks = defaultResolver.access.allowedNetworks;
        }
        
        // Parse form data
        const resolver = {
            enabled: req.body.resolverEnabled === 'on',
            forwardingEnabled: req.body.forwardingEnabled === 'on',
            upstreamDNS: currentSettings.resolver.upstreamDNS.map((dns, index) => ({
                ...dns,
                enabled: req.body[`upstream_${index}_enabled`] === 'on'
            })),
            cacheSize: {
                msg: parseInt(req.body.cacheSizeMsg) || 16,
                rrset: parseInt(req.body.cacheSizeRrset) || 32
            },
            cacheTTL: {
                min: parseInt(req.body.cacheTTLMin) || 300,
                max: parseInt(req.body.cacheTTLMax) || 86400
            },
            performance: {
                numThreads: parseInt(req.body.numThreads) || 2,
                prefetch: req.body.prefetch === 'on',
                prefetchKey: req.body.prefetchKey === 'on'
            },
            security: {
                hideIdentity: req.body.hideIdentity === 'on',
                hideVersion: req.body.hideVersion === 'on',
                dnssec: req.body.dnssec === 'on'
            },
            access: {
                allowedNetworks: currentSettings.resolver.access.allowedNetworks.map((net, index) => ({
                    ...net,
                    enabled: req.body[`network_${index}_enabled`] === 'on'
                }))
            },
            logging: {
                verbosity: parseInt(req.body.verbosity) || 1,
                logQueries: req.body.logQueries === 'on',
                logReplies: req.body.logReplies === 'on'
            }
        };
        
        // Update settings
        const updates = { resolver };
        await settingsUtil.updateSettings(updates);
        
        // Apply configuration
        const result = await resolverConfig.applyResolverConfig({
            ...currentSettings,
            resolver
        });
        
        res.redirect('/settings?success=' + encodeURIComponent(result.message));
    } catch (error) {
        console.error('Error updating resolver settings:', error);
        res.redirect('/settings?error=' + encodeURIComponent(error.message));
    }
});

// Test resolver
router.post('/resolver/test', async (req, res) => {
    try {
        const domain = req.body.domain || 'google.com';
        const result = await resolverConfig.testResolver(domain);
        
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Apply resolver configuration
router.post('/resolver/apply', async (req, res) => {
    try {
        const settings = await settingsUtil.loadSettings();
        const result = await resolverConfig.applyResolverConfig(settings);
        
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
