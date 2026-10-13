#!/usr/bin/env node
/* ============================================================
   Slop_Audit — tools/slop-audit.mjs
   ------------------------------------------------------------
   Audit statis + validasi Katalog_Data + kontras WCAG untuk
   spec "Humanized UI (Anti AI-Slop)".

   - Node >= 18, tanpa dependency.
   - Memindai: index.html, style.css, script.js, data.js (bila ada),
     ebook-gadis-kretek.html.
   - Aturan A01-A34 (audit statis) dan D01-D11 (validasi data).
   - Output: "file:baris  ID  pesan" + ringkasan jumlah per aturan.
   - Exit 1 bila ada temuan level "error".
   - Flag --json untuk keluaran mesin.

   Rujukan: design.md §4 (token), §8.2 (frasa), §12 (tabel aturan).
   ============================================================ */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ------------------------------------------------------------
// Konfigurasi file dalam lingkup
// ------------------------------------------------------------
const FILES = {
  html: 'index.html',
  css: 'style.css',
  js: 'script.js',
  data: 'data.js',
  reader: 'ebook-gadis-kretek.html',
};

// ------------------------------------------------------------
// §4.1 Hex terlarang (baseline)
// ------------------------------------------------------------
const FORBIDDEN_HEX = `
#0f172a #1e293b #334155 #475569 #64748b #94a3b8 #cbd5e1 #e2e8f0 #f1f5f9 #f8fafc
#020617 #111827 #1f2937 #e5e7eb #6b7280 #0e7490 #0c4a6e #06b6d4 #ecfeff #cffafe
#059669 #065f46 #10b981 #34d399 #dcfce7 #166534 #d97706 #f59e0b #fef3c7 #92400e
#dc2626 #ef4444 #fee2e2 #991b1b #0284c7 #38bdf8 #7dd3fc #e0f2fe #075985 #3b82f6
#60a5fa #f43f5e #fb7185 #7c3aed #a78bfa #ea580c #f97316 #4054b8
`
  .trim()
  .split(/\s+/)
  .map((h) => h.toLowerCase());

// ------------------------------------------------------------
// §8.2 Frasa terlarang (tanpa peka huruf besar/kecil)
// ------------------------------------------------------------
const FORBIDDEN_PHRASES = [
  'temukan', 'jelajahi', 'seru', 'yuk', 'luar biasa', 'terbaik', 'tingkatkan',
  'dll.', 'follback', 'optimal', 'wajib baca', 'rekomendasi bacaan',
  'pengalaman membaca', 'kesempatan anda', 'silakan isikan', 'mari berdiskusi',
  'hampir tersedia', 'poin baca', 'customer service', 'self dev', 'review buku',
  'sekarang', 'antrian', ':)', ':(',
];

// ------------------------------------------------------------
// §4.9 Allowlist_Gradien (selector yang boleh memakai gradient)
// ------------------------------------------------------------
const GRADIENT_ALLOWLIST = ['.banner-slide__scrim', '.cover::after'];
const GRADIENT_MAX = 3;

// ------------------------------------------------------------
// §4.2 Pasangan token untuk cek kontras (A34)
// Tiap entri: token fg, token bg, ambang minimal, catatan.
// Nilai token diparsing dari blok :root dan :root[data-theme=dark].
// ------------------------------------------------------------
const CONTRAST_PAIRS = [
  { fg: '#FFFFFF', bg: '--color-primary', min: 4.5, label: 'teks putih di --color-primary' },
  { fg: '--color-link', bg: '--color-surface', min: 4.5, label: '--color-link di --color-surface' },
  { fg: '--color-accent', bg: '--color-surface', min: 4.5, label: '--color-accent di --color-surface' },
  { fg: '--color-warn-fg', bg: '--color-warn-bg', min: 4.5, label: '--color-warn-fg di --color-warn-bg' },
  { fg: '--color-danger-fg', bg: '--color-danger-bg', min: 4.5, label: '--color-danger-fg di --color-danger-bg' },
  { fg: '--color-text', bg: '--color-surface', min: 7, label: '--color-text di --color-surface' },
  { fg: '--color-text-2', bg: '--color-surface', min: 4.5, label: '--color-text-2 di --color-surface' },
  { fg: '--color-text-3', bg: '--color-surface-2', min: 4.5, label: '--color-text-3 di --color-surface-2' },
];

// Skala spasi yang diizinkan (A26)
const SPACE_SCALE = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40]);

// Deskripsi aturan untuk ringkasan
const RULE_LEVEL = {
  A01: 'error', A02: 'error', A03: 'error', A04: 'error', A05: 'error',
  A06: 'error', A07: 'error', A08: 'error', A09: 'error', A10: 'error',
  A11: 'error', A12: 'error', A13: 'error', A14: 'error', A15: 'error',
  A16: 'error', A17: 'error', A18: 'error', A19: 'error', A20: 'error',
  A21: 'error', A22: 'error', A23: 'error', A24: 'error', A25: 'error',
  A26: 'warn', A27: 'error', A28: 'error', A29: 'error', A30: 'error',
  A31: 'error', A32: 'warn', A33: 'error', A34: 'error',
  D01: 'error', D02: 'error', D03: 'error', D04: 'error', D05: 'error',
  D06: 'error', D07: 'error', D08: 'error', D09: 'error', D10: 'error',
  D11: 'error',
};

// ============================================================
// Pengumpul temuan
// ============================================================
const findings = [];
function report(file, line, id, message) {
  findings.push({
    file,
    line: line || 0,
    id,
    level: RULE_LEVEL[id] || 'error',
    message,
  });
}

// ============================================================
// Utilitas
// ============================================================
function readIfExists(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function lineAt(text, index) {
  // Nomor baris 1-indexed untuk posisi karakter `index`.
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function* matchAllWithLine(text, regex) {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    yield { match: m, line: lineAt(text, m.index), index: m.index };
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

// Hapus komentar CSS untuk analisis yang tidak boleh terganggu komentar.
function stripCssComments(css) {
  // Ganti isi komentar dengan spasi (pertahankan baris baru agar nomor baris stabil).
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

// Hapus komentar HTML.
function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

// ============================================================
// Parser blok CSS sederhana
// Melacak: selector, @media, blok token (:root / :root[data-theme=dark]).
// Dipakai oleh A03, A04, A08, A23-A25, A30.
// ============================================================
function parseCssBlocks(cssRaw) {
  const css = stripCssComments(cssRaw);
  const blocks = []; // { selector, bodyStart, bodyEnd, media, isTokenBlock, body }
  const stack = []; // untuk @media / nesting at-rule
  let i = 0;
  const n = css.length;

  while (i < n) {
    const ch = css[i];

    if (ch === '/' && css[i + 1] === '*') {
      // sudah di-strip, tapi jaga-jaga
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (ch === '@') {
      // at-rule: baca prelude sampai { atau ;
      let j = i;
      while (j < n && css[j] !== '{' && css[j] !== ';') j++;
      const prelude = css.slice(i, j).trim();
      if (css[j] === '{') {
        // at-rule berblok (mis. @media)
        stack.push({ prelude, atKind: prelude.split(/\s+/)[0] });
        i = j + 1;
      } else {
        // at-rule satu baris (mis. @import, @charset)
        i = j + 1;
      }
      continue;
    }

    if (ch === '}') {
      if (stack.length) stack.pop();
      i++;
      continue;
    }

    if (ch === '{') {
      // seharusnya tidak masuk sini tanpa selector; lewati
      i++;
      continue;
    }

    // Mungkin selector: baca sampai { atau } atau @ atau ;
    let j = i;
    while (j < n && css[j] !== '{' && css[j] !== '}' && css[j] !== '@') j++;

    if (css[j] === '{') {
      const selectorRaw = css.slice(i, j).trim();
      // temukan tutup kurung yang cocok
      let depth = 1;
      let k = j + 1;
      while (k < n && depth > 0) {
        if (css[k] === '{') depth++;
        else if (css[k] === '}') depth--;
        if (depth === 0) break;
        k++;
      }
      const bodyStart = j + 1;
      const bodyEnd = k;
      const body = css.slice(bodyStart, bodyEnd);

      if (selectorRaw) {
        const mediaStack = stack
          .filter((s) => s.atKind === '@media')
          .map((s) => s.prelude);
        const isTokenBlock = isRootSelector(selectorRaw) && mediaStack.length === 0;
        blocks.push({
          selector: selectorRaw,
          selectorIndex: i,
          selectorLine: lineAt(cssRaw, i),
          bodyStart,
          bodyEnd,
          body,
          media: mediaStack,
          isTokenBlock,
        });
      }
      i = bodyEnd + 1;
      continue;
    }

    i = j; // lanjut ke @ atau }
  }

  return blocks;
}

function isRootSelector(sel) {
  // :root atau :root[data-theme="dark"] (dengan atau tanpa kutip)
  const norm = sel.replace(/\s+/g, '').toLowerCase();
  return (
    norm === ':root' ||
    /^:root\[data-theme=("?)dark\1\]$/.test(norm)
  );
}

function selectorInAllowlist(sel) {
  // Selector gabungan bisa berisi beberapa; cek apakah salah satu allowlist.
  const parts = sel.split(',').map((s) => s.trim());
  return parts.some((p) => GRADIENT_ALLOWLIST.includes(p));
}

// ============================================================
// Konversi warna -> {r,g,b} untuk kontras
// ============================================================
function parseColor(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();

  // hex
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  // rgb()/rgba()
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length >= 3) {
      return {
        r: Number(parts[0]),
        g: Number(parts[1]),
        b: Number(parts[2]),
      };
    }
  }

  return null;
}

function relLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(c1, c2) {
  const L1 = relLuminance(c1);
  const L2 = relLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Ekstrak nilai token (custom property) dari blok :root dan :root[dark].
function extractTokens(blocks) {
  const light = {};
  const dark = {};
  for (const b of blocks) {
    if (!b.isTokenBlock) continue;
    const isDark = /\[data-theme/i.test(b.selector);
    const target = isDark ? dark : light;
    const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m;
    while ((m = re.exec(b.body)) !== null) {
      target[m[1].trim()] = m[2].trim();
    }
  }
  return { light, dark };
}

function resolveTokenColor(name, tokens) {
  // name bisa literal hex atau nama token (--...). Resolusi satu level var().
  if (!name) return null;
  if (name.startsWith('--')) {
    let val = tokens[name];
    if (!val) return null;
    const varMatch = val.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (varMatch) val = tokens[varMatch[1]] || val;
    return parseColor(val);
  }
  return parseColor(name);
}

// ============================================================
// ATURAN AUDIT STATIS (A01-A34)
// ============================================================
function runStaticRules(src) {
  const { html, css, js, reader } = src;

  // Teks "node" HTML sederhana: isi di antara > dan < (untuk A12,A13,A19,A20,A32,A33).
  const htmlTextNodes = (file, raw) => {
    if (!raw) return [];
    const stripped = stripHtmlComments(raw);
    const out = [];
    const re = />([^<]+)</g;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const txt = m[1];
      if (txt.trim()) out.push({ text: txt, index: m.index + 1, file, raw });
    }
    return out;
  };

  // ---- A01 Font Inter ----
  for (const [file, raw] of [[FILES.html, html], [FILES.css, css], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { line } of matchAllWithLine(raw, /\bInter\b/g)) {
      report(file, line, 'A01', 'font Inter dilarang (pakai Gantari/Literata)');
    }
  }

  // ---- A02 Hex terlarang ----
  for (const [file, raw] of Object.entries({ [FILES.html]: html, [FILES.css]: css, [FILES.js]: js, [FILES.reader]: reader })) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = match[0].toLowerCase();
      const norm6 = hex.length === 4
        ? '#' + hex.slice(1).split('').map((c) => c + c).join('')
        : hex;
      if (FORBIDDEN_HEX.includes(hex) || FORBIDDEN_HEX.includes(norm6)) {
        report(file, line, 'A02', `hex terlarang ${match[0]} (daftar §4.1)`);
      }
    }
  }

  // ---- Parser blok CSS (A03, A04, A08, A23-A25, A30) ----
  const cssBlocks = css ? parseCssBlocks(css) : [];

  // ---- A03 Literal warna di luar blok token ----
  // CSS: hex/rgb/hsl di luar :root/:root[dark], kecuali di deklarasi gradien allowlist.
  if (css) {
    for (const b of cssBlocks) {
      if (b.isTokenBlock) continue;
      const allowGradient = selectorInAllowlist(b.selector);
      const colorRe = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g;
      let m;
      while ((m = colorRe.exec(b.body)) !== null) {
        // Lewati bila berada di dalam deklarasi gradient pada selector allowlist.
        if (allowGradient) {
          const around = b.body.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60);
          if (/gradient\(/i.test(around)) continue;
        }
        const absIndex = b.bodyStart + m.index;
        report(FILES.css, lineAt(css, absIndex), 'A03',
          `literal warna "${m[0]}" di luar blok token (selector ${b.selector.slice(0, 40)})`);
      }
    }
  }
  // HTML/JS: semua hex dilarang (nilai warna harus lewat token/CSS).
  for (const [file, raw] of [[FILES.html, html], [FILES.js, js], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /#[0-9a-fA-F]{6}\b/g)) {
      report(file, line, 'A03', `literal warna "${match[0]}" di ${file} (pakai token/kelas)`);
    }
  }

  // ---- A04 Gradien ----
  if (css) {
    let total = 0;
    for (const b of cssBlocks) {
      const grads = [...b.body.matchAll(/gradient\(/gi)];
      if (!grads.length) continue;
      total += grads.length;
      if (!selectorInAllowlist(b.selector)) {
        report(FILES.css, b.selectorLine, 'A04',
          `gradien pada selector tak-ter-allowlist "${b.selector.slice(0, 40)}"`);
      }
    }
    if (total > GRADIENT_MAX) {
      report(FILES.css, 0, 'A04', `jumlah gradien ${total} melebihi batas ${GRADIENT_MAX}`);
    }
  }

  // ---- A05 backdrop-filter ----
  if (css) {
    for (const { line } of matchAllWithLine(css, /backdrop-filter\s*:/gi)) {
      report(FILES.css, line, 'A05', 'backdrop-filter dilarang (glassmorphism)');
    }
  }

  // ---- A06 filter: blur ----
  if (css) {
    for (const { line } of matchAllWithLine(css, /filter\s*:[^;]*blur\s*\(/gi)) {
      report(FILES.css, line, 'A06', 'filter: blur dilarang');
    }
  }

  // ---- A07 Lift/zoom: translateY(- atau scale( ----
  if (css) {
    for (const { line } of matchAllWithLine(css, /translateY\(\s*-/gi)) {
      report(FILES.css, line, 'A07', 'lift translateY(-...) dilarang');
    }
    for (const { line } of matchAllWithLine(css, /\bscale\(/gi)) {
      report(FILES.css, line, 'A07', 'zoom scale(...) dilarang');
    }
  }

  // ---- A08 :hover tanpa media query hover ----
  if (css) {
    for (const b of cssBlocks) {
      if (!/:hover\b/i.test(b.selector)) continue;
      const inHoverMedia = b.media.some((mq) => /\(\s*hover\s*:\s*hover\s*\)/i.test(mq));
      if (!inHoverMedia) {
        report(FILES.css, b.selectorLine, 'A08',
          `:hover di luar @media (hover: hover) "${b.selector.slice(0, 40)}"`);
      }
    }
  }

  // ---- A09 Transisi generik ----
  if (css) {
    for (const { match, line } of matchAllWithLine(css, /transition\s*:\s*([^;]+);/gi)) {
      const val = match[1].trim();
      if (/\ball\b/i.test(val)) {
        report(FILES.css, line, 'A09', 'transition: all dilarang');
      } else if (/var\(--transition\)/i.test(val)) {
        report(FILES.css, line, 'A09', 'transition: var(--transition) dilarang');
      } else {
        // transition tanpa nama properti (hanya durasi/easing) -> property pertama bukan ident
        const first = val.split(',')[0].trim().split(/\s+/)[0];
        if (!/^[a-z-]+$/i.test(first) || /^(\d|cubic-bezier|ease|linear|steps)/i.test(first)) {
          report(FILES.css, line, 'A09', `transition tanpa nama properti "${val.slice(0, 40)}"`);
        }
      }
    }
  }

  // ---- A10 Stagger: animation-delay ----
  if (css) {
    for (const { line } of matchAllWithLine(css, /animation-delay\s*:/gi)) {
      report(FILES.css, line, 'A10', 'animation-delay (stagger) dilarang');
    }
  }

  // ---- A11 Reduced motion harus ada ----
  if (css) {
    if (!/prefers-reduced-motion/i.test(css)) {
      report(FILES.css, 0, 'A11', 'blok @media (prefers-reduced-motion) tidak ada');
    }
  }

  // ---- A12 Emoji/simbol dekoratif di teks ----
  const decorRe = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}♠♣♥♦★☆✓✔]/u;
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    for (const node of htmlTextNodes(file, raw)) {
      if (decorRe.test(node.text)) {
        report(file, lineAt(node.raw, node.index), 'A12',
          `emoji/simbol dekoratif pada teks "${node.text.trim().slice(0, 30)}"`);
      }
    }
  }

  // ---- A13 Emotikon di teks ----
  const emoticonRe = /:\)|:\(|:D\b/;
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    for (const node of htmlTextNodes(file, raw)) {
      if (emoticonRe.test(node.text)) {
        report(file, lineAt(node.raw, node.index), 'A13',
          `emotikon pada teks "${node.text.trim().slice(0, 30)}"`);
      }
    }
  }

  // ---- A14 Foto stok / sampul ganda ----
  for (const [file, raw] of [[FILES.html, html], [FILES.js, js]]) {
    if (!raw) continue;
    for (const { line } of matchAllWithLine(raw, /\b(unsplash|pexels|picsum)\b/gi)) {
      report(file, line, 'A14', 'URL foto stok (unsplash/pexels/picsum) dilarang');
    }
  }
  // Sampul duplikat antarbuku divalidasi di D07 (dari data). Di sini cek
  // duplikasi URL gambar sampul kasar di HTML bila ada beberapa src identik.

  // ---- A15 Style inline (bukan custom property) ----
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /style\s*=\s*"([^"]*)"/gi)) {
      const content = match[1].trim();
      if (!content) continue;
      // Diizinkan hanya bila SEMUA deklarasi berupa custom property dinamis (--x: ...).
      const decls = content.split(';').map((d) => d.trim()).filter(Boolean);
      const allCustom = decls.every((d) => d.startsWith('--'));
      if (!allCustom) {
        report(file, line, 'A15', `style inline non-token "${content.slice(0, 40)}"`);
      }
    }
  }

  // ---- A16 Handler inline & tautan kosong ----
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /\son[a-z]+\s*=\s*"/gi)) {
      report(file, line, 'A16', `handler inline "${match[0].trim()}"`);
    }
    for (const { line } of matchAllWithLine(raw, /href\s*=\s*"#"/gi)) {
      report(file, line, 'A16', 'href="#" (tautan kosong)');
    }
  }

  // ---- A17 Alt dan dimensi gambar ----
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /<img\b[^>]*>/gi)) {
      const tag = match[0];
      const altMatch = tag.match(/\balt\s*=\s*"([^"]*)"/i);
      if (!altMatch) {
        report(file, line, 'A17', '<img> tanpa atribut alt');
      } else {
        const alt = altMatch[1].trim().toLowerCase();
        if (alt === '' || alt === 'cover' || alt === 'image' || alt === 'gambar') {
          report(file, line, 'A17', `alt generik "${altMatch[1]}"`);
        }
      }
      const hasW = /\bwidth\s*=/i.test(tag);
      const hasH = /\bheight\s*=/i.test(tag);
      if (!hasW || !hasH) {
        report(file, line, 'A17', '<img> tanpa width/height');
      }
    }
  }

  // ---- A18 Math.random ----
  if (js) {
    for (const { line } of matchAllWithLine(js, /Math\.random/g)) {
      report(FILES.js, line, 'A18', 'Math.random (acak) dilarang');
    }
  }

  // ---- A19 Frasa terlarang (teks HTML, string data.js, reader) ----
  const phraseTargets = [];
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    for (const node of htmlTextNodes(file, raw)) {
      phraseTargets.push({ file, text: node.text, line: lineAt(node.raw, node.index) });
    }
  }
  if (src.data) {
    for (const { match, line } of matchAllWithLine(src.data, /(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      phraseTargets.push({ file: FILES.data, text: match[2], line });
    }
  }
  for (const t of phraseTargets) {
    const low = t.text.toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      if (low.includes(phrase)) {
        report(t.file, t.line, 'A19', `frasa terlarang "${phrase}" (§8.2)`);
      }
    }
  }

  // ---- A20 Tanda seru di teks HTML & string data ----
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    for (const node of htmlTextNodes(file, raw)) {
      if (node.text.includes('!')) {
        report(file, lineAt(node.raw, node.index), 'A20',
          `tanda seru pada teks "${node.text.trim().slice(0, 30)}"`);
      }
    }
  }
  if (src.data) {
    for (const { match, line } of matchAllWithLine(src.data, /(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (match[2].includes('!')) {
        report(FILES.data, line, 'A20', `tanda seru pada string "${match[2].slice(0, 30)}"`);
      }
    }
  }

  // ---- A21 Register "Anda" di luar #page-syarat / #page-kebijakan ----
  if (html) {
    // Tentukan rentang indeks dari section legal untuk pengecualian.
    const legalRanges = [];
    for (const id of ['page-syarat', 'page-kebijakan']) {
      const re = new RegExp(`id=["']${id}["']`, 'i');
      const m = html.match(re);
      if (m) {
        // Perkiraan rentang: dari id sampai 6000 karakter berikutnya atau akhir.
        const start = m.index;
        legalRanges.push([start, start + 8000]);
      }
    }
    const inLegal = (idx) => legalRanges.some(([a, b]) => idx >= a && idx <= b);
    for (const { match, line, index } of matchAllWithLine(html, /\bAnda\b/g)) {
      if (!inLegal(index)) {
        report(FILES.html, line, 'A21', 'register "Anda" di luar dokumen legal');
      }
    }
  }

  // ---- A22 Weight berlebih ----
  if (css) {
    for (const { line } of matchAllWithLine(css, /font-weight\s*:\s*(800|900)\b/gi)) {
      report(FILES.css, line, 'A22', 'font-weight 800/900 dilarang');
    }
  }

  // ---- A23 Font-size literal (di luar blok token) ----
  // ---- A24 Radius literal ----
  // ---- A25 Bayangan literal ----
  if (css) {
    for (const b of cssBlocks) {
      if (b.isTokenBlock) continue;

      // A23
      for (const m of b.body.matchAll(/font-size\s*:\s*([^;]+);/gi)) {
        const val = m[1].trim();
        if (!/var\(--fs-/i.test(val)) {
          report(FILES.css, lineAt(css, b.bodyStart + m.index), 'A23',
            `font-size literal "${val.slice(0, 30)}" (pakai var(--fs-*))`);
        }
      }
      // A24
      for (const m of b.body.matchAll(/border-radius\s*:\s*([^;]+);/gi)) {
        const val = m[1].trim();
        const isToken = /var\(--radius-/i.test(val);
        const isZero = /^0(px)?$/i.test(val);
        if (!isToken && !isZero) {
          report(FILES.css, lineAt(css, b.bodyStart + m.index), 'A24',
            `border-radius literal "${val.slice(0, 30)}" (pakai var(--radius-*) atau 0)`);
        }
      }
      // A25
      for (const m of b.body.matchAll(/box-shadow\s*:\s*([^;]+);/gi)) {
        const val = m[1].trim();
        const isToken = /var\(--shadow-/i.test(val);
        const isNone = /^none$/i.test(val);
        const isRing = /^0\s+0\s+0\b/.test(val); // ring 0 0 0 ...
        if (!isToken && !isNone && !isRing) {
          report(FILES.css, lineAt(css, b.bodyStart + m.index), 'A25',
            `box-shadow literal "${val.slice(0, 30)}" (pakai var(--shadow-*)/none/ring)`);
        }
      }
    }
  }

  // ---- A26 Spasi di luar skala (warn) ----
  if (css) {
    const propRe = /\b(margin|margin-top|margin-right|margin-bottom|margin-left|padding|padding-top|padding-right|padding-bottom|padding-left|gap|row-gap|column-gap)\s*:\s*([^;]+);/gi;
    for (const { match, line } of matchAllWithLine(css, propRe)) {
      const val = match[2];
      for (const tok of val.split(/\s+/)) {
        const pm = tok.match(/^(-?\d+(?:\.\d+)?)px$/i);
        if (pm) {
          const num = Math.abs(Number(pm[1]));
          if (!SPACE_SCALE.has(num)) {
            report(FILES.css, line, 'A26',
              `nilai spasi ${tok} di luar skala (${match[1]})`);
          }
        }
      }
    }
  }

  // ---- A27 Kelas mati ----
  if (css) {
    runDeadClassRule(cssBlocks, { html, js, reader });
  }

  // ---- A28 Jam klise 09:41 ----
  for (const [file, raw] of [[FILES.html, html], [FILES.js, js], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { line } of matchAllWithLine(raw, /09:41/g)) {
      report(file, line, 'A28', 'jam klise "09:41"');
    }
  }

  // ---- A29 Komentar jejak generator ----
  const genRe = /\(NEW\)|WA STYLE|Basic .*? interactions|Bottom Sheet Logic/gi;
  for (const [file, raw] of [[FILES.html, html], [FILES.css, css], [FILES.js, js], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, genRe)) {
      report(file, line, 'A29', `komentar jejak generator "${match[0]}"`);
    }
  }

  // ---- A30 Kicker kapital (text-transform: uppercase) <= 1 ----
  if (css) {
    const upper = [];
    for (const b of cssBlocks) {
      if (/text-transform\s*:\s*uppercase/i.test(b.body)) {
        upper.push(b);
      }
    }
    if (upper.length > 1) {
      for (const b of upper) {
        report(FILES.css, b.selectorLine, 'A30',
          `text-transform: uppercase pada "${b.selector.slice(0, 40)}" (maks 1 selector, ada ${upper.length})`);
      }
    }
  }

  // ---- A31 Spacer div dengan height ----
  for (const [file, raw] of [[FILES.html, html], [FILES.reader, reader]]) {
    if (!raw) continue;
    for (const { match, line } of matchAllWithLine(raw, /<div\b([^>]*)>\s*<\/div>/gi)) {
      if (/height\s*:/i.test(match[1]) || /\bheight\s*=/i.test(match[1])) {
        report(file, line, 'A31', 'spacer div dengan height');
      }
    }
  }

  // ---- A32 Title Case heuristik (warn) ----
  if (html) {
    const allowlist = buildTitleAllowlist(src);
    const headingRe = /<(h[1-4]|button)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    for (const { match, line } of matchAllWithLine(html, headingRe)) {
      const inner = match[2].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim();
      if (!inner) continue;
      const words = inner.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w));
      const capWords = words.filter((w) => /^[A-ZÀ-Þ]/.test(w) && !allowlist.has(w.replace(/[^\wÀ-ÿ-]/g, '')));
      if (capWords.length >= 2) {
        report(FILES.html, line, 'A32',
          `kemungkinan Title Case "${inner.slice(0, 40)}" (${capWords.length} kata kapital)`);
      }
    }
  }

  // ---- A33 Ejaan: "antrian", "..." sebagai pengganti "…" ----
  for (const [file, raw] of [[FILES.html, html], [FILES.js, js], [FILES.reader, reader], [FILES.data, src.data]]) {
    if (!raw) continue;
    for (const { line } of matchAllWithLine(raw, /antrian/gi)) {
      report(file, line, 'A33', 'ejaan "antrian" (pakai "antrean")');
    }
    for (const { line } of matchAllWithLine(raw, /\.\.\./g)) {
      report(file, line, 'A33', 'tiga titik "..." (pakai "…" U+2026)');
    }
  }

  // ---- A34 Kontras WCAG dari token ----
  runContrastRule(cssBlocks);
}

// ------------------------------------------------------------
// A27 Kelas mati — pembantu
// ------------------------------------------------------------
function runDeadClassRule(cssBlocks, { html, js, reader }) {
  const STATE_ALLOW = /^(active|open|show)$/;
  const isStateClass = (c) => STATE_ALLOW.test(c) || c.startsWith('is-');

  // Kumpulkan kelas yang dipakai di HTML/JS/reader.
  const usedClasses = new Set();
  const collectFromHtml = (raw) => {
    if (!raw) return;
    for (const m of raw.matchAll(/class\s*=\s*"([^"]*)"/gi)) {
      m[1].split(/\s+/).forEach((c) => c && usedClasses.add(c));
    }
  };
  collectFromHtml(html);
  collectFromHtml(reader);
  if (js) {
    // classList.add/remove/toggle('x'), className = 'x y', dan string kelas umum.
    for (const m of js.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*([^)]*)\)/gi)) {
      for (const s of m[1].matchAll(/['"`]([^'"`]+)['"`]/g)) {
        s[1].split(/\s+/).forEach((c) => c && usedClasses.add(c));
      }
    }
    for (const m of js.matchAll(/class\s*=\s*\\?["']([^"'\\]+)/gi)) {
      m[1].split(/\s+/).forEach((c) => c && usedClasses.add(c));
    }
    // template literal berisi class="..."
    for (const m of js.matchAll(/class=["']([^"']+)["']/gi)) {
      m[1].split(/\s+/).forEach((c) => c && usedClasses.add(c));
    }
  }

  // Kelas yang didefinisikan di CSS.
  const definedClasses = new Map(); // class -> line
  for (const b of cssBlocks) {
    for (const sel of b.selector.split(',')) {
      for (const m of sel.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
        if (!definedClasses.has(m[1])) definedClasses.set(m[1], b.selectorLine);
      }
    }
  }

  // Kelas di CSS yang tidak ada di HTML/JS (kecuali state).
  for (const [cls, line] of definedClasses) {
    if (isStateClass(cls)) continue;
    if (!usedClasses.has(cls)) {
      report(FILES.css, line, 'A27', `kelas CSS mati ".${cls}" (tidak dipakai di HTML/JS)`);
    }
  }

  // Kelas di HTML tanpa definisi CSS/penggunaan JS (kecuali state).
  // Perkiraan: kelas HTML yang tidak ada di CSS dan tidak dirujuk JS.
  const htmlClassLines = new Map();
  const scanHtmlClasses = (file, raw) => {
    if (!raw) return;
    for (const m of matchAllWithLine(raw, /class\s*=\s*"([^"]*)"/gi)) {
      for (const c of m.match[1].split(/\s+/)) {
        if (c && !htmlClassLines.has(c)) htmlClassLines.set(c, { file, line: m.line });
      }
    }
  };
  scanHtmlClasses(FILES.html, html);
  scanHtmlClasses(FILES.reader, reader);

  const jsRefersClass = (cls) => {
    if (!js) return false;
    return new RegExp(`['"\`]${cls.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}['"\`.: ]`).test(js);
  };

  for (const [cls, { file, line }] of htmlClassLines) {
    if (isStateClass(cls)) continue;
    if (!definedClasses.has(cls) && !jsRefersClass(cls)) {
      report(file, line, 'A27', `kelas HTML ".${cls}" tanpa definisi CSS/JS`);
    }
  }
}

// ------------------------------------------------------------
// A32 allowlist — nama diri dari judul buku & nama komunitas
// ------------------------------------------------------------
function buildTitleAllowlist(src) {
  const allow = new Set([
    'iPusnas', 'ISBN', 'Trending', 'WIB', 'UGM', 'Book', 'Club',
    'A', 'Z', 'FAQ',
  ]);
  const data = src.dataObj;
  if (data) {
    const addWords = (str) => {
      if (typeof str !== 'string') return;
      str.split(/\s+/).forEach((w) => allow.add(w.replace(/[^\wÀ-ÿ-]/g, '')));
    };
    (data.books || []).forEach((b) => { addWords(b.title); addWords(b.author); });
    (data.communities || []).forEach((c) => addWords(c.name));
    (data.user && addWords(data.user.name));
  }
  return allow;
}

// ------------------------------------------------------------
// A34 Kontras — pembantu
// ------------------------------------------------------------
function runContrastRule(cssBlocks) {
  const { light, dark } = extractTokens(cssBlocks);
  if (!Object.keys(light).length) {
    report(FILES.css, 0, 'A34', 'blok token :root tidak ditemukan; kontras tidak dapat dihitung');
    return;
  }
  for (const theme of [['terang', light], ['gelap', { ...light, ...dark }]]) {
    const [name, tokens] = theme;
    for (const pair of CONTRAST_PAIRS) {
      const fg = resolveTokenColor(pair.fg, tokens);
      const bg = resolveTokenColor(pair.bg, tokens);
      if (!fg || !bg) continue; // token belum ada -> dilewati (akan muncul saat lengkap)
      const ratio = contrastRatio(fg, bg);
      if (ratio < pair.min) {
        report(FILES.css, 0, 'A34',
          `kontras ${name} ${pair.label} = ${ratio.toFixed(2)}:1 (< ${pair.min}:1)`);
      }
    }
  }
}

// ============================================================
// VALIDASI DATA (D01-D11) — menjalankan data.js & helper via vm
// ============================================================
function runDataRules(src) {
  if (!src.data) {
    report(FILES.data, 0, 'D01', 'data.js belum ada');
    return;
  }

  // Jalankan data.js di sandbox dengan stub window/document.
  let data;
  try {
    data = evalDataFile(src.data);
  } catch (err) {
    report(FILES.data, 0, 'D01', `data.js gagal dieksekusi: ${err.message}`);
    return;
  }
  if (!data) {
    report(FILES.data, 0, 'D01', 'window.IPUSNAS_DATA tidak terdefinisi di data.js');
    return;
  }
  src.dataObj = data;

  // Muat helper murni dari script.js (bila ada).
  const helpers = src.js ? loadHelpers(src.js) : {};

  const books = data.books || [];
  const bookIds = new Set(books.map((b) => b.id));
  const getBook = (id) => books.find((b) => b.id === id);

  // ---- D02 Referensi ----
  const refSources = [
    ['loans', data.loans], ['queue', data.queue], ['history', data.history],
    ['reviews', data.reviews], ['trending', data.trending], ['banners', data.banners],
  ];
  for (const [srcName, arr] of refSources) {
    for (const item of arr || []) {
      const id = item.bookId;
      if (id == null) continue; // banner bisa tanpa bookId
      if (!bookIds.has(id)) {
        report(FILES.data, 0, 'D02', `bookId "${id}" di ${srcName} tidak ada di books`);
      }
    }
  }

  // ---- D01 Progres ----
  for (const loan of data.loans || []) {
    const book = getBook(loan.bookId);
    if (!book) continue;
    let pct;
    if (typeof helpers.progressPct === 'function') {
      try { pct = helpers.progressPct(loan, book); } catch { pct = null; }
    }
    if (pct == null && book.pages) {
      pct = Math.round((loan.currentPage / book.pages) * 100);
    }
    if (pct == null) continue;
    if (pct < 0 || pct > 100) {
      report(FILES.data, 0, 'D01', `progres ${loan.bookId} = ${pct}% di luar 0-100`);
    }
  }

  // ---- D03 Kontradiksi status ----
  const loanIds = new Set((data.loans || []).map((l) => l.bookId));
  for (const loan of data.loans || []) {
    const borrowed = Date.parse(loan.borrowedAt);
    for (const h of data.history || []) {
      if (h.bookId !== loan.bookId) continue;
      const hFrom = Date.parse(h.from);
      const hTo = Date.parse(h.to);
      // tumpang tindih dengan masa pinjam, atau riwayat setelah borrowedAt
      if ((hTo >= borrowed) || (hFrom >= borrowed)) {
        report(FILES.data, 0, 'D03',
          `buku "${loan.bookId}" ada di loans sekaligus history yang tumpang tindih/sesudah borrowedAt`);
        break;
      }
    }
  }
  for (const q of data.queue || []) {
    if (loanIds.has(q.bookId)) {
      report(FILES.data, 0, 'D03', `buku "${q.bookId}" ada di queue sekaligus loans`);
    }
  }

  // ---- D04 Antrean ----
  for (const q of data.queue || []) {
    if (!(q.position >= 1 && q.position <= q.total)) {
      report(FILES.data, 0, 'D04', `antrean "${q.bookId}" posisi ${q.position}/${q.total} tidak valid`);
    }
  }

  // ---- D05 Rating ----
  const ratings = books.map((b) => b.rating).filter((r) => typeof r === 'number');
  for (const b of books) {
    if (typeof b.rating === 'number' && !(b.rating >= 1 && b.rating <= 5)) {
      report(FILES.data, 0, 'D05', `rating "${b.id}" = ${b.rating} di luar 1-5`);
    }
  }
  if (ratings.length) {
    const spread = Math.max(...ratings) - Math.min(...ratings);
    if (spread < 0.8) {
      report(FILES.data, 0, 'D05', `sebaran rating ${spread.toFixed(2)} < 0,8 (terlalu seragam)`);
    }
  }

  // ---- D06 Jumlah ulasan ----
  const counts = books.map((b) => b.ratingCount).filter((n) => typeof n === 'number');
  if (counts.length) {
    const allHundreds = counts.every((n) => n % 100 === 0);
    if (allHundreds) {
      report(FILES.data, 0, 'D06', 'semua ratingCount kelipatan 100 (terlalu bulat)');
    }
    const below1000 = counts.filter((n) => n < 1000).length;
    if (below1000 < 3) {
      report(FILES.data, 0, 'D06', `hanya ${below1000} ratingCount < 1.000 (butuh >= 3)`);
    }
  }

  // ---- D07 Sampul unik ----
  const covers = books.map((b) => b.cover).filter((c) => c != null);
  const seen = new Map();
  for (const b of books) {
    if (b.cover == null) continue;
    if (seen.has(b.cover)) {
      report(FILES.data, 0, 'D07',
        `cover duplikat "${b.cover}" ("${b.id}" & "${seen.get(b.cover)}")`);
    } else {
      seen.set(b.cover, b.id);
    }
  }

  // ---- D08 Ulasan ----
  const reviews = data.reviews || [];
  if (reviews.length) {
    const hasLow = reviews.some((r) => typeof r.rating === 'number' && r.rating <= 3);
    if (!hasLow) {
      report(FILES.data, 0, 'D08', 'tidak ada ulasan dengan rating <= 3');
    }
    const lengths = reviews.map((r) => (r.text || '').length).filter((l) => l > 0);
    if (lengths.length) {
      const ratio = Math.max(...lengths) / Math.min(...lengths);
      if (ratio < 2) {
        report(FILES.data, 0, 'D08',
          `variasi panjang ulasan ${ratio.toFixed(2)} < 2 (terlalu seragam)`);
      }
    }
  }

  // ---- D09 Tanggal ----
  const today = data.today ? Date.parse(data.today) : NaN;
  const isValidIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (data.today && !isValidIso(data.today)) {
    report(FILES.data, 0, 'D09', `today "${data.today}" bukan ISO valid`);
  }
  for (const loan of data.loans || []) {
    for (const key of ['borrowedAt', 'dueAt']) {
      if (loan[key] && !isValidIso(loan[key])) {
        report(FILES.data, 0, 'D09', `loan.${key} "${loan[key]}" bukan ISO valid`);
      }
    }
    if (!Number.isNaN(today) && loan.dueAt && Date.parse(loan.dueAt) <= today) {
      report(FILES.data, 0, 'D09', `pinjaman "${loan.bookId}" dueAt ${loan.dueAt} tidak > today`);
    }
  }
  for (const h of data.history || []) {
    for (const key of ['from', 'to']) {
      if (h[key] && !isValidIso(h[key])) {
        report(FILES.data, 0, 'D09', `history.${key} "${h[key]}" bukan ISO valid`);
      }
    }
    if (!Number.isNaN(today) && h.to && Date.parse(h.to) >= today) {
      report(FILES.data, 0, 'D09', `riwayat "${h.bookId}" to ${h.to} tidak < today`);
    }
  }

  // ---- D10 Pengguna ----
  if (!data.user || !Array.isArray(data.user.followers) || !Array.isArray(data.user.following)) {
    report(FILES.data, 0, 'D10', 'user.followers/following harus array (sumber angka profil)');
  }

  // ---- D11 Metadata ----
  for (const b of books) {
    for (const key of ['publisher', 'year', 'isbn']) {
      const v = b[key];
      if (v == null) continue;
      const okType = (key === 'year') ? (typeof v === 'number') : (typeof v === 'string');
      if (!okType) {
        report(FILES.data, 0, 'D11', `${b.id}.${key} bertipe salah (string/angka atau null)`);
      }
    }
    if (typeof b.isbn === 'string') {
      const digits = b.isbn.replace(/[-\s]/g, '');
      if (digits.length === 13 && /^\d{13}$/.test(digits)) {
        if (!isbn13Valid(digits)) {
          report(FILES.data, 0, 'D11', `${b.id}.isbn "${b.isbn}" gagal checksum ISBN-13`);
        }
      }
    }
  }
}

function isbn13Valid(digits) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

// ------------------------------------------------------------
// Jalankan data.js lewat vm dengan stub window/document.
// data.js adalah classic script: window.IPUSNAS_DATA = {...}
// ------------------------------------------------------------
function evalDataFile(code) {
  const win = {};
  const doc = makeDocumentStub();
  const sandbox = {
    window: win,
    document: doc,
    localStorage: makeStorageStub(),
    console,
    Intl,
    Date,
    Math,
  };
  win.window = win;
  win.document = doc;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'data.js', timeout: 2000 });
  return sandbox.window.IPUSNAS_DATA || sandbox.IPUSNAS_DATA || null;
}

// ------------------------------------------------------------
// Muat helper murni dari script.js lewat vm.
// Mengekstrak deklarasi fungsi helper yang disebut di §6.1 bila ada,
// lalu mengekspornya. Pendekatan: jalankan seluruh script.js dalam
// sandbox dengan stub, lalu ambil fungsi yang bocor ke scope global vm.
// ------------------------------------------------------------
const HELPER_NAMES = [
  'escapeHtml', 'progressPct', 'daysUntil', 'dueSeverity', 'fmtNumber',
  'fmtCompact', 'fmtRating', 'fmtDateRange', 'avatarIndex', 'coverIndex', 'getBook',
];

function loadHelpers(code) {
  const win = {};
  const doc = makeDocumentStub();
  const sandbox = {
    window: win,
    document: doc,
    localStorage: makeStorageStub(),
    console: { log() {}, warn() {}, error() {} },
    Intl, Date, Math, JSON, Array, Object, String, Number,
    setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame() {}, addEventListener() {},
  };
  win.window = win;
  win.document = doc;
  win.addEventListener = () => {};
  win.IPUSNAS_DATA = undefined;
  const helpers = {};
  try {
    vm.createContext(sandbox);
    // Tambahkan ekspor eksplisit di akhir untuk menangkap fungsi helper.
    const exportTail =
      '\n;(function(){try{var __h={};' +
      HELPER_NAMES.map((n) => `try{__h.${n}=${n};}catch(e){}`).join('') +
      'this.__HELPERS__=__h;}catch(e){this.__HELPERS__={};}}).call(this);';
    vm.runInContext(code + exportTail, sandbox, { filename: 'script.js', timeout: 2000 });
    const found = sandbox.__HELPERS__ || {};
    for (const name of HELPER_NAMES) {
      if (typeof found[name] === 'function') helpers[name] = found[name];
    }
  } catch {
    // script.js belum punya helper atau menyentuh DOM saat load; abaikan.
  }
  return helpers;
}

function makeDocumentStub() {
  const el = makeElementStub();
  return {
    documentElement: el,
    body: el,
    head: el,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeElementStub(),
    addEventListener: () => {},
    removeEventListener: () => {},
    cookie: '',
    title: '',
  };
}

function makeElementStub() {
  const noop = () => {};
  const el = {
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    textContent: '',
    innerHTML: '',
  };
  return el;
}

function makeStorageStub() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
}

// ============================================================
// OUTPUT
// ============================================================
function printReport(json) {
  // Urutkan: per file lalu per baris.
  findings.sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.id < b.id ? -1 : 1;
  });

  const perRule = {};
  for (const f of findings) {
    perRule[f.id] = perRule[f.id] || { count: 0, level: f.level };
    perRule[f.id].count++;
  }

  const errorCount = findings.filter((f) => f.level === 'error').length;
  const warnCount = findings.filter((f) => f.level === 'warn').length;

  if (json) {
    const out = {
      findings,
      summary: {
        perRule,
        total: findings.length,
        errors: errorCount,
        warnings: warnCount,
      },
      exitCode: errorCount > 0 ? 1 : 0,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return errorCount > 0 ? 1 : 0;
  }

  // Format teks: "file:baris  ID  pesan"
  for (const f of findings) {
    const loc = `${f.file}:${f.line}`;
    const tag = f.level === 'warn' ? ' (warn)' : '';
    process.stdout.write(`${loc.padEnd(28)}  ${f.id}${tag}  ${f.message}\n`);
  }

  // Ringkasan per aturan
  process.stdout.write('\n--- Ringkasan per aturan ---\n');
  const ids = Object.keys(perRule).sort();
  if (!ids.length) {
    process.stdout.write('(tidak ada temuan)\n');
  } else {
    for (const id of ids) {
      const r = perRule[id];
      const lvl = r.level === 'warn' ? 'warn ' : 'error';
      process.stdout.write(`  ${id}  ${lvl}  ${r.count}\n`);
    }
  }
  process.stdout.write(
    `\nTotal: ${findings.length} temuan (${errorCount} error, ${warnCount} warn)\n`
  );

  return errorCount > 0 ? 1 : 0;
}

// ============================================================
// MAIN
// ============================================================
function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');

  const src = {
    html: readIfExists(FILES.html),
    css: readIfExists(FILES.css),
    js: readIfExists(FILES.js),
    data: readIfExists(FILES.data),
    reader: readIfExists(FILES.reader),
    dataObj: null,
  };

  // Jalankan validasi data lebih dahulu agar allowlist A32 (judul buku/komunitas)
  // tersedia saat audit statis berjalan.
  runDataRules(src);
  runStaticRules(src);

  const code = printReport(json);
  process.exit(code);
}

main();
