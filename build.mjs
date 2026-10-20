#!/usr/bin/env node
// Zero-dependency static build: wraps src/pages in the shared layout, expands media slots,
// builds docs navigation/search, and writes sitemap, robots, manifest and CSP from site.config.js.
// Usage: node build.mjs [--out _site] [--base /sub/path/] [--origin https://example.org]
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) =>
  arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs, []));
const config = structuredClone((await import(pathToFileURL(join(ROOT, "site.config.js")).href)).default);
if (args.base) config.BASE_PATH = args.base;
if (args.origin) config.SITE_ORIGIN = args.origin;
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(config.BASE_PATH)) throw Error(`BASE_PATH must start and end with "/": ${config.BASE_PATH}`);
const OUT = join(ROOT, args.out ?? "_site");
const SRC = join(ROOT, "src");
const SITE_URL = config.SITE_ORIGIN.replace(/\/$/, "") + config.BASE_PATH;
const read = path => readFile(path, "utf8");
const json = async path => JSON.parse(await read(path));
export const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = text => text.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path)); else out.push(path);
  }
  return out;
}

// ---------- data ----------
const slots = await json(join(SRC, "data/media-slots.json"));
const docsNav = await json(join(SRC, "data/docs.json"));
const docsFlat = docsNav.sections.flatMap(section => section.pages.map(page => ({ ...page, section: section.title })));

// ---------- CSP ----------
const api = new URL(config.API_BASE);
const discordMedia = "https://cdn.discordapp.com https://media.discordapp.net";
const csp = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'",
  `img-src 'self' data: ${api.origin} ${discordMedia}`, `media-src 'self' ${discordMedia}`,
  `connect-src 'self' ${api.origin} wss://${api.host}`, "font-src 'self'", "object-src 'none'",
  "base-uri 'self'", "form-action 'self'", "frame-src 'none'", "worker-src 'none'", "manifest-src 'self'",
].join("; ");

// ---------- media slots ----------
const MEDIA_EXT = { image: ["webp", "png", "jpg"], video: ["mp4", "webm"] };
function mediaSlot(id, extraClass = "") {
  const slot = slots[id];
  if (!slot) throw Error(`Unknown media slot "${id}" (declare it in src/data/media-slots.json)`);
  const base = `assets/media/${id}`;
  const found = ext => existsSync(join(SRC, `${base}.${ext}`)) ? `~/${base}.${ext}` : null;
  const ratio = `ratio-${slot.aspect.replace(":", "x")}`;
  const caption = slot.caption ? `<figcaption>${esc(slot.caption)}</figcaption>` : "";
  if (slot.kind === "video") {
    const sources = MEDIA_EXT.video.map(ext => [ext, found(ext)]).filter(([, url]) => url);
    const poster = found("jpg") ?? found("webp");
    if (sources.length) return `<figure class="media-slot ${ratio} ${extraClass}" data-slot="${esc(id)}"><button class="media-slot__frame" type="button" data-lightbox aria-label="Enlarge: ${esc(slot.alt)}"><video muted loop playsinline preload="none" data-autoplay${poster ? ` poster="${poster}"` : ""} aria-label="${esc(slot.alt)}">${sources.map(([ext, url]) => `<source src="${url}" type="video/${ext}">`).join("")}</video></button>${caption}</figure>`;
  } else {
    const url = MEDIA_EXT.image.map(found).find(Boolean);
    if (url) return `<figure class="media-slot ${ratio} ${extraClass}" data-slot="${esc(id)}"><button class="media-slot__frame" type="button" data-lightbox aria-label="Enlarge: ${esc(slot.alt)}"><img src="${url}" alt="${esc(slot.alt)}" loading="lazy" decoding="async"></button>${caption}</figure>`;
  }
  const expected = slot.kind === "video" ? `${base}.mp4 (+ .webm, poster .jpg)` : `${base}.webp`;
  return `<figure class="media-slot media-slot--pending ${ratio} ${extraClass}" data-slot="${esc(id)}"><div class="media-slot__frame" role="img" aria-label="Capture pending: ${esc(slot.alt)}"><div class="media-slot__pending"><span class="badge badge--pending">Capture pending</span><p class="media-slot__title">${esc(slot.alt)}</p><p class="media-slot__spec"><code>${esc(expected)}</code></p><p class="media-slot__spec">${esc(slot.spec)}</p></div></div>${caption}</figure>`;
}

// ---------- layout ----------
const NAV = [
  ["dungeons", "Dungeons", "~/dungeons/"], ["tracker", "Tracker", "~/tracker/"], ["bazaar", "Bazaar", "~/bazaar/"],
  ["everyday", "Everyday", "~/everyday/"], ["docs", "Docs", "~/docs/"], ["community", "Community", "~/community/"],
];
const MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="~/assets/img/mark.svg#mark"></use></svg>`;

function header(active) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="site-header__inner">
    <a class="brand" href="~/" aria-label="SkyMyce home">${MARK}<span>SkyMyce</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span class="nav-toggle__bars" aria-hidden="true"></span><span class="sr-only">Menu</span></button>
    <nav class="site-nav" id="site-nav" aria-label="Primary">
      <ul>${NAV.map(([id, label, href]) => `<li><a href="${href}"${id === active ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul>
      <div class="site-nav__actions"><div class="session-slot" data-session-slot></div><a class="btn btn--primary btn--sm" href="~/download/"${active === "download" ? ' aria-current="page"' : ""}>Download</a></div>
    </nav>
  </div>
</header>`;
}

function footer() {
  const discord = config.discordInvite ? `<li><a href="${esc(config.discordInvite)}" rel="noopener" target="_blank">Discord</a></li>` : "";
  const social = config.social.map(s => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a></li>`).join("");
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand"><a class="brand" href="~/" aria-label="SkyMyce home">${MARK}<span>SkyMyce</span></a><p>A client-side Fabric mod for Hypixel SkyBlock. Local features work without Discord.</p></div>
    <nav class="site-footer__cols" aria-label="Footer">
      <div><h2>Product</h2><ul><li><a href="~/dungeons/">Dungeons</a></li><li><a href="~/tracker/">Tracker</a></li><li><a href="~/bazaar/">Bazaar</a></li><li><a href="~/everyday/">Everyday</a></li><li><a href="~/download/">Download</a></li></ul></div>
      <div><h2>Docs</h2><ul><li><a href="~/docs/getting-started/">Getting started</a></li><li><a href="~/docs/install/">Install &amp; troubleshooting</a></li><li><a href="~/docs/commands/">Commands</a></li><li><a href="~/docs/faq/">FAQ</a></li></ul></div>
      <div><h2>Community</h2><ul><li><a href="~/community/leaderboards/">Leaderboards</a></li><li><a href="~/community/chat/">Global Chat</a></li><li><a href="~/community/cosmetics/">Cosmetics</a></li>${discord}${social}</ul></div>
      <div><h2>Trust</h2><ul><li><a href="~/privacy/">Privacy</a></li><li><a href="~/changelog/">Changelog</a></li>${config.features.status ? '<li><a href="~/status/">Status</a></li>' : ""}<li><a href="${esc(config.github.repo)}" rel="noopener" target="_blank">Source on GitHub</a></li></ul></div>
    </nav>
  </div>
  <div class="site-footer__legal">
    <p>Not affiliated with Hypixel or Mojang. Players are responsible for following Hypixel's rules.</p>
    <p><span>SkyMyce</span>${config.features.adminPanel ? ' · <a class="quiet-link" href="~/admin/">Team</a>' : ""}</p>
  </div>
</footer>`;
}

function head(meta, urlPath) {
  const title = meta.title === "SkyMyce" ? "SkyMyce" : `${meta.title} · SkyMyce`;
  const canonical = SITE_URL + urlPath.replace(/^\//, "");
  const noindex = meta.noindex ? `<meta name="robots" content="noindex, nofollow">` : "";
  const scripts = ["main", ...(meta.scripts ?? [])].map(name => `<script type="module" src="~/assets/js/${name}.js"></script>`).join("");
  const og = SITE_URL + "assets/img/og.png";
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta.description)}">
${noindex}<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#07090d">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website"><meta property="og:site_name" content="SkyMyce"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(meta.description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="SkyMyce: a client-side Fabric mod for Hypixel SkyBlock">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(meta.description)}"><meta name="twitter:image" content="${og}">
<link rel="icon" href="~/assets/img/favicon.svg" type="image/svg+xml"><link rel="icon" href="~/assets/img/favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="~/assets/img/apple-touch-icon.png"><link rel="manifest" href="~/manifest.webmanifest">
<link rel="stylesheet" href="~/assets/css/site.css"><noscript><link rel="stylesheet" href="~/assets/css/nojs.css"></noscript>${(meta.styles ?? []).map(name => `<link rel="stylesheet" href="~/assets/css/${name}.css">`).join("")}
${scripts}
${meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld(config)).replace(/</g, "\\u003c")}</script>` : ""}
</head>`;
}

// ---------- docs ----------
function docsChrome(meta, body, urlPath) {
  body = body.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  const toc = [];
  const used = new Set();
  body = body.replace(/<h([23])(?![^>]*\bid=)([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attrs, inner) => {
    let id = slug(inner) || "section"; while (used.has(id)) id += "-x"; used.add(id);
    toc.push({ level, id, text: inner.replace(/<[^>]+>/g, "") });
    return `<h${level} id="${id}"${attrs}><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${level}>`;
  });
  const index = docsFlat.findIndex(page => page.url === urlPath);
  const prev = docsFlat[index - 1], next = docsFlat[index + 1];
  const sidebar = docsNav.sections.map(section => `<div class="docs-nav__group"><h2>${esc(section.title)}</h2><ul>${section.pages.map(page =>
    `<li><a href="~${page.url}"${page.url === urlPath ? ' aria-current="page"' : ""}>${esc(page.title)}</a></li>`).join("")}</ul></div>`).join("");
  const pager = `<nav class="docs-pager" aria-label="Previous and next">${prev ? `<a class="docs-pager__prev" href="~${prev.url}"><span>Previous</span>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="docs-pager__next" href="~${next.url}"><span>Next</span>${esc(next.title)}</a>` : ""}</nav>`;
  const tocHtml = toc.length ? `<nav class="docs-toc" aria-label="On this page"><h2>On this page</h2><ul>${toc.map(item => `<li class="toc-${item.level}"><a href="#${item.id}">${esc(item.text)}</a></li>`).join("")}</ul></nav>` : "";
  const updated = meta.updated ? `<p class="docs-updated">Last updated <time datetime="${esc(meta.updated)}">${new Date(meta.updated + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time></p>` : "";
  const html = `<div class="docs-layout">
  <aside class="docs-sidebar" aria-label="Documentation">
    <div class="docs-search" data-docs-search><label class="sr-only" for="docs-q">Search the docs</label><input id="docs-q" type="search" placeholder="Search docs" autocomplete="off" spellcheck="false" aria-controls="docs-results" aria-autocomplete="list"><kbd aria-hidden="true">/</kbd><div class="docs-search__results" id="docs-results" role="listbox" hidden></div></div>
    <button class="docs-nav-toggle" type="button" aria-expanded="false" aria-controls="docs-nav" data-docs-nav-toggle>Browse docs</button>
    <nav class="docs-nav" id="docs-nav" aria-label="Docs sections">${sidebar}</nav>
  </aside>
  <article class="docs-article prose">
    <p class="eyebrow">${esc(index >= 0 ? docsFlat[index].section : "Docs")}</p>
    <h1>${esc(meta.title)}</h1>
    ${meta.lead ? `<p class="lead">${meta.lead}</p>` : ""}
    ${body}
    ${updated}
    ${pager}
  </article>
  ${tocHtml}
</div>`;
  return { html, toc };
}

// ---------- pages ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(join(SRC, "assets"), join(OUT, "assets"), { recursive: true, filter: path => !path.endsWith(".gitkeep") });
await cp(join(SRC, "data"), join(OUT, "data"), { recursive: true });
await writeFile(join(OUT, "assets/js/config.js"), `// Generated from site.config.js by build.mjs. Edit site.config.js instead.\nexport default ${JSON.stringify(config, null, 2)};\n`);

const pages = (await walk(join(SRC, "pages"))).filter(path => path.endsWith(".html"));
const searchIndex = [];
const sitemap = [];
const JSONLD = {
  download: c => ({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "SkyMyce", applicationCategory: "GameApplication",
    applicationSubCategory: "Minecraft mod", operatingSystem: "Windows, macOS, Linux", url: SITE_URL + "download/", downloadUrl: c.github.releases,
    softwareRequirements: `Minecraft ${c.requirements.minecraft}, Java ${c.requirements.java}, Fabric Loader ${c.requirements.fabricLoader}+, Fabric Language Kotlin`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }),
};

for (const file of pages) {
  const rel = relative(join(SRC, "pages"), file).split(sep).join("/");
  const raw = await read(file);
  const match = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!match) throw Error(`${rel}: missing <!--meta {...}--> header`);
  const meta = JSON.parse(match[1]);
  if (meta.jsonld) meta.jsonld = JSONLD[meta.jsonld];
  let body = raw.slice(match[0].length);
  const is404 = rel === "404.html";
  const urlPath = is404 ? "/404.html" : "/" + rel.replace(/index\.html$/, "");
  const depth = is404 ? 0 : urlPath.split("/").length - 2;
  const prefix = is404 ? config.BASE_PATH : "../".repeat(depth) || "./";

  // {{requirements.minecraft}} style tokens keep fixed facts in site.config.js only.
  body = body.replace(/\{\{([A-Za-z.]+)\}\}/g, (_, path) => {
    const value = path.split(".").reduce((obj, key) => obj?.[key], config);
    if (value === undefined) throw Error(`${rel}: unknown config token {{${path}}}`);
    return esc(value);
  });
  body = body.replace(/<media-slot\s+id="([^"]+)"(?:\s+class="([^"]*)")?\s*><\/media-slot>/g, (_, id, cls) => mediaSlot(id, cls ?? ""));
  if (meta.layout === "docs") {
    const { html, toc } = docsChrome(meta, body, urlPath);
    body = html;
    const text = html.match(/<article[\s\S]*?<\/article>/)[0].replace(/<nav class="docs-pager"[\s\S]*?<\/nav>/, "")
      .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
    searchIndex.push({ title: meta.title, url: urlPath.slice(1), headings: toc.map(t => ({ id: t.id, text: t.text })), text: text.slice(0, 6000) });
  }
  const html = `${head(meta, urlPath)}
<body data-page="${esc(meta.page ?? "")}"${meta.layout === "admin" ? ' class="is-admin"' : ""}>
${meta.layout === "admin" ? "" : header(meta.nav)}
${meta.layout === "admin" ? body : `<main id="main" tabindex="-1"${meta.layout === "docs" ? ' class="main--docs"' : ""}>
${body}
</main>`}
${meta.layout === "admin" ? "" : footer()}
<div class="lightbox" data-lightbox-root hidden></div>
</body>
</html>
`.replace(/(["'(])~\//g, `$1${prefix}`);
  const leftover = html.match(/["'(]~[^"'\s)]*/);
  if (leftover) throw Error(`${rel}: unresolved link ${leftover[0]}`);
  const outFile = join(OUT, rel);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, html);
  if (!is404 && !meta.noindex) sitemap.push({ loc: SITE_URL + urlPath.slice(1), lastmod: meta.updated });
}

await writeFile(join(OUT, "data/search-index.json"), JSON.stringify(searchIndex));
await writeFile(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
  .sort((a, b) => a.loc.localeCompare(b.loc)).map(entry => `  <url><loc>${esc(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`);
// robots.txt is only honoured at a domain root; under a project-site sub-path the noindex meta tags do the work.
await writeFile(join(OUT, "robots.txt"), `User-agent: *\nDisallow: ${config.BASE_PATH}admin/\nSitemap: ${SITE_URL}sitemap.xml\n`);
await writeFile(join(OUT, ".nojekyll"), "");
if (config.customDomain) await writeFile(join(OUT, "CNAME"), config.customDomain + "\n");
await writeFile(join(OUT, "manifest.webmanifest"), JSON.stringify({
  name: "SkyMyce", short_name: "SkyMyce", description: "A client-side Fabric mod for Hypixel SkyBlock.",
  start_url: "./", scope: "./", display: "browser", background_color: "#07090d", theme_color: "#07090d",
  icons: [{ src: "assets/img/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "assets/img/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "assets/img/favicon.svg", sizes: "any", type: "image/svg+xml" }],
}, null, 2));

const size = (await walk(OUT)).length;
console.log(`Built ${pages.length} pages (${size} files) into ${relative(ROOT, OUT)} for ${SITE_URL}`);
