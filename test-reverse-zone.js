const bindService = require('./services/bindService');

(async () => {
  console.log('Testing reverse zone creation with auto-generated PTR records...\n');
  
  await bindService.initialize();
  
  const result = await bindService.createZone({
    name: '192.168.100.in-addr.arpa.',
    type: 'master',
    nameserver: 'ns1.example.net.',
    email: 'admin.example.net.',
    domain: 'example.net'
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('\nZone file created at:', result.file);
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
