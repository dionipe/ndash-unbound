const express = require('express');
const router = express.Router();
const moment = require('moment');
const bindService = require('../services/bindService');

// List all zones
router.get('/', async (req, res) => {
    try {
        const zones = await bindService.listZones();
        
        res.render('zones/list', {
            title: 'DNS Zones',
            zones: zones,
            moment,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error listing zones:', error);
        res.render('zones/list', {
            title: 'DNS Zones',
            zones: [],
            moment,
            error: 'Failed to load zones: ' + error.message
        });
    }
});

// View zone details
router.get('/:zoneName', async (req, res) => {
    try {
        const zoneName = req.params.zoneName;
        const { zone, records } = await bindService.getZone(zoneName);

        res.render('zones/detail', {
            title: `Zone: ${zone.name}`,
            zone,
            records: records,
            moment,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error loading zone:', error);
        res.status(404).render('error', {
            title: 'Zone Not Found',
            message: error.message
        });
    }
});

// Add new zone (GET form)
router.get('/new/create', (req, res) => {
    res.render('zones/new', {
        title: 'Create New Zone'
    });
});

// Add new zone (POST)
router.post('/', async (req, res) => {
    try {
        const { name, type, nameserver, email, domain } = req.body;
        
        if (!name) {
            return res.redirect('/zones/new/create?error=' + encodeURIComponent('Zone name is required'));
        }
        
        const zoneData = {
            name: name,
            type: type || 'master',
            nameserver: nameserver || `ns1.${name}.`,
            email: email || `admin.${name}.`
        };
        
        // Add domain for reverse zones
        if (domain && name.includes('in-addr.arpa')) {
            zoneData.domain = domain;
        }
        
        const result = await bindService.createZone(zoneData);
        
        console.log('Zone created:', result);
        res.redirect(`/zones/${name}?success=` + encodeURIComponent(`Zone ${name} created successfully`));
    } catch (error) {
        console.error('Error creating zone:', error);
        res.redirect('/zones/new/create?error=' + encodeURIComponent(error.message));
    }
});

// Delete zone
router.post('/:zoneName/delete', async (req, res) => {
    try {
        const zoneName = req.params.zoneName;
        await bindService.deleteZone(zoneName);
        res.redirect('/zones?success=' + encodeURIComponent(`Zone ${zoneName} deleted successfully`));
    } catch (error) {
        console.error('Error deleting zone:', error);
        res.redirect('/zones?error=' + encodeURIComponent(error.message));
    }
});

// Reload Bind
router.post('/reload', async (req, res) => {
    try {
        await bindService.reloadBind();
        res.json({ success: true, message: 'Bind reloaded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
