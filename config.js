module.exports = {
    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    },

    // Bind Configuration
    bind: {
        zonesPath: process.env.BIND_ZONES_PATH || '/etc/bind/zones',
        confPath: process.env.BIND_CONF_PATH || '/etc/bind/named.conf.local',
        reloadCommand: 'rndc reload',
        checkCommand: 'named-checkzone'
    },

    // Session Configuration
    session: {
        secret: process.env.SESSION_SECRET || 'ndash-secret-key-change-in-production',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    },

    // Default DNS Settings
    dns: {
        defaultTTL: 3600,
        defaultRefresh: 86400,
        defaultRetry: 7200,
        defaultExpire: 3600000,
        defaultMinimum: 86400,
        supportedRecordTypes: [
            'A', 'AAAA', 'CNAME', 'MX', 'TXT', 
            'NS', 'PTR', 'SRV', 'SOA', 'CAA'
        ]
    },

    // UI Settings
    ui: {
        itemsPerPage: 20,
        dateFormat: 'DD MMM YYYY, HH:mm',
        timezone: 'Asia/Jakarta'
    }
};
