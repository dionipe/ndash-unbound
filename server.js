const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs-extra');
const bindService = require('./services/bindService');

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

app.use('/', dashboardRoutes);
app.use('/zones', zonesRoutes);
app.use('/records', recordsRoutes);

// Initialize Bind service and start server
async function startServer() {
    try {
        // Initialize Bind service
        console.log('🔧 Initializing Bind service...');
        await bindService.initialize();
        
        // Check Bind status
        const status = await bindService.getBindStatus();
        if (status.success) {
            console.log('✓ Bind DNS server is running');
        } else {
            console.warn('⚠ Warning: Bind DNS server may not be running');
            console.warn('  Run: sudo systemctl start bind9');
        }
        
        // List existing zones
        const zones = await bindService.listZones();
        console.log(`✓ Found ${zones.length} existing zone(s)`);
        
        // Start Express server
        app.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════');
            console.log('  🚀 NDash - Bind DNS Management Dashboard');
            console.log('═══════════════════════════════════════════');
            console.log(`  Server: http://localhost:${PORT}`);
            console.log(`  Zones:  ${zones.length} loaded`);
            console.log(`  Status: Ready`);
            console.log('═══════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error.message);
        console.error('  Please check Bind configuration and permissions');
        process.exit(1);
    }
}

startServer();
