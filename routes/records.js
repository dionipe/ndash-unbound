const express = require('express');
const router = express.Router();
const bindService = require('../services/bindService');

// List records for a zone
router.get('/zone/:zoneName', async (req, res) => {
    try {
        const zoneName = req.params.zoneName;
        const { zone, records } = await bindService.getZone(zoneName);

        res.render('records/list', {
            title: `Records for ${zone.name}`,
            zone,
            records
        });
    } catch (error) {
        console.error('Error listing records:', error);
        res.status(404).send('Zone not found');
    }
});

// Add new record (GET form)
router.get('/zone/:zoneName/new', async (req, res) => {
    try {
        const zoneName = req.params.zoneName;
        const { zone } = await bindService.getZone(zoneName);

        res.render('records/new', {
            title: 'Add New Record',
            zone,
            error: req.query.error
        });
    } catch (error) {
        res.status(404).send('Zone not found');
    }
});

// Add new record (POST)
router.post('/zone/:zoneName', async (req, res) => {
    try {
        const zoneName = req.params.zoneName;
        const record = {
            name: req.body.name,
            type: req.body.type,
            value: req.body.value,
            ttl: parseInt(req.body.ttl) || 3600,
            priority: req.body.priority ? parseInt(req.body.priority) : undefined,
            weight: req.body.weight ? parseInt(req.body.weight) : undefined,
            port: req.body.port ? parseInt(req.body.port) : undefined
        };

        await bindService.addRecord(zoneName, record);
        res.redirect(`/zones/${zoneName}?success=` + encodeURIComponent('Record added successfully'));
    } catch (error) {
        console.error('Error adding record:', error);
        res.redirect(`/records/zone/${req.params.zoneName}/new?error=` + encodeURIComponent(error.message));
    }
});

// Delete record
router.post('/:zoneName/:recordName/:recordType/delete', async (req, res) => {
    try {
        const { zoneName, recordName, recordType } = req.params;
        await bindService.deleteRecord(zoneName, recordName, recordType);
        res.redirect(`/zones/${zoneName}?success=` + encodeURIComponent('Record deleted successfully'));
    } catch (error) {
        console.error('Error deleting record:', error);
        res.redirect(`/zones/${req.params.zoneName}?error=` + encodeURIComponent(error.message));
    }
});

// Edit record (GET form)
router.get('/:zoneName/:recordName/:recordType/edit', async (req, res) => {
    try {
        const { zoneName, recordName, recordType } = req.params;
        const { zone, records } = await bindService.getZone(zoneName);
        
        // Find the specific record
        const record = records.find(r => r.name === recordName && r.type === recordType);
        
        if (!record) {
            return res.redirect(`/zones/${zoneName}?error=` + encodeURIComponent('Record not found'));
        }

        res.render('records/edit', {
            title: 'Edit Record',
            zone,
            record,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading record for edit:', error);
        res.status(404).send('Record not found');
    }
});

// Edit record (POST)
router.post('/:zoneName/:recordName/:recordType/edit', async (req, res) => {
    try {
        const { zoneName, recordName, recordType } = req.params;
        
        const oldRecord = {
            name: recordName,
            type: recordType
        };
        
        const newRecord = {
            name: req.body.name,
            type: req.body.type,
            value: req.body.value,
            ttl: parseInt(req.body.ttl) || 3600,
            priority: req.body.priority ? parseInt(req.body.priority) : undefined,
            weight: req.body.weight ? parseInt(req.body.weight) : undefined,
            port: req.body.port ? parseInt(req.body.port) : undefined
        };

        await bindService.updateRecord(zoneName, oldRecord, newRecord);
        res.redirect(`/zones/${zoneName}?success=` + encodeURIComponent('Record updated successfully'));
    } catch (error) {
        console.error('Error updating record:', error);
        res.redirect(`/records/${req.params.zoneName}/${req.params.recordName}/${req.params.recordType}/edit?error=` + encodeURIComponent(error.message));
    }
});

module.exports = router;
