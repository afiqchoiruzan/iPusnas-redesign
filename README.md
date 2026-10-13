# iPusnas Redesign

Prototype redesign aplikasi iPusnas untuk mata kuliah Interaksi Manusia dan Komputer. Fokusnya pada pengalaman membaca digital yang terasa dirancang untuk pembaca Indonesia: warna dari logo iPusnas (navy dan hijau daun) di atas netral hangat seperti kertas, judul buku memakai serif Literata, dan antarmuka memakai Gantari.

Semua file prototype berada di root repository (bukan di dalam subfolder).

## Fitur

- Beranda: pencarian, filter dan urutkan, banner acara/koleksi, panel lanjut baca, strip pengingat jatuh tempo, baris rekomendasi, dan daftar peringkat buku paling banyak dipinjam.
- Detail buku: sinopsis dengan "Baca selengkapnya", info buku (`<details>`), ulasan pembaca, dan buku serupa.
- Logika peminjaman: Pinjam buku yang tersedia, Masuk/Keluar antrean untuk buku yang sedang dipinjam, dengan status yang sinkron antara Detail dan Rak saya.
- Rak saya: tab Pinjaman (dengan tanggal kembali otomatis), Antrean, dan Riwayat per bulan.
- Komunitas: Gabung/keluar komunitas, tab Komunitas saya yang mengikuti aksi tersebut, dan Trending dari aktivitas komunitas.
- Pertemanan: Ikuti/berhenti mengikuti pembaca lain, dengan jumlah pengikut/mengikuti dari data.
- Profil, ubah profil (menyimpan nama dan bio di memori), pengaturan, bantuan, serta dokumen Syarat & Ketentuan dan Kebijakan Privasi.
- Ebook reader prototype dengan tipografi Literata yang ikut tema terang/gelap.
- Mode terang dan gelap dengan preferensi tersimpan di `localStorage`.
- Tampilan responsif bergaya aplikasi mobile.

## Menjalankan prototype

Prototype memakai HTML, CSS, dan JavaScript tanpa build step. Buka `index.html` langsung di browser, atau pakai Live Server di VS Code.

Prototype dirancang jalan lewat `file://`, jadi `data.js` dan `script.js` dimuat sebagai classic script di akhir `index.html`.

Install dependency (Playwright, untuk audit screenshot dan recorder demo):

```bash
npm install
```

## Perkakas pemeriksaan

```bash
npm run audit:ui      # audit statis anti "AI-slop" + validasi data (0 error = lolos)
npm run screenshots -- --out after   # screenshot tiap halaman x 2 tema
npm run demo          # rekam video demo interaksi (Playwright)
```

`npm run audit:ui` memeriksa token warna/tipografi, larangan gradien/blur/animasi berlebih, copy (frasa klise, ejaan, tanda seru), aksesibilitas dasar, dan konsistensi data. Target 0 error; warn A26 (spasi) dan A32 (nama diri) ditinjau manual. Hasil terakhir disimpan di `docs/humanize/audit-after.txt`.

## Struktur repository

- `index.html` — kerangka seluruh halaman, kontainer render berbasis data, tanpa handler/gaya inline
- `style.css` — token desain, komponen, tema gelap, dan gerak
- `script.js` — helper, fungsi render, delegasi event, dan logika interaksi
- `data.js` — `window.IPUSNAS_DATA`, satu sumber kebenaran untuk buku, pinjaman, antrean, riwayat, ulasan, komunitas, dan pengguna
- `ebook-gadis-kretek.html` — reader; tema lewat `?theme=` dan `postMessage`
- `src/` — logo transparan (`logo-ipusnas.svg`, `logo-ipusnas-dark.svg`)
- `tools/` — `slop-audit.mjs` (audit) dan `screenshots.mjs`
- `docs/humanize/` — `audit-before.txt`, `audit-after.txt`, dan `screenshots/{before,after}/`
- `record-demo.js` — script Playwright untuk merekam demo
- `.kiro/steering/ui-humanized.md` — aturan desain yang dijaga saat mengubah UI

### Sampul buku

Sampul buku memakai jaket asli dari katalog publik Open Library (Internet Archive) yang disimpan di `src/covers/<id>.jpg` dan dirujuk lewat field `cover` di `data.js`. Untuk judul yang tidak punya sampul di katalog (atau judul fiktif pada prototype), tampilan jatuh ke sampul tipografis yang dirender dari judul dan penulis, sehingga prototype tetap utuh tanpa koneksi.

Jalankan `npm run covers` untuk mengambil ulang sampul (butuh koneksi; sumber Open Library). Atribusi sampul mengikuti ketentuan Open Library / penerbit terkait.

## Demo video

Video demo dibuat dalam format WebM dan disimpan di `demo-video/`. Folder tersebut di-ignore oleh Git agar file video tidak masuk repository.

## Repository

[https://github.com/AfiqMir/iPusnas-redesign](https://github.com/AfiqMir/iPusnas-redesign)
