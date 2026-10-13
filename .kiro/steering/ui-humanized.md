---
inclusion: fileMatch
fileMatchPattern: ['*.html', '*.css', '*.js']
---

# Aturan UI humanized (iPusnas)

Prototype ini sudah dihumanisasi agar tidak terasa seperti keluaran generator UI.
Pertahankan prinsip berikut saat menyentuh `index.html`, `style.css`, `script.js`,
`data.js`, atau `ebook-gadis-kretek.html`.

## Token wajib
- Semua warna, `font-size`, `border-radius`, dan `box-shadow` memakai token di
  `:root` / `:root[data-theme="dark"]` pada `style.css`. Jangan menulis nilai
  literal (hex, px untuk radius/shadow) di luar blok token.
- Tema diatur di `<html data-theme>`. Jangan pindah ke `<body>`.

## Larangan gaya
- Tanpa gradien, kecuali dua yang di-allowlist: `.banner-slide__scrim` dan
  `.cover::after`.
- Tanpa `backdrop-filter`, `filter: blur`, `translateY(-...)`, atau `scale()`.
- Tanpa `:hover` di luar `@media (hover: hover) and (pointer: fine)`.
- Tanpa `transition: all` / `var(--transition)`; pakai transisi per properti.
- Blok `@media (prefers-reduced-motion: reduce)` harus tetap ada.

## Konten dan copy
- Bahasa Indonesia, sapaan "kamu" (kecuali dokumen legal yang memakai "Anda").
- Sentence case, tanpa tanda seru, tanpa emoji dekoratif.
- Hindari frasa klise: temukan, jelajahi, seru, yuk, luar biasa, terbaik, dll.
- Ejaan: "antrean" (bukan "antrian"), elipsis `…`, en dash `–` untuk rentang.

## Data satu sumber
- Angka, status, rating, dan daftar berasal dari `window.IPUSNAS_DATA` (`data.js`).
  Jangan menuliskan angka langsung di HTML. Render lewat fungsi `render*` di
  `script.js`.
- Interaksi (pinjam, antre, gabung komunitas, ikuti) mengubah state lalu
  memanggil render ulang; jaga agar Beranda, Detail, dan Rak tetap konsisten.

## Aksesibilitas
- Tanpa `onclick`/handler inline dan tanpa `style=` non-token di HTML; pakai
  delegasi `data-action` dan kelas CSS.
- Elemen yang bisa ditekan adalah `<button>` atau `<a>`. Ikon dekoratif memakai
  `aria-hidden="true"`. Sampul memakai alt/`aria-label` "Sampul {judul}".

## Verifikasi
- Jalankan `npm run audit:ui` setelah mengubah file dalam lingkup. Target: 0
  error. Warn A26 (spasi di luar skala) dan A32 (nama diri) ditinjau manual.
- Jalankan `node record-demo.js` untuk smoke test interaksi.
