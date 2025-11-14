const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs-extra');
const unboundService = require('./services/unboundService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'ndash-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const dashboardRoutes = require('./routes/dashboard');
const zonesRoutes = require('./routes/zones');
const recordsRoutes = require('./routes/records');
const settingsRoutes = require('./routes/settings');
const monitoringRoutes = require('./routes/monitoring');
const statisticsRoutes = require('./routes/statistics');
const activityRoutes = require('./routes/activity');
const adblockRoutes = require('./routes/adblock');

app.use('/', dashboardRoutes);
app.use('/zones', zonesRoutes);
app.use('/records', recordsRoutes);
app.use('/settings', settingsRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/statistics', statisticsRoutes);
app.use('/activity', activityRoutes);
app.use('/adblock', adblockRoutes);

// Initialize Unbound service and start server
async function startServer() {
    try {
        // Initialize Unbound service
        console.log('🔧 Initializing Unbound service...');
        await unboundService.initialize();
        
        // Check Unbound status
        const status = await unboundService.getUnboundStatus();
        if (status.success) {
            console.log('✓ Unbound DNS server is running');
        } else {
            console.warn('⚠ Warning: Unbound DNS server may not be running');
            console.warn('  Run: sudo systemctl start unbound');
        }
        
        // List existing zones
        const zones = await unboundService.listZones();
        console.log(`✓ Found ${zones.length} existing zone(s)`);
        
        // Start Express server
        app.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════');
            console.log('  🚀 NDash - Unbound DNS Management Dashboard');
            console.log('═══════════════════════════════════════════');
            console.log(`  Server: http://localhost:${PORT}`);
            console.log(`  Zones:  ${zones.length} loaded`);
            console.log(`  Status: Ready`);
            console.log('═══════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error.message);
        console.error('  Please check Unbound configuration and permissions');
        process.exit(1);
    }
}

startServer();
