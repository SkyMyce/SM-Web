#!/usr/bin/env node
// Lists every media slot from src/data/media-slots.json as present or missing, flags oversized files and
// undeclared files. Zero dependencies.
// Usage: node tools/media-audit.mjs [--json] [--missing] [--shotlist] [--strict]
//   --json      machine-readable output
//   --missing   only list missing slots
//   --shotlist  print a Markdown shot list grouped by page (for a capture session)
//   --strict    exit 1 if any slot is missing or oversized (for CI once captures exist)
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "src/assets/media");
const flags = new Set(process.argv.slice(2));
const EXT = { image: ["webp", "png", "jpg"], video: ["mp4", "webm"] };
const BUDGET = { image: 400 * 1024, video: 4 * 1024 * 1024, poster: 200 * 1024 }; // see docs/CAPTURE-GUIDE.md

const slots = JSON.parse(await readFile(join(ROOT, "src/data/media-slots.json"), "utf8"));
const size = async path => { try { return (await stat(path)).size; } catch { return null; } };

const rows = [];
for (const [id, slot] of Object.entries(slots)) {
  const files = [];
  for (const ext of EXT[slot.kind]) { const s = await size(join(MEDIA, `${id}.${ext}`)); if (s !== null) files.push({ file: `${id}.${ext}`, bytes: s }); }
  if (slot.kind === "video") for (const ext of ["jpg", "webp"]) { const s = await size(join(MEDIA, `${id}.${ext}`)); if (s !== null) files.push({ file: `${id}.${ext}`, bytes: s, poster: true }); }
  const main = files.filter(f => !f.poster);
  const oversized = files.filter(f => f.bytes > (f.poster ? BUDGET.poster : BUDGET[slot.kind])).map(f => f.file);
  rows.push({ id, page: id.split("/").slice(0, -1).join("/"), kind: slot.kind, aspect: slot.aspect, status: main.length ? "present" : "missing",
    expected: slot.kind === "video" ? `${id}.mp4 + ${id}.webm + poster ${id}.jpg` : `${id}.webp`, files, oversized, alt: slot.alt, spec: slot.spec });
}

async function walk(dir) {
  try {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await walk(path)); else if (entry.name !== ".gitkeep") out.push(relative(MEDIA, path).split(sep).join("/"));
    }
    return out;
  } catch { return []; }
}
const declared = new Set(rows.flatMap(r => r.files.map(f => f.file)));
const undeclared = (await walk(MEDIA)).filter(f => !declared.has(f));

const missing = rows.filter(r => r.status === "missing"), heavy = rows.filter(r => r.oversized.length);
if (flags.has("--json")) console.log(JSON.stringify({ total: rows.length, present: rows.length - missing.length, missing: missing.length, oversized: heavy.length, undeclared, slots: rows }, null, 2));
else if (flags.has("--shotlist")) {
  const pages = [...new Set(rows.map(r => r.page))];
  console.log("# SkyMyce shot list\n");
  for (const page of pages) {
    console.log(`## ${page}\n`);
    for (const r of rows.filter(x => x.page === page && (!flags.has("--missing") || x.status === "missing")))
      console.log(`- [${r.status === "present" ? "x" : " "}] **${r.id}** (${r.kind}, ${r.aspect}): ${r.spec} → \`src/assets/media/${r.expected}\``);
    console.log("");
  }
} else {
  const list = flags.has("--missing") ? missing : rows;
  const width = Math.max(...list.map(r => r.id.length), 4);
  console.log(`${"slot".padEnd(width)}  kind   aspect  status    file(s)`);
  for (const r of list) console.log(`${r.id.padEnd(width)}  ${r.kind.padEnd(5)}  ${r.aspect.padEnd(6)}  ${r.status.padEnd(8)}  ${r.files.map(f => `${f.file} (${Math.round(f.bytes / 1024)} KB)`).join(", ") || r.expected}${r.oversized.length ? "  OVER BUDGET" : ""}`);
  console.log(`\n${rows.length} slots: ${rows.length - missing.length} present, ${missing.length} missing, ${heavy.length} over budget.`);
  if (undeclared.length) console.log(`Undeclared files in src/assets/media (not used by any slot): ${undeclared.join(", ")}`);
}
if (flags.has("--strict") && (missing.length || heavy.length)) process.exit(1);
