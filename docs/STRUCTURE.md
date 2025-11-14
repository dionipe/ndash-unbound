# NDash - Project Structure

## Complete File Tree

```
/opt/ndash/
│
├── config.js                    # Application configuration
├── server.js                    # Main Express server
├── package.json                 # Node.js dependencies
├── .gitignore                   # Git ignore rules
│
├── data/
│   └── storage.js              # Data storage (zones, records, activities)
│
├── routes/
│   ├── dashboard.js            # Dashboard routes
│   ├── zones.js                # DNS zones management routes
│   └── records.js              # DNS records management routes
│
├── utils/
│   └── bind.js                 # Bind DNS utility functions
│
├── views/
│   ├── dashboard.ejs           # Main dashboard page
│   │
│   ├── partials/
│   │   ├── header.ejs          # Header component
│   │   ├── sidebar.ejs         # Sidebar navigation
│   │   ├── header-standalone.ejs
│   │   └── footer-standalone.ejs
│   │
│   ├── zones/
│   │   ├── list.ejs            # List all DNS zones
│   │   ├── detail.ejs          # Zone detail with records
│   │   └── new.ejs             # Create new zone form
│   │
│   └── records/
│       ├── list.ejs            # List zone records
│       └── new.ejs             # Add new record form
│
├── public/
│   ├── css/
│   │   └── style.css           # Custom CSS styles
│   │
│   └── js/
│       └── main.js             # Client-side JavaScript
│
├── start.sh                     # Quick start script
├── ndash.service               # Systemd service file
│
├── README.md                   # Main documentation
├── DEPLOYMENT.md               # Deployment guide
└── STRUCTURE.md                # This file

```

## Key Components

### Backend Routes

#### Dashboard (`routes/dashboard.js`)
- `GET /` - Main dashboard with statistics and overview

#### Zones Management (`routes/zones.js`)
- `GET /zones` - List all DNS zones
- `GET /zones/:id` - View zone details
- `GET /zones/new/create` - Create new zone form
- `POST /zones` - Create new zone
- `POST /zones/:id/delete` - Delete zone

#### Records Management (`routes/records.js`)
- `GET /records/zone/:zoneId` - List records for a zone
- `GET /records/zone/:zoneId/new` - Add new record form
- `POST /records/zone/:zoneId` - Create new record
- `POST /records/:id/delete` - Delete record

### Frontend Views

#### Layout Structure
```
┌─────────────────────────────────────────────┐
│ Sidebar │ Header                            │
│         ├───────────────────────────────────┤
│         │                                   │
│         │   Main Content Area               │
│         │                                   │
│         │                                   │
└─────────────────────────────────────────────┘
```

#### Dashboard Components
- Quick Actions Grid (6 action cards)
- Statistics Cards (4 metric cards)
- Recent Zones List
- Recent Activities Timeline

#### Zone Management
- Zones List Table
- Zone Detail View
- Zone Creation Form
- Record Management Interface

### Styling

#### CSS Framework Stack
- Tailwind CSS 2.2.19 (via CDN)
- Custom CSS (`public/css/style.css`)
- Font Awesome 6.4.0 (icons)

#### Design System
- **Primary Color**: Blue (#3b82f6)
- **Sidebar**: Dark gradient (gray-900 to gray-800)
- **Cards**: White with subtle shadows
- **Typography**: System font stack
- **Spacing**: Consistent 0.25rem increments

### Data Model

#### Zone Object
```javascript
{
    id: Number,
    name: String,           // e.g., "example.com"
    type: String,           // "master", "slave", "forward"
    file: String,           // Path to zone file
    status: String,         // "active", "inactive"
    records: Number,        // Count of records
    lastModified: Date
}
```

#### Record Object
```javascript
{
    id: Number,
    zoneId: Number,
    name: String,           // e.g., "@", "www", "mail"
    type: String,           // "A", "AAAA", "CNAME", etc.
    value: String,          // IP or hostname
    ttl: Number,            // Time to live in seconds
    priority: Number        // Optional, for MX/SRV records
}
```

#### Activity Object
```javascript
{
    id: Number,
    action: String,         // "Zone Created", "Record Added", etc.
    description: String,
    timestamp: Date,
    user: String
}
```

## Features Overview

### ✅ Implemented
- Dashboard with statistics
- Zone listing and creation
- Record management (add, delete)
- Responsive design
- Activity logging
- Quick actions
- Modern UI with Shadcn-inspired design

### 🚧 Ready for Integration
- Bind zone file reading/writing
- Zone file validation
- Bind service reload
- SOA record management

### 🔮 Future Enhancements
- User authentication
- Role-based access control
- Real-time DNS query testing
- Zone file import/export
- Backup and restore
- Multi-server support
- API endpoints
- Advanced monitoring

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Template Engine**: EJS 3.1.9
- **Session**: express-session 1.17.3
- **File Operations**: fs-extra 11.2.0
- **Date Handling**: Moment.js 2.29.4

### Frontend
- **CSS Framework**: Tailwind CSS 2.2.19
- **Icons**: Font Awesome 6.4.0
- **JavaScript**: Vanilla ES6+

### Development
- **Dev Server**: Nodemon 3.0.2
- **Package Manager**: npm

## Configuration

### Environment Variables
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secret-key
BIND_ZONES_PATH=/etc/bind/zones
BIND_CONF_PATH=/etc/bind/named.conf.local
```

### Default Settings
- **Port**: 3000
- **TTL**: 3600 seconds
- **Session**: 24 hours
- **Date Format**: DD MMM YYYY, HH:mm

## API Endpoints (Future)

```
GET    /api/zones              - List all zones
POST   /api/zones              - Create zone
GET    /api/zones/:id          - Get zone details
PUT    /api/zones/:id          - Update zone
DELETE /api/zones/:id          - Delete zone

GET    /api/zones/:id/records  - List zone records
POST   /api/zones/:id/records  - Add record
PUT    /api/records/:id        - Update record
DELETE /api/records/:id        - Delete record

POST   /api/bind/reload        - Reload Bind
GET    /api/bind/status        - Check Bind status
```

## Security Considerations

### Current Implementation
- Session-based tracking
- Form validation on client-side
- Delete confirmations

### Production Requirements
- [ ] User authentication
- [ ] HTTPS/TLS
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] File permission checks
- [ ] Audit logging
- [ ] Backup system

## Performance

### Optimization Strategies
- Static asset caching
- Gzip compression
- CDN for external libraries
- Efficient database queries (when implemented)
- Lazy loading for large zone lists

### Monitoring
- PM2 process management
- Log rotation
- Error tracking
- Performance metrics

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

ISC License

---

**Last Updated**: November 2024
