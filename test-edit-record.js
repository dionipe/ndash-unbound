const bindService = require('./services/bindService');

(async () => {
  console.log('Testing record edit functionality...\n');
  
  await bindService.initialize();
  
  // Get zone dionipe.id
  const { zone, records } = await bindService.getZone('dionipe.id');
  
  console.log('Zone:', zone.name);
  console.log('Current records:');
  records.forEach(r => {
    console.log(`  ${r.name}\t${r.type}\t${r.value}`);
  });
  
  // Find a record to edit
  const recordToEdit = records.find(r => r.type === 'A' && r.name !== '@');
  
  if (!recordToEdit) {
    console.log('\nNo A record found to edit. Adding one first...');
    await bindService.addRecord('dionipe.id', {
      name: 'test',
      type: 'A',
      value: '192.168.1.100',
      ttl: 3600
    });
    console.log('✓ Test record added');
  } else {
    console.log('\nFound record to edit:', recordToEdit);
    
    const oldRecord = {
      name: recordToEdit.name,
      type: recordToEdit.type
    };
    
    const newRecord = {
      name: recordToEdit.name,
      type: recordToEdit.type,
      value: '10.20.30.40', // New IP
      ttl: 7200 // New TTL
    };
    
    console.log('\nUpdating record...');
    console.log('Old:', oldRecord);
    console.log('New:', newRecord);
    
    await bindService.updateRecord('dionipe.id', oldRecord, newRecord);
    console.log('✓ Record updated successfully!');
    
    // Verify the change
    const { records: updatedRecords } = await bindService.getZone('dionipe.id');
    const updated = updatedRecords.find(r => r.name === recordToEdit.name && r.type === recordToEdit.type);
    console.log('\nVerification - Updated record:');
    console.log(`  ${updated.name}\t${updated.type}\t${updated.value}\tTTL: ${updated.ttl}`);
  }
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
