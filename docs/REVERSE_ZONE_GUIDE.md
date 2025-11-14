# Reverse Zone Auto-Generation Guide

## Fitur Baru: Auto-Generate PTR Records

Saat membuat reverse zone (in-addr.arpa), sistem akan secara otomatis membuat 254 PTR records dari IP 1-254.

## Cara Penggunaan

### Via Web Interface

1. Buka http://localhost:3000/zones/new/create
2. Masukkan zona reverse, contoh: `192.168.100.in-addr.arpa.`
3. Field **Domain for PTR Records** akan muncul otomatis
4. Masukkan domain untuk PTR records, contoh: `example.com`
5. Klik **Create Zone**

### Hasil

Sistem akan membuat:
- SOA record dengan nameserver dan email yang ditentukan
- NS record untuk nameserver
- 254 PTR records otomatis:
  ```
  1       IN      PTR     host1.example.com.
  2       IN      PTR     host2.example.com.
  ...
  254     IN      PTR     host254.example.com.
  ```

## Contoh Testing

```bash
# Query SOA
dig @localhost 192.168.100.in-addr.arpa. SOA +short

# Query PTR record untuk IP 192.168.100.50
dig @localhost 50.192.168.100.in-addr.arpa. PTR +short
# Output: host50.example.com.

# Query reverse dengan -x
dig @localhost -x 192.168.100.100 +short
# Output: host100.example.com.
```

## Format Zone Name

Untuk subnet /24:
- Network: 192.168.100.0/24
- Zone name: `192.168.100.in-addr.arpa.`
- PTR format: `<last-octet>.192.168.100.in-addr.arpa.`

## Customization

Setelah zone dibuat, Anda bisa:
1. Edit PTR records sesuai kebutuhan via dashboard
2. Ganti hostname default (host1, host2, dst) dengan hostname sebenarnya
3. Hapus PTR records yang tidak diperlukan

## Technical Details

- File zone: `/etc/bind/zones/db.<zone-name>`
- Total records: 254 PTR (IP 1-254)
- Format: `<octet> IN PTR <hostname>.<domain>.`
- Serial: Auto-generated (YYYYMMDDNN)
