# NDash - Deployment Guide

## Deployment untuk Production

### 1. Sebagai Systemd Service

Copy file service ke systemd:
```bash
sudo cp /opt/ndash/ndash.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ndash
sudo systemctl start ndash
```

Cek status:
```bash
sudo systemctl status ndash
```

Melihat logs:
```bash
sudo journalctl -u ndash -f
```

### 2. Menggunakan PM2 (Recommended)

Install PM2:
```bash
sudo npm install -g pm2
```

Start aplikasi:
```bash
cd /opt/ndash
pm2 start server.js --name ndash
pm2 save
pm2 startup
```

Monitor:
```bash
pm2 monit
pm2 logs ndash
```

### 3. Dengan Nginx Reverse Proxy

Install Nginx:
```bash
sudo apt update
sudo apt install nginx
```

Buat konfigurasi Nginx (`/etc/nginx/sites-available/ndash`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/ndash /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL dengan Let's Encrypt

Install Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

Dapatkan sertifikat:
```bash
sudo certbot --nginx -d your-domain.com
```

### 5. Environment Variables

Buat file `.env` untuk konfigurasi production:
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secret-key-here
BIND_ZONES_PATH=/etc/bind/zones
BIND_CONF_PATH=/etc/bind/named.conf.local
```

Install dotenv:
```bash
npm install dotenv
```

Update `server.js`:
```javascript
require('dotenv').config();
```

## Keamanan Production

### 1. Firewall
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 3. Update Dependencies
```bash
npm audit
npm audit fix
```

## Monitoring

### Log Rotation
Buat `/etc/logrotate.d/ndash`:
```
/var/log/ndash/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
}
```

## Backup

Script backup otomatis:
```bash
#!/bin/bash
BACKUP_DIR="/backup/ndash"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/ndash_$DATE.tar.gz /opt/ndash/data
```

Tambahkan ke crontab:
```bash
0 2 * * * /usr/local/bin/backup-ndash.sh
```
