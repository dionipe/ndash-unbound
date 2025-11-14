const express = require('express');
const router = express.Router();
const moment = require('moment');
const bindService = require('../services/bindService');
const { activities } = require('../data/storage');

router.get('/', async (req, res) => {
    try {
        // Get zones from Bind
        const zones = await bindService.listZones();
        
        // Calculate statistics
        const totalRecords = zones.reduce((sum, zone) => sum + zone.records, 0);
        
        const stats = {
            totalZones: zones.length,
            activeZones: zones.filter(z => z.status === 'active').length,
            totalRecords: totalRecords,
            recentActivities: activities.slice(0, 5)
        };

        // Get Bind status
        const bindStatus = await bindService.getBindStatus();

        // Group records by type (simplified - would need to parse all zones for accurate count)
        const recordsByType = {
            'A': 0,
            'AAAA': 0,
            'CNAME': 0,
            'MX': 0,
            'TXT': 0,
            'NS': 0
        };

        res.render('dashboard', {
            title: 'NDash - Bind DNS Dashboard',
            stats,
            zones: zones.slice(0, 5),
            recordsByType,
            activities: stats.recentActivities,
            bindStatus,
            moment
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('dashboard', {
            title: 'NDash - Bind DNS Dashboard',
            stats: { totalZones: 0, activeZones: 0, totalRecords: 0, recentActivities: [] },
            zones: [],
            recordsByType: {},
            activities: [],
            bindStatus: { success: false, status: 'error' },
            moment,
            error: error.message
        });
    }
});

module.exports = router;
