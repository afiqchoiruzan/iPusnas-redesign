# Sumber Data Metadata Buku (Katalog §6.2)

Dokumen ini mencatat hasil verifikasi metadata 12 buku pada `design.md` §6.2
(penulis, penerbit, tahun, halaman, ISBN) terhadap sumber publik, beserta rujukan
per buku. Ini adalah dokumen provenans untuk Task 3.1 (Req 8.11). **Dokumen ini
tidak menulis `data.js`** — pengisian data dilakukan di Task 3.2.

## Aturan pengisian

- Nilai diisi hanya bila dapat diverifikasi dari sumber publik yang wajar
  (situs penerbit/toko buku, katalog perpustakaan, Wikipedia, Goodreads, atau
  katalog retail seperti Amazon/AbeBooks).
- Field yang tidak dapat diverifikasi diisi `null` disertai alasan (Req 8.11:
  metadata yang tidak terverifikasi tidak boleh dikarang).
- Banyak judul punya beberapa cetakan/edisi. Tahun dicatat sebagai tahun terbit
  edisi pertama bila diketahui; ISBN merujuk pada satu edisi tertentu yang
  sumbernya tercatat. Bila jumlah halaman berbeda antaredisi dan tidak ada satu
  sumber tepercaya, field halaman diisi `null`.
- Konten dari web diparafrasekan; tautan sumber disertakan inline.
  Catatan: Konten dirangkum ulang untuk mematuhi batasan lisensi.

## Keputusan Q2 (judul yang dipertahankan)

Tabel §6.2 pada `design.md` mencantumkan `ronggeng-dukuh-paruk` dan `amba`
sebagai pengganti. Namun keputusan Q2 adalah **mempertahankan** dua judul asli
baseline — "Aroma Melati – Anita Diar" dan "Tejaimu – Tyas B. Hiarti" — apa adanya,
dan **tidak** menggantinya. Karena itu, katalog 12 buku pada Task 3.2 memakai
`aroma-melati` dan `tejaimu` di posisi dua entri terakhir, bukan Ronggeng Dukuh
Paruk / Amba. Untuk dua judul tersebut, setiap field yang tidak dapat
diverifikasi diisi `null` (lihat entri 11–12).

---

## 1. `gadis-kretek` — Gadis Kretek

| Field | Nilai | Status |
|---|---|---|
| Penulis | Ratih Kumala | terverifikasi |
| Penerbit | Gramedia Pustaka Utama | terverifikasi |
| Tahun | 2012 | terverifikasi |
| Halaman | `null` | tidak ada sumber tepercaya yang konsisten |
| ISBN | `null` | ISBN edisi asli tidak dapat dikonfirmasi dari sumber primer |

Penulis, penerbit, dan tahun 2012 konsisten di beberapa sumber akademik dan
ulasan: repositori tesis Universitas Jambi menyebut terbitan Gramedia Pustaka
Utama 2012 ([repository.unja.ac.id](https://repository.unja.ac.id/90304/2/ABSTRAK%20Tesis%20Azza.pdf)),
dan katalog penerjemah Jerman mencantumkan judul asli "Gadis Kretek, 2012"
([culturbooks.de](http://www.culturbooks.de/portfolio/ratih-kumala/)). Jumlah
halaman dan ISBN edisi Indonesia tidak ditemukan pada satu sumber tepercaya yang
konsisten, sehingga diisi `null`.

## 2. `laut-bercerita` — Laut Bercerita

| Field | Nilai | Status |
|---|---|---|
| Penulis | Leila S. Chudori | terverifikasi |
| Penerbit | Kepustakaan Populer Gramedia (KPG) | terverifikasi |
| Tahun | 2017 | terverifikasi |
| Halaman | `null` | tidak dikonfirmasi dari sumber tepercaya |
| ISBN | 978-602-424-694-5 | terverifikasi |

Katalog AbeBooks mencatat terbitan KPG 2017 dengan ISBN-13 9786024246945
(ISBN-10 6024246943)
([abebooks.com](https://www.abebooks.com/Laut-Bercerita-Indonesian-Edition-Chudori-Leila/32360895509/bd)).
Entri Wikipedia Leila Chudori dan daftar Goodreads mengonfirmasi novel ini terbit
2017 ([en.wikipedia.org/wiki/Leila_Chudori](https://en.wikipedia.org/wiki/Leila_Chudori),
[goodreads.com](https://www.goodreads.com/author/list/760524.Leila_S_Chudori)).
Katalog perpustakaan USNI mengonfirmasi penerbit Kepustakaan Populer Gramedia
([perpustakaan.usni.ac.id](https://www.perpustakaan.usni.ac.id/index.php?id=9572&keywords=&p=show_detail)).
Jumlah halaman tidak dikonfirmasi dari satu sumber tepercaya → `null`.

## 3. `cantik-itu-luka` — Cantik Itu Luka

| Field | Nilai | Status |
|---|---|---|
| Penulis | Eka Kurniawan | terverifikasi |
| Penerbit | Gramedia Pustaka Utama (edisi cetak ulang) | terverifikasi (edisi) |
| Tahun | 2002 (terbit pertama) | terverifikasi |
| Halaman | `null` | tidak dikonfirmasi konsisten |
| ISBN | 978-602-03-1258-3 | terverifikasi (edisi Gramedia "cover baru") |

UNESCO mencatat novel ini pertama terbit 2002
([unesco.org](https://www.unesco.org/es/articles/eka-kurniawan-seria-formidable-vivir-rodeado-de-gente-que-leyera-literatura-de-todo-el-mundo)).
Edisi cetak ulang Gramedia ("cover baru") tercatat di Amazon/AbeBooks dengan
ISBN-10 6020312585 → ISBN-13 978-602-03-1258-3
([amazon.com](https://us.amazon.com/Cantik-Luka-Cover-Baru-Indonesian/dp/6020312585),
[abebooks.com](https://www.abebooks.com/Cantik-Itu-Luka-Indonesian-Edition-Kurniawan/30853407354/bd)).
Catatan: edisi pertama (2002) diterbitkan sebelum Gramedia; ISBN di atas untuk
edisi cetak ulang. Jumlah halaman tidak dikonfirmasi → `null`.

## 4. `pulang` — Pulang

| Field | Nilai | Status |
|---|---|---|
| Penulis | Leila S. Chudori | terverifikasi |
| Penerbit | Kepustakaan Populer Gramedia (KPG) | terverifikasi |
| Tahun | 2012 | terverifikasi |
| Halaman | `null` | tidak dikonfirmasi dari sumber tepercaya |
| ISBN | `null` | ISBN edisi Indonesia tidak dikonfirmasi dari sumber primer |

Wikipedia Leila Chudori mencatat novel "Pulang" (2012) yang meraih Khatulistiwa
Literary Award; edisi terjemahan Inggris "Home" (Deep Vellum, 2015, ISBN
1941920101) juga tercatat di sana
([en.wikipedia.org/wiki/Leila_Chudori](https://en.wikipedia.org/wiki/Leila_Chudori)).
ISBN di Wikipedia merujuk edisi terjemahan, bukan edisi Indonesia KPG, sehingga
ISBN edisi Indonesia diisi `null`. Jumlah halaman tidak dikonfirmasi → `null`.

## 5. `laskar-pelangi` — Laskar Pelangi

| Field | Nilai | Status |
|---|---|---|
| Penulis | Andrea Hirata | terverifikasi |
| Penerbit | Bentang Pustaka | terverifikasi |
| Tahun | 2005 | terverifikasi |
| Halaman | `null` | sumber bervariasi (±529), tidak satu sumber tepercaya |
| ISBN | `null` | ISBN pada sumber tidak konsisten (varian salah ketik) |

Goodreads mencatat terbit pertama 2005
([goodreads.com](https://www.goodreads.com/book/show/16089274-the-rainbow-troops)),
dan sumber SEAsite NIU mencatat penerbit PT Bentang Pustaka, Yogyakarta
([seasite.niu.edu](https://seasite.niu.edu/flin/summary.htm)). Jumlah halaman
muncul sebagai ~529 di beberapa resensi, tetapi ISBN tampil dalam bentuk yang
tidak konsisten antarsumber (mis. "979-3062-79-7" vs "970-3062-79-7" yang jelas
salah ketik), sehingga halaman dan ISBN diisi `null` demi menghindari nilai yang
tidak dapat dipercaya.

## 6. `negeri-5-menara` — Negeri 5 Menara

| Field | Nilai | Status |
|---|---|---|
| Penulis | A. Fuadi (Ahmad Fuadi) | terverifikasi |
| Penerbit | Gramedia Pustaka Utama | terverifikasi |
| Tahun | 2009 | terverifikasi |
| Halaman | `null` | tidak dikonfirmasi dari sumber tepercaya |
| ISBN | `null` | ISBN edisi Indonesia tidak dikonfirmasi dari sumber primer |

Wikipedia Ahmad Fuadi menyebut novel debutnya diterbitkan Gramedia Pustaka Utama
([en.wikipedia.org/wiki/Ahmad_Fuadi](https://en.wikipedia.org/wiki/Ahmad_Fuadi));
daftar pustaka Universitas Negeri Medan mencatat Fuadi, A. 2009, Jakarta:
Gramedia Pustaka Utama
([digilib.unimed.ac.id](https://digilib.unimed.ac.id/25007/3/13.%208156111032%20%20BIBLIOGRAPHY.pdf)).
ISBN yang ditemukan (9789792275940) merujuk edisi terjemahan Inggris "The Land of
5 Towers" ([abebooks.com](https://www.abebooks.com/9789792275940/Land-Five-Towers-Ahmad-Fuadi-9792275940/plp)),
bukan edisi Indonesia, sehingga ISBN edisi Indonesia dan jumlah halaman diisi `null`.

## 7. `bumi-manusia` — Bumi Manusia

| Field | Nilai | Status |
|---|---|---|
| Penulis | Pramoedya Ananta Toer | terverifikasi |
| Penerbit | Hasta Mitra (terbit pertama 1980) | terverifikasi |
| Tahun | 1980 | terverifikasi |
| Halaman | `null` | banyak cetakan, tidak satu sumber tepercaya |
| ISBN | `null` | edisi pertama 1980 tanpa ISBN yang terkonfirmasi |

Wikipedia "This Earth of Mankind" dan arsip Internet Archive mencatat buku pertama
Tetralogi Buru ini pertama diterbitkan Hasta Mitra pada 1980
([en.wikipedia.org/wiki/This_Earth_of_Mankind](https://en.wikipedia.org/wiki/This_Earth_of_Mankind),
[archive.org](https://archive.org/details/bumi-manusia-pramoedya-ananta-toer_202504/mode/2up)).
Buku ini punya banyak cetakan (termasuk cetak ulang Lentera Dipantara); tidak ada
satu sumber tepercaya untuk jumlah halaman/ISBN edisi tertentu, sehingga keduanya
diisi `null`.

## 8. `perahu-kertas` — Perahu Kertas

| Field | Nilai | Status |
|---|---|---|
| Penulis | Dee Lestari (Dewi Lestari) | terverifikasi |
| Penerbit | Bentang Pustaka & Truedee Books | terverifikasi (edisi) |
| Tahun | 2009 | terverifikasi |
| Halaman | `null` | tidak dikonfirmasi konsisten |
| ISBN | 978-979-1227-78-0 | terverifikasi (satu sumber sekunder) |

Wikipedia Dewi Lestari mengonfirmasi penulis
([en.wikipedia.org/wiki/Dewi_Lestari](https://en.wikipedia.org/wiki/Dewi_Lestari)).
Satu resensi mencantumkan ISBN 978-979-1227-78-0
([starlovesifasa.wordpress.com](https://starlovesifasa.wordpress.com/2012/07/19/sinopsis-novel-perahu-kertas-karya-dewi-lestari/)).
Catatan: ISBN ini hanya ditemukan pada sumber sekunder (blog resensi) dan belum
dapat dibandingkan dengan katalog penerbit; dipakai dengan tingkat keyakinan
sedang. Jumlah halaman tidak dikonfirmasi → `null`.

## 9. `aroma-karsa` — Aroma Karsa

| Field | Nilai | Status |
|---|---|---|
| Penulis | Dee Lestari (Dewi Lestari) | terverifikasi |
| Penerbit | Bentang Pustaka | terverifikasi |
| Tahun | 2018 | terverifikasi |
| Halaman | 724 | terverifikasi |
| ISBN | 978-602-291-463-1 | terverifikasi |

StoryGraph mencatat edisi paperback: 724 halaman, terbit 2018, penerbit Bentang
Pustaka, ISBN 9786022914631
([thestorygraph.com](https://app.thestorygraph.com/favorites/geksa)); nilai ISBN
yang sama juga muncul di sumber lain
([docdroid.net](https://www.docdroid.net/mc6s1zc/download-epub-aroma-karsa-by-dee-lestari-pdf)).
Semua field terverifikasi.

## 10. `hujan` — Hujan

| Field | Nilai | Status |
|---|---|---|
| Penulis | Tere Liye | terverifikasi |
| Penerbit | Gramedia Pustaka Utama | terverifikasi |
| Tahun | 2016 (terbit pertama) | terverifikasi |
| Halaman | 320 | terverifikasi (edisi cover baru) |
| ISBN | 978-602-03-2478-4 | terverifikasi |

Goodreads mencatat edisi pertama 2016
([goodreads.com](https://www.goodreads.com/en/book/show/28446637)). Katalog Amazon
mencatat edisi cover baru: 320 halaman, penerbit Gramedia Pustaka Utama, ISBN-10
6020324788 → ISBN-13 978-6020324784
([amazon.de](https://www.amazon.de/Hujan-Tere-Liye/dp/6020324788)); satu resensi
mencatat ISBN 978-602-03-2478-4 untuk cetakan Indonesia
([scribd.com](https://www.scribd.com/document/616860305/Resensi-Naufal-Raihan-XI-MIPA-1-Copy)).
Catatan: dua ISBN tersebut merujuk cetakan berbeda; ISBN 978-602-03-2478-4 dipakai
untuk cetakan Indonesia. Jumlah halaman 320 untuk edisi cover baru.

## 11. `aroma-melati` — Aroma Melati  *(dipertahankan per Q2)*

| Field | Nilai | Status |
|---|---|---|
| Judul | Aroma Melati | dipertahankan apa adanya (Q2) |
| Penulis | Anita Diar | `null` — tidak terverifikasi |
| Penerbit | `null` | tidak terverifikasi |
| Tahun | `null` | tidak terverifikasi |
| Halaman | `null` | tidak terverifikasi |
| ISBN | `null` | tidak terverifikasi |

Pencarian publik untuk "Aroma Melati" oleh "Anita Diar" tidak menghasilkan satu
pun sumber tepercaya (katalog penerbit, perpustakaan, Goodreads, atau toko buku)
yang mengonfirmasi keberadaan buku ini atau penulisnya; hasil pencarian hanya
mengembalikan entri yang tidak relevan. Sesuai keputusan Q2, judul tetap
dipertahankan apa adanya dan **semua** field metadata yang tidak dapat
diverifikasi — termasuk penulis — diisi `null` (Req 8.11). Di `data.js` (Task 3.2),
field yang `null` tidak ditampilkan di UI, bukan dikarang.

## 12. `tejaimu` — Tejaimu  *(dipertahankan per Q2)*

| Field | Nilai | Status |
|---|---|---|
| Judul | Tejaimu | dipertahankan apa adanya (Q2) |
| Penulis | Tyas B. Hiarti | `null` — tidak terverifikasi |
| Penerbit | `null` | tidak terverifikasi |
| Tahun | `null` | tidak terverifikasi |
| Halaman | `null` | tidak terverifikasi |
| ISBN | `null` | tidak terverifikasi |

Pencarian publik untuk "Tejaimu" oleh "Tyas B. Hiarti" tidak menghasilkan sumber
tepercaya mana pun yang mengonfirmasi buku atau penulisnya; hasil hanya berupa
entri yang tidak relevan. Sesuai keputusan Q2, judul tetap dipertahankan apa
adanya dan **semua** field metadata yang tidak dapat diverifikasi — termasuk
penulis — diisi `null` (Req 8.11).

---

## Ringkasan terisi vs `null`

| id | Penulis | Penerbit | Tahun | Halaman | ISBN |
|---|---|---|---|---|---|
| gadis-kretek | ✔ | ✔ | ✔ | `null` | `null` |
| laut-bercerita | ✔ | ✔ | ✔ | `null` | ✔ |
| cantik-itu-luka | ✔ | ✔ (edisi) | ✔ | `null` | ✔ (edisi) |
| pulang | ✔ | ✔ | ✔ | `null` | `null` |
| laskar-pelangi | ✔ | ✔ | ✔ | `null` | `null` |
| negeri-5-menara | ✔ | ✔ | ✔ | `null` | `null` |
| bumi-manusia | ✔ | ✔ | ✔ | `null` | `null` |
| perahu-kertas | ✔ | ✔ (edisi) | ✔ | `null` | ✔ (sedang) |
| aroma-karsa | ✔ | ✔ | ✔ | ✔ | ✔ |
| hujan | ✔ | ✔ | ✔ | ✔ | ✔ |
| aroma-melati | `null` | `null` | `null` | `null` | `null` |
| tejaimu | `null` | `null` | `null` | `null` | `null` |

Keterangan: "(edisi)" = nilai valid untuk edisi/cetakan tertentu yang sumbernya
tercatat; "(sedang)" = keyakinan sedang karena hanya ditemukan pada sumber
sekunder. Field `null` tidak boleh dikarang dan tidak ditampilkan di UI (Req 8.11).
