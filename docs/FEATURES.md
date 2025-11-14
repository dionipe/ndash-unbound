
## Edit Record Feature

### Overview
Fungsi edit record memungkinkan pengguna untuk mengubah DNS records yang sudah ada tanpa perlu delete dan create ulang.

### Capabilities
- ✅ Edit record name (hostname)
- ✅ Edit record value (IP address, CNAME target, dll)
- ✅ Edit TTL
- ✅ Edit priority (untuk MX/SRV records)
- ✅ Edit type (A → AAAA, dll)
- ✅ Auto increment serial number
- ✅ Zone syntax validation
- ✅ Automatic Bind reload

### Usage

#### Via Web Interface
1. Navigate to zone detail page
2. Click Edit button (pencil icon) next to the record
3. Modify the fields as needed
4. Click "Update Record"

#### Via CLI/Code
```javascript
const bindService = require('./services/bindService');

await bindService.updateRecord('dionipe.id', 
  { name: 'oldname', type: 'A' },           // Old record
  { name: 'newname', type: 'A',             // New record
    value: '192.168.1.100', 
    ttl: 3600 
  }
);
```

### Technical Implementation
- Method: `bindService.updateRecord(zoneName, oldRecord, newRecord)`
- Routes: 
  - GET `/records/:zoneName/:recordName/:recordType/edit`
  - POST `/records/:zoneName/:recordName/:recordType/edit`
- View: `views/records/edit.ejs`
- Process:
  1. Read zone file
  2. Increment serial number
  3. Find and replace the record line
  4. Write updated zone file
  5. Validate with `named-checkzone`
  6. Reload Bind with `rndc reload`

### Testing
All tests passed:
- ✅ Edit value: Changed IP from 10.20.30.40 → 192.168.99.99
- ✅ Edit TTL: Changed TTL from 3600 → 7200
- ✅ Edit name: Changed oldname → newname
- ✅ DNS query verification: dig confirms changes active

### Error Handling
- Record not found error
- Zone syntax validation error
- Bind reload error
- All errors displayed to user with helpful messages

