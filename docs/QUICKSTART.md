# NDash - Quick Start Guide

## 🚀 Instalasi Cepat

### 1. Clone/Copy Project
Pastikan semua file sudah ada di `/opt/ndash`

### 2. Install Dependencies
```bash
cd /opt/ndash
npm install
```

### 3. Jalankan Aplikasi
```bash
npm start
```

Atau gunakan script:
```bash
./start.sh
```

### 4. Akses Dashboard
Buka browser dan akses:
```
http://localhost:3000
```

## 📋 Panduan Penggunaan

### Dashboard Utama
- **URL**: `http://localhost:3000/`
- Menampilkan statistik DNS zones dan records
- Quick actions untuk akses cepat
- Recent activities dan zones terbaru

### Mengelola DNS Zones

#### Melihat Semua Zones
1. Klik **"DNS Zones"** di sidebar
2. Atau klik **"View Zones"** di quick actions

#### Membuat Zone Baru
1. Klik **"Create New Zone"** atau **"Create Zone"** di quick actions
2. Isi form:
   - **Zone Name**: Nama domain (contoh: example.com)
   - **Zone Type**: Pilih master/slave/forward
   - **Zone File Path**: (opsional) akan otomatis jika kosong
3. Klik **"Create Zone"**

#### Melihat Detail Zone
1. Di halaman DNS Zones, klik icon mata (👁️) pada zone
2. Akan menampilkan detail zone dan semua records-nya

#### Menghapus Zone
1. Di halaman DNS Zones, klik icon trash (🗑️)
2. Konfirmasi penghapusan

### Mengelola DNS Records

#### Menambah Record Baru
1. Buka detail zone
2. Klik **"Add Record"**
3. Isi form:
   - **Record Name**: @ untuk root, atau subdomain (www, mail, dll)
   - **Record Type**: A, AAAA, CNAME, MX, TXT, NS, PTR, SRV
   - **Value**: IP address atau hostname
   - **TTL**: Time to live dalam detik (default: 3600)
   - **Priority**: Untuk MX dan SRV records
4. Klik **"Add Record"**

#### Menghapus Record
1. Di halaman detail zone
2. Klik icon trash pada record yang ingin dihapus
3. Konfirmasi penghapusan

## 🎨 Fitur UI

### Sidebar Navigation
- **Dashboard**: Halaman utama
- **DNS Zones**: Kelola zones
- **Create Zone**: Buat zone baru
- **Reload Bind**: Reload Bind service (coming soon)
- **Settings**: Pengaturan (coming soon)
- **Monitoring**: Monitor DNS (coming soon)
- **Activity Log**: Log aktivitas (coming soon)

### Quick Actions
6 tombol akses cepat di dashboard:
1. Create Zone
2. View Zones
3. All Records
4. Reload Bind
5. Statistics
6. Settings

### Status Indicators
- 🟢 **Active**: Zone aktif
- 🟡 **Inactive**: Zone tidak aktif
- Badge warna untuk tipe record (A, CNAME, MX, dll)

## 🔧 Tipe DNS Records yang Didukung

| Type | Deskripsi | Contoh Value |
|------|-----------|--------------|
| A | IPv4 Address | 192.168.1.1 |
| AAAA | IPv6 Address | 2001:db8::1 |
| CNAME | Canonical Name | www.example.com |
| MX | Mail Exchange | mail.example.com |
| TXT | Text Record | "v=spf1 mx -all" |
| NS | Name Server | ns1.example.com |
| PTR | Pointer | example.com |
| SRV | Service | 0 5 5060 sipserver.example.com |

## 📊 Halaman yang Tersedia

1. **Dashboard** (`/`)
   - Overview statistik
   - Quick actions
   - Recent zones
   - Recent activities

2. **DNS Zones List** (`/zones`)
   - Tabel semua zones
   - Status, type, record count
   - Actions (view, edit, delete)

3. **Zone Detail** (`/zones/:id`)
   - Informasi zone
   - List semua records
   - Add/delete records

4. **Create Zone** (`/zones/new/create`)
   - Form pembuatan zone baru

5. **Add Record** (`/records/zone/:zoneId/new`)
   - Form penambahan record baru

## ⚙️ Konfigurasi

### Mengubah Port
Edit `server.js` atau set environment variable:
```bash
PORT=8080 npm start
```

### Data Storage
Data saat ini disimpan di memory (`data/storage.js`)
Untuk production, integrasikan dengan Bind zone files

## 🔒 Keamanan

⚠️ **Untuk Development Only**
Aplikasi ini belum termasuk:
- Autentikasi user
- Authorization
- SSL/HTTPS
- Input validation lengkap

Untuk production, lihat `DEPLOYMENT.md`

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Gunakan port lain
PORT=3001 npm start
```

### Module Not Found
```bash
# Install ulang dependencies
rm -rf node_modules
npm install
```

### Permission Denied (Bind files)
```bash
# Untuk integrasi Bind, butuh akses ke /etc/bind
sudo chown -R $USER:$USER /etc/bind/zones
```

## 📝 Tips

1. **Backup Data**: Belum ada auto-backup, backup manual `data/storage.js`
2. **Testing**: Test di environment development dulu
3. **Monitoring**: Gunakan `pm2 monit` untuk monitoring
4. **Logs**: Check logs dengan `pm2 logs ndash`

## 🆘 Bantuan

### Command Berguna
```bash
# Start server
npm start

# Development mode (auto-reload)
npm run dev

# Check status (jika pakai systemd)
sudo systemctl status ndash

# View logs (jika pakai pm2)
pm2 logs ndash

# Restart (pm2)
pm2 restart ndash
```

### File Penting
- `server.js` - Main server
- `data/storage.js` - Data storage
- `config.js` - Konfigurasi
- `routes/` - API routes
- `views/` - EJS templates
- `public/css/style.css` - Styling

## 📚 Dokumentasi Lengkap

- `README.md` - Dokumentasi utama
- `DEPLOYMENT.md` - Panduan deployment production
- `STRUCTURE.md` - Struktur project detail

## 🎯 Next Steps

1. ✅ Install dan jalankan aplikasi
2. ✅ Explore dashboard dan UI
3. ✅ Buat zone dan records percobaan
4. 📝 Integrasikan dengan Bind (optional)
5. 🚀 Deploy ke production (ikuti DEPLOYMENT.md)

---

**Selamat menggunakan NDash! 🎉**

Untuk pertanyaan atau masalah, buka issue atau hubungi administrator.
