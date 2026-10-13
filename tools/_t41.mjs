/* One-off transform for task 4.1: replace inline onclick with data-action,
   convert clickable <div>/<a href="#"> into <button type="button"> (tag-aware),
   and add tabindex="-1" to page title headings. Run once, then deleted. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'index.html');
let html = readFileSync(file, 'utf8');

// --- Helper: find the matching close index for an element opened at `openStart`.
// `openStart` points at the "<" of the opening tag. Returns {tagName, openEnd, closeStart, closeEnd}.
function findElement(src, openStart) {
  const tagNameMatch = /^<([a-zA-Z][\w-]*)/.exec(src.slice(openStart));
  const tagName = tagNameMatch[1].toLowerCase();
  // end of opening tag
  let i = openStart + 1;
  let inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '>') break;
  }
  const openEnd = i; // index of '>'
  // self-closing?
  if (src[openEnd - 1] === '/') {
    return { tagName, openEnd, closeStart: -1, closeEnd: openEnd };
  }
  // walk to matching close, tracking same-tag nesting
  const openRe = new RegExp(`<${tagName}(?=[\\s/>])`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let depth = 1;
  let pos = openEnd + 1;
  while (pos < src.length) {
    openRe.lastIndex = pos; closeRe.lastIndex = pos;
    const o = openRe.exec(src); const cl = closeRe.exec(src);
    if (!cl) break;
    if (o && o.index < cl.index) { depth++; pos = o.index + 1; }
    else { depth--; pos = cl.index + cl[0].length; if (depth === 0) return { tagName, openEnd, closeStart: cl.index, closeEnd: pos }; }
  }
  throw new Error('no matching close for ' + tagName + ' at ' + openStart);
}

// Build the data-action attribute string for a given onclick value.
function actionAttrs(onclick) {
  let m;
  if ((m = /^showPage\('page-selengkapnya',\s*'([^']*)'\)$/.exec(onclick))) {
    return `data-action="go" data-page="page-selengkapnya" data-title="${m[1]}"`;
  }
  if ((m = /^showPage\('([^']+)'\)$/.exec(onclick))) {
    return `data-action="go" data-page="${m[1]}"`;
  }
  if (/^goBack\(\)$/.test(onclick)) return `data-action="back"`;
  if (/^openEbook\(\)$/.test(onclick)) return `data-action="open-reader"`;
  if (/^openFilterSheet\(\)$/.test(onclick)) return `data-action="open-filter"`;
  if (/^closeFilterSheet\(\)$/.test(onclick)) return `data-action="close-filter"`;
  if (/^applyFilter\(\)$/.test(onclick)) return `data-action="apply-filter"`;
  if (/^toggleTheme\(\)$/.test(onclick)) return `data-action="toggle-theme"`;
  if (/^this\.classList\.toggle\('open'\)$/.test(onclick)) return `data-action="toggle-collapsible" aria-expanded="false"`;
  if ((m = /^switchTab\(this,\s*'([^']+)'\)$/.exec(onclick))) return `data-action="nav-tab" data-page="${m[1]}"`;
  if ((m = /^switchRakTab\(this,\s*'([^']+)'\)$/.exec(onclick))) return `data-action="tab" data-tab-group="rak" data-panel="${m[1]}"`;
  if ((m = /^switchKomunitasTab\(this,\s*'([^']+)'\)$/.exec(onclick))) return `data-action="tab" data-tab-group="komunitas" data-panel="${m[1]}"`;
  if (/sub-tab'\)\[1\]\.click\(\)$/.test(onclick)) return `data-action="tab" data-tab-group="komunitas" data-panel="komunitas-cari"`;
  // reset button carries closeFilterSheet but should be reset-filter (handled specially by caller)
  return null;
}

// Tags that are clickable containers to convert into <button type="button">.
// Process iteratively: find each occurrence of ` onclick="`, resolve the element.
function transform(src) {
  let out = src;
  let guard = 0;
  while (true) {
    if (guard++ > 500) throw new Error('runaway');
    const idx = out.search(/\sonclick\s*=\s*"/);
    if (idx === -1) break;
    // find opening tag start (the '<' before this attribute)
    let tagStart = out.lastIndexOf('<', idx);
    const el = findElement(out, tagStart);
    const openTag = out.slice(tagStart, el.openEnd + 1);
    // extract onclick value
    const oc = /\sonclick\s*=\s*"([^"]*)"/.exec(openTag);
    const onclickVal = oc[1];
    // special-case: filter footer Reset uses closeFilterSheet -> reset-filter
    let attrs;
    const isResetBtn = /class="btn-sm-outline"/.test(openTag) && /^closeFilterSheet\(\)$/.test(onclickVal);
    if (isResetBtn) attrs = `data-action="reset-filter"`;
    else attrs = actionAttrs(onclickVal);
    if (attrs == null) throw new Error('unmapped onclick: ' + onclickVal);

    // Remove the onclick attribute from the opening tag and inject data-action attrs.
    let newOpen = openTag.replace(/\sonclick\s*=\s*"[^"]*"/, '');
    // insert attrs right after the tag name's class attribute end, else before '>'
    newOpen = newOpen.replace(/\s*\/?>$/, (end) => ` ${attrs}${end}`);

    let replacementOpen = newOpen;
    let replacementClose = null;
    if (el.tagName === 'div') {
      // Convert <div ...> -> <button type="button" ...>
      replacementOpen = newOpen.replace(/^<div\b/, '<button type="button"');
      // ensure type="button" not duplicated and present once
      if (!/type="button"/.test(replacementOpen)) {
        replacementOpen = replacementOpen.replace(/^<button/, '<button type="button"');
      }
      replacementClose = '</button>';
    } else if (el.tagName === 'a') {
      // Convert <a href="#" ...> -> <button type="button" ...> (nav via data-action)
      replacementOpen = newOpen
        .replace(/\shref\s*=\s*"#"/, '')
        .replace(/^<a\b/, '<button type="button"');
      replacementClose = '</button>';
    }
    // apply close replacement first (higher index) then open
    if (replacementClose && el.closeStart !== -1) {
      const closeStr = out.slice(el.closeStart, el.closeEnd);
      out = out.slice(0, el.closeStart) + replacementClose + out.slice(el.closeEnd);
    }
    out = out.slice(0, tagStart) + replacementOpen + out.slice(el.openEnd + 1);
  }
  return out;
}

html = transform(html);

// Remaining href="#" on anchors WITHOUT onclick (already-handled ones are gone):
// a.see-all "Lihat Semua", "Buku Serupa Selengkapnya", a.meta-link, a.text-link.
// Convert these to <button type="button"> (actions wired in later tasks 4.9/6.4).
function convertPlainAnchors(src) {
  let out = src;
  let guard = 0;
  while (true) {
    if (guard++ > 200) throw new Error('runaway anchors');
    const m = /<a\b[^>]*href\s*=\s*"#"[^>]*>/i.exec(out);
    if (!m) break;
    const tagStart = m.index;
    const el = findElement(out, tagStart);
    let openTag = out.slice(tagStart, el.openEnd + 1);
    let newOpen = openTag.replace(/\shref\s*=\s*"#"/i, '').replace(/^<a\b/, '<button type="button"');
    const closeStr = out.slice(el.closeStart, el.closeEnd);
    out = out.slice(0, el.closeStart) + '</button>' + out.slice(el.closeEnd);
    out = out.slice(0, tagStart) + newOpen + out.slice(el.openEnd + 1);
  }
  return out;
}
html = convertPlainAnchors(html);

// Add tabindex="-1" to page title headings (page-title-large, page-title, topbar-title)
// so focus can land on them after navigation (§14.2). Only add if not present.
html = html.replace(/<(h1|h2)\b([^>]*\bclass="(?:page-title-large|page-title|topbar-title)[^"]*")([^>]*)>/g,
  (full, tag, cls, rest) => {
    if (/\btabindex=/.test(full)) return full;
    return `<${tag}${cls} tabindex="-1"${rest}>`;
  });

writeFileSync(file, html, 'utf8');
console.log('done');
