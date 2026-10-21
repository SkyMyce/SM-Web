#!/usr/bin/env node
// Optional dev tool: rasterises src/assets/img/favicon.svg into the PNG icons and renders og.png.
// Not needed to build or deploy (the PNGs are committed). Zero dependencies: drives a local Chrome
// through the DevTools protocol (Node 22+ has WebSocket built in).
//   node tools/render-brand.mjs [--chrome "path/to/chrome"]
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IMG = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/img");
const argv = process.argv.slice(2);
const chrome = argv.includes("--chrome") ? argv[argv.indexOf("--chrome") + 1] : (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const svg = (await readFile(join(IMG, "favicon.svg"), "utf8")).replace("<svg ", '<svg width="100%" height="100%" ');

const port = 9222 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), "brand-"));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list;
for (let i = 0; i < 50 && !list; i++) { await sleep(200); list = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null); }
const ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

async function shot(file, width, height, html) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><body style="margin:0;background:transparent">${html}</body>`) });
  await sleep(600);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(IMG, file), Buffer.from(result.data, "base64"));
}
const icon = (size, pad, bg) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div></div>`;
await shot("favicon-32.png", 32, 32, icon(32, 0, "transparent"));
await shot("apple-touch-icon.png", 180, 180, icon(180, 18, "#1b2fd6"));
await shot("icon-192.png", 192, 192, icon(192, 20, "#1b2fd6"));
await shot("icon-512.png", 512, 512, icon(512, 56, "#1b2fd6"));
await shot("og.png", 1200, 630, `<div style="width:1200px;height:630px;box-sizing:border-box;padding:72px 88px;display:flex;flex-direction:column;justify-content:space-between;
  background:linear-gradient(180deg,#1b2fd6 0%,#2d7cf6 55%,#8fd3ff 100%);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,system-ui,sans-serif;color:#fff">
  <div style="display:flex;align-items:center;gap:22px"><div style="width:72px;height:72px">${svg}</div><div style="font-size:44px;font-weight:700;letter-spacing:-1.5px">SkyMyce</div></div>
  <div><div style="font-size:112px;font-weight:800;letter-spacing:-6px;line-height:.95">Reads the run.</div>
  <div style="font-size:112px;font-style:italic;font-weight:400;letter-spacing:-2px;line-height:.95;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif">Never plays it.</div>
  <div style="margin-top:30px;font-size:30px;color:rgba(255,255,255,.9);max-width:900px">A client-side Fabric mod for Hypixel SkyBlock. Dungeon tools, run tracking and a HUD you arrange yourself.</div></div></div>`);
ws.close(); proc.kill();
console.log("Wrote favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png and og.png");
