#!/usr/bin/env node
// Optional dev tool: rasterises src/assets/img/favicon.svg into the PNG icons and renders og.png.
// Not needed to build or deploy (the PNGs are committed). Requires a local Chrome/Edge and playwright-core:
//   npm install --no-save playwright-core && node tools/render-brand.mjs [path-to-chrome]
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const IMG = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/img");
const svg = (await readFile(join(IMG, "favicon.svg"), "utf8")).replace("<svg ", '<svg width="100%" height="100%" ');
const browser = await chromium.launch({ executablePath: process.argv[2] ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined) });
const page = await browser.newPage();
async function shot(file, width, height, html) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><body style="margin:0">${html}</body>`, { waitUntil: "load" });
  await page.screenshot({ path: join(IMG, file), omitBackground: true });
}
const icon = (size, pad, bg) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}"><div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div></div>`;
await shot("favicon-32.png", 32, 32, icon(32, 0, "transparent"));
await shot("apple-touch-icon.png", 180, 180, icon(180, 18, "#0b0f15"));
await shot("icon-192.png", 192, 192, icon(192, 20, "#0b0f15"));
await shot("icon-512.png", 512, 512, icon(512, 56, "#0b0f15"));
await shot("og.png", 1200, 630, `<div style="width:1200px;height:630px;box-sizing:border-box;padding:84px 96px;display:flex;flex-direction:column;justify-content:space-between;
  background:radial-gradient(60% 80% at 85% 0%,rgba(113,212,234,.28),transparent 70%),radial-gradient(40% 60% at 100% 100%,rgba(181,155,230,.18),transparent 70%),#07090d;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,system-ui,sans-serif;color:#f1f5fc">
  <div style="display:flex;align-items:center;gap:28px"><div style="width:112px;height:112px">${svg}</div><div style="font-size:92px;font-weight:750;letter-spacing:-4px">SkyMyce</div></div>
  <div><div style="font-size:46px;font-weight:650;letter-spacing:-1.5px;line-height:1.1;max-width:900px">A client-side Fabric mod for Hypixel SkyBlock.</div>
  <div style="margin-top:22px;font-size:26px;color:#71d4ea;letter-spacing:.5px">Dungeons · Tracker · Bazaar · Everyday</div></div></div>`);
await browser.close();
console.log("Wrote favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png and og.png");
