// Simulated DNS data storage (in production, this would interact with Bind zone files)
const zones = [
    {
        id: 1,
        name: 'example.com',
        type: 'master',
        file: '/etc/bind/zones/db.example.com',
        status: 'active',
        records: 12,
        lastModified: new Date('2024-11-10')
    },
    {
        id: 2,
        name: 'test.local',
        type: 'master',
        file: '/etc/bind/zones/db.test.local',
        status: 'active',
        records: 8,
        lastModified: new Date('2024-11-12')
    }
];

const records = [
    { id: 1, zoneId: 1, name: '@', type: 'A', value: '192.168.1.100', ttl: 3600 },
    { id: 2, zoneId: 1, name: 'www', type: 'A', value: '192.168.1.100', ttl: 3600 },
    { id: 3, zoneId: 1, name: '@', type: 'MX', value: 'mail.example.com', priority: 10, ttl: 3600 },
    { id: 4, zoneId: 1, name: 'mail', type: 'A', value: '192.168.1.101', ttl: 3600 },
    { id: 5, zoneId: 2, name: '@', type: 'A', value: '10.0.0.1', ttl: 3600 }
];

const activities = [
    { id: 1, action: 'Zone Created', description: 'Created new zone: example.com', timestamp: new Date('2024-11-10T10:30:00'), user: 'admin' },
    { id: 2, action: 'Record Added', description: 'Added A record for www.example.com', timestamp: new Date('2024-11-12T14:20:00'), user: 'admin' },
    { id: 3, action: 'Zone Modified', description: 'Updated SOA record for test.local', timestamp: new Date('2024-11-13T09:15:00'), user: 'admin' }
];

module.exports = {
    zones,
    records,
    activities
};
