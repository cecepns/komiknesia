# YuuCDN Cloudflare Worker Proxy & Caching

Worker ini berfungsi untuk mem-proxy request gambar dari YuuCDN dengan menyematkan header yang tepat (`access-code` dan `referer`) serta menyimpan (cache) respon gambar di Edge Network Cloudflare menggunakan Cache API.

Hal ini memecahkan masalah:
1. **IP VPS Terblokir**: Worker berjalan pada IP Cloudflare Edge.
2. **Hemat Bandwidth Webshare/Proxy**: Mengurangi request ke YuuCDN secara masif melalui mekanisme caching.
3. **Hemat Bandwidth VPS**: Gambar dikirimkan langsung dari Worker Cloudflare ke browser user tanpa melewati server backend NodeJS Anda.

---

## 🚀 Cara Setup dan Deploy

Pilih **salah satu** metode di bawah ini yang paling mudah menurut Anda:

### Metode A: Copy-Paste Langsung via Browser Dashboard (Sangat Direkomendasikan)
Metode ini tidak memerlukan command line atau instalasi tool apapun di komputer lokal Anda.

1. Buka file [`single-file-worker.js`](file:///Users/CODE/SP/komiknesia/yuucdn-cloudflare-worker/single-file-worker.js) lalu **Copy** semua kodenya.
2. Masuk ke **Cloudflare Dashboard** -> **Workers & Pages** -> Klik **Create Application** -> **Create Worker**.
3. Beri nama Worker (misalnya `yuucdn-proxy`) lalu klik **Deploy**.
4. Setelah di-deploy, klik **Edit Code** (Quick Edit) di halaman Worker tersebut.
5. Hapus semua kode default yang ada di dalam editor Cloudflare, lalu **Paste** kode yang tadi Anda salin.
6. Klik **Save and deploy**. Selesai!

---

### Metode B: Deploy via Command Line (Wrangler CLI)
Gunakan jika Anda ingin men-deploy project Wrangler standar:

1. Masuk ke direktori worker di terminal Anda:
   ```bash
   cd yuucdn-cloudflare-worker
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Login ke Cloudflare:
   ```bash
   npx wrangler login
   ```
4. Deploy:
   ```bash
   npx wrangler deploy
   ```

Setelah berhasil ter-deploy dengan salah satu metode di atas, Anda akan mendapatkan URL Worker Anda, contohnya:
`https://yuucdn-proxy.<your-subdomain>.workers.dev`

---

## ⚙️ Integrasi dengan Backend Komiknesia

Untuk mengarahkan semua url gambar YuuCDN langsung ke Cloudflare Worker:

1. Buka file `.env` di direktori backend NodeJS Anda.
2. Tambahkan variabel lingkungan baru dengan URL Worker Anda:
   ```env
   YUUCDN_WORKER_URL=https://yuucdn-proxy.<your-subdomain>.workers.dev
   ```
3. Restart backend NodeJS Anda.

---

## 🔍 Cara Verifikasi & Testing
Anda bisa mengetes performa caching dengan membuka url gambar secara langsung pada browser, misalnya:
`https://yuucdn-proxy.<your-subdomain>.workers.dev/wp-content/uploads/imgsc/m/mairimashita-iruma-kun/448/1.jpg`

Buka **Chrome DevTools -> Network**, klik pada request gambar, lalu periksa response headers-nya:
- **X-Proxy-Cache**:
  - `MISS` pada request pertama (worker mengambil gambar ke YuuCDN).
  - `HIT` pada request kedua dan seterusnya (gambar dilayani langsung dari Cache Cloudflare, instan dan hemat kuota).
