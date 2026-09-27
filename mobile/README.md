# KomikNesia Mobile (React Native Expo JSX)

Aplikasi mobile resmi untuk membaca komik (Manga, Manhwa, Manhua) Bahasa Indonesia, dibangun menggunakan **React Native Expo** dengan **JSX**.

Aplikasi ini mengintegrasikan seluruh fitur frontend user-facing dari web KomikNesia tanpa menyertakan panel admin, dengan struktur clean architecture dan tampilan dark mode premium khas KomikNesia.

---

## 📱 Fitur Utama

1. **Beranda (HomeScreen)**:
   - Hero banner carousel dari KomikNesia.
   - Akses cepat komunitas (Discord, Instagram, Trending, Katalog).
   - Daftar Projek KomikNesia (komik resmi garapan tim).
   - Daftar Komik Paling Populer.
   - Update Chapter Terbaru (Grid).
   - Fitur Pull-to-Refresh.

2. **Katalog & Pencarian (ExploreScreen)**:
   - Pencarian komik dengan debounce input.
   - Filter tipe: Semua, Manhwa, Manga, Manhua.
   - Filter status: Semua, Ongoing, Completed.
   - Urutan: Update, Populer, A-Z, Z-A, Terbaru.
   - Modal pemilih Genre lengkap dari API.
   - Infinite scroll pagination.

3. **Komik Populer (PopularScreen)**:
   - Peringkat berdasar tab: Manhwa (KR), Manga (JP), Manhua (CN).
   - Kartu peringkat dengan medali rank (#1 Emas, #2 Perak, #3 Perunggu).
   - Tampilan rating bintang, jumlah view, dan status rilis.

4. **Perpustakaan (LibraryScreen)**:
   - **Bookmark**: Tersinkronisasi dengan akun KomikNesia.
   - **Riwayat**: Riwayat baca otomatis tersimpan di storage lokal saat membuka chapter.
   - **Readlist**: Pengelolaan daftar baca kustom (buat readlist & hapus readlist).

5. **Detail Komik (MangaDetailScreen)**:
   - Backdrop gambar blur & kartu komik dengan badge rating & status.
   - Tombol cepat: "Chapter Pertama" & "Chapter Terbaru".
   - Toggle bookmark langsung (otomatis sinkron ke server jika login).
   - Tag genre & ringkasan sinopsis (expand / collapse).
   - Widget reaksi (Senang, Biasa Aja, Kecewa, Marah, Sedih) terhubung ke API votes.
   - Daftar chapter interaktif: pencarian nomor chapter & sortir naik/turun.
   - Indikator chapter yang sudah pernah dibaca.
   - Proteksi chapter terkunci (chapter rilis < 2 jam bagi tamu).

6. **Pembaca Komik (ChapterReaderScreen)**:
   - Vertical Webtoon continuous strip reader dengan penyesuaian rasio gambar otomatis.
   - Tap layar untuk menampilkan/menyembunyikan bar kontrol atas & bawah.
   - Tombol Prev & Next chapter.
   - Drawer pemilih chapter untuk loncat langsung ke chapter lain.
   - Fitur **Auto-Scroll** dengan tombol play/pause.
   - Tombol bagikan chapter ke aplikasi lain.
   - Otomatis mencatat riwayat baca & penambahan view count.

7. **Akun Pengguna (AccountScreen)**:
   - Kartu profil pengguna: Avatar, Nama, @username, Email, Bio.
   - Badge keanggotaan VIP beserta tanggal kedaluwarsa.
   - Statistik komik yang telah dibaca & tanggal bergabung.
   - Modal Edit Profil: ubah nama, bio, dan ubah password.
   - Mode tamu: ajakan login/daftar dengan penjelasan benefit akun.
   - Pengaturan: Bersihkan cache lokal & tautan komunitas Discord.
   - Logout dengan konfirmasi.

8. **Autentikasi (Login, Register, Forgot Password)**:
   - Login dengan username/email & password.
   - Registrasi akun baru.
   - Lupa password & reset password via kode OTP.

---

## 🛠️ Struktur Direktori

```
mobile/
├── assets/                  # Icon, splash screen, adaptive icon
├── src/
│   ├── api/
│   │   └── client.js        # API Client, endpoint mapping, image resolver, AES decryptor
│   ├── constants/
│   │   ├── theme.js         # Design tokens (warna primer merah, midnight slate, radius, spacing)
│   │   └── reactions.js     # Definisi reaksi komik & chapter
│   ├── contexts/
│   │   └── AuthContext.jsx  # Auth provider (login, register, reset, profile update)
│   ├── navigation/
│   │   ├── AppNavigator.jsx # Root Stack Navigator
│   │   └── TabNavigator.jsx # Bottom Tab Navigator (5 tabs)
│   ├── screens/
│   │   ├── HomeScreen.jsx
│   │   ├── ExploreScreen.jsx
│   │   ├── PopularScreen.jsx
│   │   ├── LibraryScreen.jsx
│   │   ├── MangaDetailScreen.jsx
│   │   ├── ChapterReaderScreen.jsx
│   │   ├── AccountScreen.jsx
│   │   ├── LoginScreen.jsx
│   │   ├── RegisterScreen.jsx
│   │   └── ForgotPasswordScreen.jsx
│   ├── components/
│   │   ├── MangaCard.jsx
│   │   ├── ChapterItem.jsx
│   │   ├── CategoryPill.jsx
│   │   ├── SectionHeader.jsx
│   │   ├── SearchInput.jsx
│   │   ├── ReactionBar.jsx
│   │   └── EmptyState.jsx
│   └── utils/
│       ├── storage.js       # AsyncStorage wrapper
│       ├── decryptor.js     # AES Decryptor untuk response terenkripsi
│       ├── chapterAccess.js # Logika lock chapter < 2 jam bagi tamu
│       └── timeAgo.js       # Format waktu relatif Bahasa Indonesia
├── App.jsx                  # Main root component
├── app.json                 # Konfigurasi Expo & branding
└── package.json
```

---

## 🚀 Cara Menjalankan

Masuk ke folder `mobile/`:

```bash
cd mobile
```

Jalankan server Expo:

```bash
npm start
```

Pilihan menjalankan:
- **Android**: Tekan `a` atau jalankan `npm run android`
- **iOS**: Tekan `i` atau jalankan `npm run ios`
- **Scan QR**: Buka aplikasi **Expo Go** di smartphone Android / iOS dan pindai QR code di terminal.
