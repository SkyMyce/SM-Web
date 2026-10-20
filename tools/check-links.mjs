#!/usr/bin/env node
// Checks every internal href/src in the built site resolves to a file, including #fragments on the target
// page. External links are listed, not fetched. Zero dependencies. Run after `node build.mjs`.
// Usage: node tools/check-links.mjs [--dir _site]
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const dir = resolve(process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "_site");
async function walk(d) { const out = []; for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
const exists = async p => { try { return (await stat(p)).isFile(); } catch { return false; } };
// Absolute links must carry the BASE_PATH the site was built with.
const BASE = (await readFile(join(dir, "assets/js/config.js"), "utf8")).match(/"BASE_PATH":\s*"([^"]+)"/)[1];
const SITE = (await readFile(join(dir, "assets/js/config.js"), "utf8")).match(/"SITE_ORIGIN":\s*"([^"]+)"/)[1];
const files = (await walk(dir)).filter(f => f.endsWith(".html"));
const ids = new Map();
for (const f of files) ids.set(f, new Set([...(await readFile(f, "utf8")).matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));

let broken = 0; const external = new Set();
for (const file of files) {
  const html = await readFile(file, "utf8");
  // 404.html uses absolute base-path links (it is served at any depth); resolve those against the site root.
  const base = file.endsWith(`${sep}404.html`) ? null : dirname(file);
  for (const [, attr, raw] of html.matchAll(/\s(href|src|poster)="([^"]+)"/g)) {
    if (/^(mailto:|data:|javascript:)/.test(raw)) continue;
    if (/^https?:\/\//.test(raw)) { if (!raw.startsWith(SITE)) external.add(raw); continue; } // own canonical/OG URLs: sitemap entries are checked by tools/selftest.mjs
    const [path, hash] = raw.split("#");
    let target;
    if (!path) target = file;
    else if (path.startsWith("/")) {
      if (!path.startsWith(BASE)) { broken++; console.log(`OUTSIDE BASE ${relative(dir, file)}: ${raw} (base ${BASE})`); continue; }
      target = join(dir, path.slice(BASE.length));
    }
    else target = resolve(base ?? dir, path);
    if (path.endsWith("/") || (path && !/\.[a-z0-9]+$/i.test(path))) target = join(target, "index.html");
    if (!await exists(target)) { broken++; console.log(`BROKEN ${relative(dir, file)}: ${attr}="${raw}" -> ${relative(dir, target)}`); continue; }
    if (hash && !hash.startsWith("/") && target.endsWith(".html") && ids.has(target) && !ids.get(target).has(hash)) { broken++; console.log(`MISSING ANCHOR ${relative(dir, file)}: #${hash} in ${relative(dir, target)}`); }
  }
}
console.log(`${files.length} pages checked, ${broken} broken internal link(s). ${external.size} external URL(s) not fetched:`);
for (const url of [...external].sort()) console.log(`  ${url}`);
process.exit(broken ? 1 : 0);
