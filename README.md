# NDash - Bind DNS Management Dashboard

NDash adalah aplikasi web untuk mengelola DNS Bind dengan antarmuka yang modern dan mudah digunakan. Aplikasi ini dibangun dengan Express.js backend dan EJS templating, dengan desain yang terinspirasi dari IDVE.

## Fitur

- 📊 **Dashboard Informatif** - Tampilan statistik DNS zone dan records
- 🌐 **Manajemen DNS Zones** - Buat, lihat, edit, dan hapus DNS zones
- 📝 **Manajemen DNS Records** - Kelola berbagai tipe DNS records (A, AAAA, CNAME, MX, TXT, dll)
- 🎨 **UI Modern** - Desain responsif dengan Tailwind CSS dan Shadcn-UI inspired
- ⚡ **Quick Actions** - Akses cepat ke fungsi-fungsi umum
- 📱 **Responsive Design** - Bekerja dengan baik di desktop dan mobile

## Teknologi yang Digunakan

- **Backend**: Express.js
- **Template Engine**: EJS
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome
- **Date Handling**: Moment.js

## Instalasi

### 1. Install Dependencies

```bash
cd /opt/ndash
npm install
```

### 2. Konfigurasi (Opsional)

Edit file `server.js` untuk mengubah port atau konfigurasi lainnya:

```javascript
const PORT = process.env.PORT || 3000;
```

### 3. Jalankan Aplikasi

**Mode Production:**
```bash
npm start
```

**Mode Development (dengan auto-reload):**
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## Struktur Direktori

```
/opt/ndash/
├── data/
│   └── storage.js          # Data storage (zones, records, activities)
├── public/
│   ├── css/
│   │   └── style.css       # Custom CSS styles
│   └── js/
│       └── main.js         # Client-side JavaScript
├── routes/
│   ├── dashboard.js        # Dashboard routes
│   ├── zones.js            # DNS zones routes
│   └── records.js          # DNS records routes
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   ├── sidebar.ejs
│   │   ├── header-standalone.ejs
│   │   └── footer-standalone.ejs
│   ├── zones/
│   │   ├── list.ejs        # List all zones
│   │   ├── detail.ejs      # Zone details with records
│   │   └── new.ejs         # Create new zone
│   ├── records/
│   │   └── new.ejs         # Create new record
│   └── dashboard.ejs       # Main dashboard
├── server.js               # Main application file
├── package.json
└── README.md
```

## Penggunaan

### Dashboard
- Akses halaman utama untuk melihat overview DNS zones dan statistics
- Quick actions untuk akses cepat ke fungsi-fungsi utama
- Lihat aktivitas terbaru dan zona yang baru dibuat

### Manajemen DNS Zones
1. Klik **"DNS Zones"** di sidebar atau **"View Zones"** di quick actions
2. Untuk membuat zone baru, klik **"Create New Zone"**
3. Isi form dengan nama domain dan tipe zone
4. Klik zone untuk melihat detail dan record-nya

### Manajemen DNS Records
1. Buka detail zone yang ingin dikelola
2. Klik **"Add Record"** untuk menambah record baru
3. Pilih tipe record (A, AAAA, CNAME, MX, TXT, dll)
4. Isi nilai dan konfigurasi record
5. Record akan otomatis muncul di list

### Tipe DNS Records yang Didukung
- **A** - IPv4 Address
- **AAAA** - IPv6 Address
- **CNAME** - Canonical Name
- **MX** - Mail Exchange
- **TXT** - Text Record
- **NS** - Name Server
- **PTR** - Pointer
- **SRV** - Service

## Integrasi dengan Bind

> **Catatan**: Versi saat ini menggunakan data storage simulasi. Untuk integrasi penuh dengan Bind DNS server, Anda perlu:

1. Menambahkan modul untuk membaca/menulis zone files Bind
2. Mengimplementasikan fungsi untuk reload Bind service
3. Menambahkan validasi zone syntax
4. Setup permission untuk mengakses direktori Bind

### Contoh Integrasi (Future Enhancement):

```javascript
// Membaca zone file
const fs = require('fs-extra');
const zoneContent = await fs.readFile('/etc/bind/zones/db.example.com', 'utf8');

// Reload Bind
const { exec } = require('child_process');
exec('rndc reload', (error, stdout, stderr) => {
    if (error) {
        console.error('Error reloading Bind:', error);
    }
});
```

## Keamanan

⚠️ **Penting untuk Production:**

1. Implementasikan autentikasi dan authorization
2. Gunakan HTTPS
3. Validasi semua input dari user
4. Set proper file permissions untuk zone files
5. Implementasikan rate limiting
6. Enable CSRF protection
7. Audit log untuk semua perubahan

## Customization

### Mengubah Warna Theme
Edit file `/public/css/style.css` untuk menyesuaikan warna:

```css
.btn-primary {
    background: linear-gradient(135deg, #your-color 0%, #your-color-dark 100%);
}
```

### Menambah Menu Sidebar
Edit file `/views/partials/sidebar.ejs`:

```html
<a href="/new-menu" class="nav-item">
    <i class="fas fa-icon-name"></i>
    <span>Menu Name</span>
</a>
```

## Troubleshooting

### Port sudah digunakan
Ubah port di `server.js` atau set environment variable:
```bash
PORT=3001 npm start
```

### Module not found
Install ulang dependencies:
```bash
rm -rf node_modules
npm install
```

## Roadmap

- [ ] Autentikasi user dan role-based access
- [ ] Integrasi langsung dengan Bind9 zone files
- [ ] Export/Import zone files
- [ ] DNS query testing tools
- [ ] Backup dan restore zones
- [ ] Monitoring query statistics
- [ ] Multi-server management
- [ ] API documentation dengan Swagger

## Kontribusi

Kontribusi sangat diterima! Silakan buat pull request atau laporkan issues.

## Lisensi

ISC License

## Support

Untuk pertanyaan atau masalah, silakan buat issue di repository ini.

---

**Dibuat dengan ❤️ menggunakan Express.js dan EJS**
