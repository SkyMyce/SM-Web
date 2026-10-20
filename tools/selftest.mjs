#!/usr/bin/env node
// Assert-based checks for the non-trivial logic and the built output. Zero dependencies; run after the build.
// Usage: node tools/selftest.mjs [--dir _site]
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const dir = resolve(process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "_site");
const mod = name => import(pathToFileURL(join(dir, "assets/js", name)).href);
let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; } catch (error) { console.error(`FAIL ${name}\n  ${error.message}`); process.exitCode = 1; } };

// ---------- Release signature verification (mirrors relay verifyCommunityManifest) ----------
const { verifyRelease } = await mod("release.js");
const { subtle } = globalThis.crypto;
const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const spki = Buffer.from(await subtle.exportKey("spki", pair.publicKey)).toString("base64");
const now = Date.UTC(2026, 9, 20);
const manifest = { product: "sky-myce", protocol: 4, installation: "fabric", minecraft: "26.1.2", version: "2.7.29", artifact: "releases/Sky-Myce-2.7.29.jar",
  size: 4_000_000, sha256: "a".repeat(64), issuedAt: now - 3600_000, expiresAt: now + 7 * 86400_000, notes: "Fixes" };
const envelope = async (m, kid = "test-key", key = pair.privateKey) => {
  const payload = Buffer.from(JSON.stringify(m));
  return { kid, payload: payload.toString("base64"), signature: Buffer.from(await subtle.sign({ name: "Ed25519" }, key, payload)).toString("base64") };
};
const trust = { keyId: "test-key", publicKey: spki, minecraft: "26.1.2" };
await test("valid manifest verifies", async () => assert.equal((await verifyRelease(await envelope(manifest), trust, now)).status, "valid"));
await test("url-safe base64 accepted", async () => {
  const e = await envelope(manifest); e.signature = e.signature.replaceAll("+", "-").replaceAll("/", "_");
  assert.equal((await verifyRelease(e, trust, now)).status, "valid");
});
await test("tampered payload rejected", async () => {
  const e = await envelope(manifest); e.payload = Buffer.from(JSON.stringify({ ...manifest, size: 5 })).toString("base64");
  assert.equal((await verifyRelease(e, trust, now)).status, "invalid");
});
await test("unknown key id rejected", async () => assert.equal((await verifyRelease(await envelope(manifest, "other"), trust, now)).status, "invalid"));
await test("other signer rejected", async () => {
  const other = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  assert.equal((await verifyRelease(await envelope(manifest, "test-key", other.privateKey), trust, now)).status, "invalid");
});
await test("expired manifest rejected", async () => assert.match((await verifyRelease(await envelope(manifest), trust, manifest.expiresAt + 1)).reason, /expired/));
await test("wrong Minecraft version rejected", async () => assert.equal((await verifyRelease(await envelope({ ...manifest, minecraft: "1.21" }), trust, now)).status, "invalid"));
await test("artifact must match version", async () => assert.equal((await verifyRelease(await envelope({ ...manifest, artifact: "releases/x.jar" }), trust, now)).status, "invalid"));
await test("validity window over 14 days rejected", async () => assert.equal((await verifyRelease(await envelope({ ...manifest, expiresAt: manifest.issuedAt + 15 * 86400_000 }), trust, now)).status, "invalid"));
await test("configured production key parses as SPKI Ed25519", async () => {
  const config = (await mod("config.js")).default;
  await subtle.importKey("spki", Buffer.from(config.signing.publicKey, "base64"), { name: "Ed25519" }, false, ["verify"]);
});

// ---------- Leaderboard preview mirrors relay semantics ----------
const { previewLeaderboard } = await mod("preview-data.js");
const { periodStart, METRICS } = await mod("metrics.js");
await test("UTC week starts Monday, month on the 1st", () => {
  assert.equal(periodStart("weekly", Date.UTC(2026, 9, 20, 15)), Date.UTC(2026, 9, 19)); // Tue 20 Oct -> Mon 19 Oct
  assert.equal(periodStart("weekly", Date.UTC(2026, 9, 25, 23)), Date.UTC(2026, 9, 19)); // Sun 25 Oct -> Mon 19 Oct
  assert.equal(periodStart("monthly", Date.UTC(2026, 9, 20)), Date.UTC(2026, 9, 1));
  assert.equal(periodStart("all-time"), null);
});
await test("ranks are ordered, run time ascending, pages consistent", () => {
  for (const metric of ["dungeon_runs", "dungeon_profit", "dungeon_run_time", "rng_drops"]) {
    const all = [];
    for (let page = 1; ; page++) {
      const r = previewLeaderboard({ category: METRICS[metric].category, metric, period: "all-time", page, limit: 10 });
      all.push(...r.entries);
      if (!r.hasNext) { assert.equal(all.length, r.total); break; }
    }
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].rank >= all[i - 1].rank);
      if (metric === "dungeon_run_time") assert.ok(all[i].value >= all[i - 1].value); else assert.ok(all[i].value <= all[i - 1].value);
      if (all[i].value === all[i - 1].value) assert.equal(all[i].rank, all[i - 1].rank);
    }
  }
});
await test("unavailable metric returns reason and no entries", () => {
  const r = previewLeaderboard({ category: "other", metric: "completed_tasks" });
  assert.equal(r.available, false); assert.equal(r.entries.length, 0); assert.ok(r.reason);
});
await test("search filters by visible name only", () => {
  const r = previewLeaderboard({ category: "dungeons", metric: "dungeon_runs", search: "preview_m", limit: 25 });
  assert.ok(r.entries.every(e => e.player.toLowerCase().includes("preview_m")));
});

// ---------- Built output ----------
async function walk(d) { const out = []; for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
const config = (await mod("config.js")).default;
const siteUrl = config.SITE_ORIGIN + config.BASE_PATH;
const pages = (await walk(dir)).filter(f => f.endsWith(".html"));
for (const file of pages) {
  const name = relative(dir, file).split(sep).join("/");
  const html = await readFile(file, "utf8");
  await test(`${name}: CSP, canonical, no inline code or styles`, () => {
    assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'/);
    assert.match(html, new RegExp(`<link rel="canonical" href="${siteUrl.replace(/[.]/g, "\\.")}`));
    assert.doesNotMatch(html, /\sstyle="/, "inline style attribute would be blocked by CSP");
    assert.doesNotMatch(html, /\son[a-z]+="/, "inline event handler");
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)) assert.match(m[1], /application\/ld\+json/, "inline script");
    // Brand in visible text: "SkyMyce" only. URLs (the mod repo) and the historical release file name are allowed.
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replaceAll("Sky-Myce-&lt;version&gt;.jar", "");
    assert.doesNotMatch(text, /Sky-Myce|Sky-?Hawk/, "stale brand name");
  });
  if (name === "admin/index.html" || name === "404.html" || name === "community/connect/index.html") await test(`${name}: noindex`, () => assert.match(html, /<meta name="robots" content="noindex/));
}
await test("404.html uses base-path absolute links", async () => {
  const html = await readFile(join(dir, "404.html"), "utf8");
  assert.match(html, new RegExp(`href="${config.BASE_PATH}docs/"`));
  assert.match(html, new RegExp(`src="${config.BASE_PATH}assets/js/main.js"`));
});
await test("sitemap entries exist and use the site URL", async () => {
  const xml = await readFile(join(dir, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.length > 20);
  for (const loc of locs) {
    assert.ok(loc.startsWith(siteUrl), loc);
    assert.ok((await stat(join(dir, loc.slice(siteUrl.length), "index.html"))).isFile(), loc);
  }
  assert.ok(!locs.some(l => l.includes("/admin/") || l.includes("/connect/")), "admin/connect must not be in the sitemap");
});
await test("every declared media slot is used on a page", async () => {
  const slots = Object.keys(JSON.parse(await readFile(join(dir, "data/media-slots.json"), "utf8")));
  const used = new Set();
  for (const file of pages) for (const m of (await readFile(file, "utf8")).matchAll(/data-slot="([^"]+)"/g)) used.add(m[1]);
  assert.deepEqual(slots.filter(s => !used.has(s)), []);
});
await test("robots.txt and .nojekyll", async () => {
  assert.match(await readFile(join(dir, "robots.txt"), "utf8"), new RegExp(`Sitemap: ${siteUrl}sitemap\\.xml`));
  assert.ok((await stat(join(dir, ".nojekyll"))).isFile());
});

console.log(`${passed} checks passed${process.exitCode ? ", some FAILED" : ""}.`);
