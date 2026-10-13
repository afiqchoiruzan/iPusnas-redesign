#!/usr/bin/env node
/* ============================================================
   Screenshots — tools/screenshots.mjs
   ------------------------------------------------------------
   Mengambil screenshot setiap Halaman (glosarium requirements.md)
   pada tema terang dan gelap untuk spec "Humanized UI".

   - Playwright (sudah ada di package.json), tanpa dependency baru.
   - Viewport 390×844, deviceScaleFactor 2, reducedMotion 'reduce'.
   - Argumen: --out before|after (default: before).
   - Target: docs/humanize/screenshots/<out>/<page>-<theme>.png
   - Tema disetel lewat localStorage SEBELUM goto, halaman dibuka
     lewat page.evaluate(() => showPage(id)).

   Rujukan: requirements.md §Glosarium & Req 17.3, design.md §15.4.
   ============================================================ */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// URL file:// ke index.html (prototype harus bisa dibuka tanpa server).
const APP_URL = `file://${join(ROOT, 'index.html').replace(/\\/g, '/')}`;

// Kunci localStorage tema yang dipakai prototype.
const THEME_KEY = 'ipusnas-theme';

const VIEWPORT = { width: 390, height: 844 };
const THEMES = ['light', 'dark'];

// ------------------------------------------------------------
// Daftar target screenshot.
// id      : id Halaman (.page) yang dibuka lewat showPage(id).
// name    : nama file (<page>) pada hasil screenshot.
// setup   : (opsional) langkah tambahan setelah showPage, mis.
//           membuka sub-tab atau Filter_Sheet.
// Urutan mengikuti glosarium requirements.md + state khusus
// (Filter_Sheet terbuka, 3 tab Rak, 3 tab Komunitas) sesuai §13.
// ------------------------------------------------------------
const TARGETS = [
  { id: 'page-beranda', name: 'page-beranda' },
  { id: 'page-selengkapnya', name: 'page-selengkapnya' },
  { id: 'page-detail-buku', name: 'page-detail-buku' },

  // Rak Saya + 3 sub-tab (Pinjaman / Antrean / Riwayat).
  { id: 'page-rak-saya', name: 'page-rak-saya', subtab: { scope: '#page-rak-saya', index: 0 } },
  { id: 'page-rak-saya', name: 'page-rak-saya-pinjaman', subtab: { scope: '#page-rak-saya', index: 0 } },
  { id: 'page-rak-saya', name: 'page-rak-saya-antrean', subtab: { scope: '#page-rak-saya', index: 1 } },
  { id: 'page-rak-saya', name: 'page-rak-saya-riwayat', subtab: { scope: '#page-rak-saya', index: 2 } },

  // Komunitas + 3 sub-tab (Komunitas saya / Cari / Trending).
  { id: 'page-komunitas', name: 'page-komunitas', subtab: { scope: '#page-komunitas', index: 0 } },
  { id: 'page-komunitas', name: 'page-komunitas-saya', subtab: { scope: '#page-komunitas', index: 0 } },
  { id: 'page-komunitas', name: 'page-komunitas-cari', subtab: { scope: '#page-komunitas', index: 1 } },
  { id: 'page-komunitas', name: 'page-komunitas-trending', subtab: { scope: '#page-komunitas', index: 2 } },

  { id: 'page-profil', name: 'page-profil' },
  { id: 'page-edit-profil', name: 'page-edit-profil' },
  { id: 'page-pertemanan', name: 'page-pertemanan' },
  { id: 'page-bantuan', name: 'page-bantuan' },
  { id: 'page-pengaturan', name: 'page-pengaturan' },
  { id: 'page-syarat', name: 'page-syarat' },
  { id: 'page-kebijakan', name: 'page-kebijakan' },
  { id: 'page-ebook-reader', name: 'page-ebook-reader' },

  // Filter_Sheet terbuka (di atas Beranda).
  { id: 'page-beranda', name: 'filter-sheet', filterSheet: true },
];

// ------------------------------------------------------------
// Argumen CLI: --out before|after
// ------------------------------------------------------------
function parseArgs(argv) {
  let out = 'before';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    }
  }
  if (out !== 'before' && out !== 'after') {
    throw new Error(`Argumen --out harus "before" atau "after" (diterima: "${out}")`);
  }
  return { out };
}

// Terapkan tema lewat fungsi/dataset prototype sebagai pelengkap
// localStorage. Dibungkus try agar tahan terhadap variasi API tema.
function applyThemeInPage(theme) {
  try {
    const root = document.documentElement;
    const body = document.body;
    if (typeof setTheme === 'function') {
      setTheme(theme);
    }
    if (root) root.setAttribute('data-theme', theme);
    if (body) body.setAttribute('data-theme', theme);
  } catch (err) {
    /* abaikan: tema akan tetap mengikuti localStorage saat load */
  }
}

async function captureTarget(context, outDir, theme, target) {
  const page = await context.newPage();
  try {
    // Set tema lewat localStorage SEBELUM goto agar tidak ada kilatan
    // tema terang dan preferensi tersimpan saat halaman dimuat.
    await page.addInitScript(
      ([key, value]) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (err) {
          /* localStorage mungkin tidak tersedia; abaikan */
        }
      },
      [THEME_KEY, theme],
    );

    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Pastikan tema aktif meskipun skrip tema belum sempat berjalan.
    await page.evaluate(applyThemeInPage, theme).catch(() => {});

    // Buka Halaman lewat showPage(id).
    await page.evaluate((id) => {
      if (typeof showPage === 'function') showPage(id);
    }, target.id);

    // Buka sub-tab bila diminta.
    if (target.subtab) {
      await page.evaluate(({ scope, index }) => {
        const tabs = document.querySelectorAll(`${scope} .sub-tab`);
        if (tabs[index]) tabs[index].click();
      }, target.subtab);
    }

    // Buka Filter_Sheet bila diminta.
    if (target.filterSheet) {
      await page.evaluate(() => {
        if (typeof openFilterSheet === 'function') openFilterSheet();
      });
    }

    // Beri waktu singkat agar layout/scroll stabil (animasi sudah
    // dimatikan lewat reducedMotion).
    await page.waitForTimeout(250);

    const file = join(outDir, `${target.name}-${theme}.png`);
    await page.screenshot({ path: file });
    return file;
  } finally {
    await page.close();
  }
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  const outDir = join(ROOT, 'docs', 'humanize', 'screenshots', out);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });

  let count = 0;
  try {
    for (const theme of THEMES) {
      for (const target of TARGETS) {
        const file = await captureTarget(context, outDir, theme, target);
        count += 1;
        console.log(`✓ ${file}`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nSelesai: ${count} screenshot tersimpan di ${outDir}`);
}

main().catch((err) => {
  console.error(`Gagal mengambil screenshot: ${err.message}`);
  process.exitCode = 1;
});
