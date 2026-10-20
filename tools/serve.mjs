#!/usr/bin/env node
// Zero-dependency static server that behaves like GitHub Pages for local testing:
// serves the build under a base path, maps "/dir/" to "/dir/index.html", redirects "/dir" to "/dir/",
// and answers misses with 404.html. Usage: node tools/serve.mjs [--dir _site] [--port 8080] [--base /]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) =>
  arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs, []));
const dir = resolve(args.dir ?? "_site"), port = Number(args.port ?? 8080), base = args.base ?? "/";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

async function file(path) { try { const s = await stat(path); return s.isFile() ? path : null; } catch { return null; } }

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  const send = async (status, target) => {
    res.writeHead(status, { "Content-Type": TYPES[extname(target)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(target));
  };
  if (!path.startsWith(base)) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Outside base path"); }
  const local = normalize(join(dir, path.slice(base.length)));
  if (local !== dir && !local.startsWith(dir + sep)) { res.writeHead(400); return res.end(); }
  const direct = await file(local);
  if (direct) return send(200, direct);
  if (!path.endsWith("/") && await file(join(local, "index.html"))) { res.writeHead(301, { Location: path + "/" + url.search }); return res.end(); }
  const index = await file(join(local, "index.html"));
  if (index) return send(200, index);
  const notFound = await file(join(dir, "404.html"));
  if (notFound) return send(404, notFound);
  res.writeHead(404); res.end("Not found");
}).listen(port, () => console.log(`Serving ${dir} at http://localhost:${port}${base}`));
