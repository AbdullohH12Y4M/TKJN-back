# Panduan Deployment Presensi CRUD (Backend + Frontend)

Panduan ini menjelaskan langkah lengkap untuk men-deploy aplikasi Presensi CRUD ke server Ubuntu menggunakan Apache sebagai web server untuk frontend dan reverse proxy untuk backend Node.js.

> Asumsi:
> - Backend berada di `PresensiCRUDNodeBack-main`
> - Frontend berada di `PresensiCRUDNodeFront-main`
> - Apache akan menyajikan frontend dari `/var/www/html`
> - Backend Node.js akan berjalan secara terpisah di port lokal (misal `3001`)

---

## 1. Persiapan Server Ubuntu

1. Update dan upgrade paket:

```bash
sudo apt update
sudo apt upgrade -y
```

2. Install Node.js dan npm (misal Node 20+):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

3. Install MySQL:

```bash
sudo apt install -y mysql-server
```

4. Konfigurasi database MySQL:

```bash
sudo mysql
```

Di shell MySQL:

```sql
CREATE DATABASE presensi_aqua;
CREATE USER 'presensi'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON presensi_aqua.* TO 'presensi'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> Ganti `password` dengan kata sandi yang kuat.

---

## 1.5 Clone kode dari Git

1. Pilih folder kerja di server, misalnya `/home/ubuntu`.
2. Clone backend:

```bash
cd /home/ubuntu
git clone https://repo-anda/backend-repo.git PresensiCRUDNodeBack-main
```

3. Clone frontend:

```bash
cd /home/ubuntu
git clone https://repo-anda/frontend-repo.git PresensiCRUDNodeFront-main
```

Jika repositori Anda privat, gunakan SSH key atau credential yang valid.

---

## 2. Deploy Backend

### 2.1 Salin kode backend ke server

Simpan kode backend di direktori yang nyaman, misalnya:

```bash
/home/ubuntu/presensi-backend
```

### 2.2 Install dependency backend

```bash
cd /home/ubuntu/presensi-backend
npm install
```

### 2.3 Buat file environment backend

Buat file `.env` di root backend:

```env
DATABASE_URL=mysql://presensi:password@localhost:3306/presensi_aqua
PORT=3001
FRONTEND_ORIGIN=https://your-domain.com
SESSION_SECRET=acak-dengan-panjang
NODE_ENV=production
```

### 2.4 Inisialisasi database (opsional)

Jika Anda ingin menginisialisasi tabel dan seed data:

```bash
npm run init-db
npm run seed
```

### 2.5 Build backend

```bash
npm run build
```

---

## 3. Deploy Frontend

### 3.1 Salin kode frontend ke server

Simpan kode frontend di direktori yang nyaman, misalnya:

```bash
/home/ubuntu/presensi-frontend
```

### 3.2 Install dependency frontend

```bash
cd /home/ubuntu/presensi-frontend
npm install
```

### 3.3 Buat file environment frontend

Buat file `.env` di root frontend:

```env
VITE_API_URL=https://your-domain.com/api
```

> `your-domain.com` adalah domain publik tempat Apache melayani aplikasi.

### 3.4 Build frontend

```bash
npm run build
```

### 3.5 Salin hasil build ke Apache

Bersihkan folder Apache dan salin hasil build:

```bash
sudo rm -rf /var/www/html/*
sudo cp -r /home/ubuntu/presensi-frontend/dist/* /var/www/html/
```

---

## 4. Konfigurasi Apache sebagai Reverse Proxy

### 4.1 Aktifkan modul Apache yang dibutuhkan

```bash
sudo a2enmod proxy proxy_http rewrite headers ssl
sudo systemctl restart apache2
```

### 4.2 Buat virtual host Apache

Buat file konfigurasi baru, misalnya `/etc/apache2/sites-available/presensi.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/html

    ProxyPreserveHost On

    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ /index.html [L]

    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/

    ProxyPass /uploads/ http://127.0.0.1:3001/uploads/
    ProxyPassReverse /uploads/ http://127.0.0.1:3001/uploads/
</VirtualHost>
```

### 4.3 Aktifkan site dan reload Apache

```bash
sudo a2ensite presensi.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## 5. Jalankan Backend Secara Permanen dengan systemd

### 5.1 Buat unit service systemd

Buat file `/etc/systemd/system/presensi-backend.service`:

```ini
[Unit]
Description=Presensi Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/presensi-backend
EnvironmentFile=/home/ubuntu/presensi-backend/.env
ExecStart=/usr/bin/node /home/ubuntu/presensi-backend/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 5.2 Aktifkan dan jalankan service

```bash
sudo systemctl daemon-reload
sudo systemctl enable presensi-backend
sudo systemctl start presensi-backend
sudo systemctl status presensi-backend
```

---

## 6. Aktifkan HTTPS dengan Certbot

1. Install Certbot Apache plugin:

```bash
sudo apt install -y certbot python3-certbot-apache
```

2. Jalankan Certbot:

```bash
sudo certbot --apache -d your-domain.com
```

3. Ikuti instruksi untuk mengonfirmasi dan mengaktifkan HTTPS.

---

## 7. Pengujian Setelah Deploy

1. Buka `https://your-domain.com` dan pastikan aplikasi frontend muncul.
2. Buka `https://your-domain.com/api/healthz` untuk memeriksa backend.
3. Cek login, presensi check-in / check-out, dan tampilan foto upload.

---

## 8. Catatan Penting

- `FRONTEND_ORIGIN` di backend harus disesuaikan dengan domain publik frontend.
- `VITE_API_URL` di frontend harus menunjuk `https://your-domain.com/api`.
- Apache akan meneruskan `/api/` dan `/uploads/` ke backend.
- Backend tetap berjalan di port internal (`3001`) dan tidak langsung diakses publik.
- Jika domain berbeda untuk frontend dan backend, cookie session mungkin memerlukan `sameSite: none`.

---

## 9. Troubleshooting Singkat

- Jika frontend menampilkan halaman kosong, periksa `Console` browser dan `Network` di devtools.
- Jika login gagal, periksa respons `401` atau `403` dari `/api/auth/login`.
- Jika foto tidak tampil, pastikan `/uploads/` di-proxy ke backend dan backend menyajikan static path.
- Jika service backend mati, cek `sudo journalctl -u presensi-backend -e`.
