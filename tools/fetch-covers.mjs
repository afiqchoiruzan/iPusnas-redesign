/* Ambil sampul buku asli dari Open Library (katalog publik Internet Archive)
   dan simpan ke src/covers/<id>.jpg. Dijalankan sekali oleh pengembang. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'covers');
mkdirSync(OUT, { recursive: true });

// Judul + penulis + ISBN (bila ada) per id buku di data.js.
const BOOKS = [
  { id: 'gadis-kretek', title: 'The Cigarette Girl', author: 'Ratih Kumala' },
  { id: 'laut-bercerita', title: 'Laut Bercerita', author: 'Leila S. Chudori', isbn: '9786024246945' },
  { id: 'cantik-itu-luka', title: 'Cantik Itu Luka', author: 'Eka Kurniawan', isbn: '9786020312583' },
  { id: 'pulang', title: 'Pulang', author: 'Leila S. Chudori' },
  { id: 'laskar-pelangi', title: 'Laskar Pelangi', author: 'Andrea Hirata' },
  { id: 'negeri-5-menara', title: 'Negeri 5 Menara', author: 'Ahmad Fuadi' },
  { id: 'bumi-manusia', title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer' },
  { id: 'perahu-kertas', title: 'Perahu Kertas', author: 'Dee Lestari', isbn: '9789791227780' },
  { id: 'saman', title: 'Saman', author: 'Ayu Utami' },
  { id: 'hujan', title: 'Hujan', author: 'Tere Liye', isbn: '9786020324784' },
  { id: 'ronggeng-dukuh-paruk', title: 'Ronggeng Dukuh Paruk', author: 'Ahmad Tohari' },
  { id: 'amba', title: 'Amba', author: 'Laksmi Pamuntjak' },
];

async function coverIdFor(book) {
  // Coba ISBN dulu (paling akurat), lalu pencarian judul+penulis.
  if (book.isbn) {
    const r = await fetch(`https://openlibrary.org/isbn/${book.isbn}.json`).catch(() => null);
    if (r && r.ok) {
      const j = await r.json();
      if (j.covers && j.covers.length) return { type: 'id', value: j.covers[0] };
    }
  }
  const q = encodeURIComponent(book.title + ' ' + book.author);
  const r = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=5&fields=cover_i,cover_edition_key,title`).catch(() => null);
  if (r && r.ok) {
    const j = await r.json();
    const hit = (j.docs || []).find((d) => d.cover_i);
    if (hit) return { type: 'id', value: hit.cover_i };
  }
  return null;
}

async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1500) throw new Error('cover kosong/placeholder');
  return buf;
}

const results = [];
for (const book of BOOKS) {
  const dest = join(OUT, book.id + '.jpg');
  try {
    const cover = await coverIdFor(book);
    if (!cover) { results.push([book.id, 'TIDAK ADA']); continue; }
    const url = `https://covers.openlibrary.org/b/id/${cover.value}-L.jpg`;
    const buf = await download(url);
    writeFileSync(dest, buf);
    results.push([book.id, 'OK ' + buf.length + 'b (id ' + cover.value + ')']);
  } catch (e) {
    results.push([book.id, 'GAGAL: ' + e.message]);
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(results.map((r) => r[0].padEnd(22) + r[1]).join('\n'));
