#!/usr/bin/env node
// Zero-dependency screenshots through Chrome's DevTools protocol (Node 22+ has WebSocket built in).
// Usage: node tools/screenshot.mjs --out dir --chrome "path/to/chrome" [--width 1440] [--height 900] [--reduced-motion]
//        url[@scrollY] ...      e.g.  http://localhost:8080/SM-Web/@1200
import { spawn } from "node:child_process";
import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const flag = name => argv.includes(`--${name}`);
const out = opt("out", "shots"), width = Number(opt("width", 1440)), height = Number(opt("height", 900));
const chrome = opt("chrome", process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const urls = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && !["reduced-motion"].includes(argv[i - 1].slice(2))));
const port = 9222 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), "shot-"));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });
await mkdir(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list;
for (let i = 0; i < 50 && !list; i++) { await sleep(200); list = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null); }
const ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
if (flag("reduced-motion")) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await send("Page.enable");
for (const spec of urls) {
  const [url, scroll = "0"] = spec.split("@");
  await send("Page.navigate", { url });
  await sleep(900);
  await send("Runtime.evaluate", { expression: `scrollTo({top:${Number(scroll)},behavior:"instant"})` });
  await sleep(1300);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  const name = (new URL(url).pathname.replace(/\/SM-Web\/|\/$/g, "").replace(/\//g, "-") || "home") + (scroll !== "0" ? `@${scroll}` : "") + (width < 600 ? "-m" : "") + (flag("reduced-motion") ? "-rm" : "") + ".png";
  await writeFile(join(out, name), Buffer.from(result.data, "base64"));
  console.log(join(out, name));
}
ws.close(); proc.kill();
