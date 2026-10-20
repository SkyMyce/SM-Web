# SM-Web: the SkyMyce website

The website for **SkyMyce**, a client-side Fabric mod for Hypixel SkyBlock. It is a static site for GitHub
Pages: plain HTML, CSS and vanilla JavaScript modules, built by one zero-dependency Node script.

- **Live URL:** https://skymyce.github.io/SM-Web/ (project site of `SkyMyce/SM-Web`)
- **Mod source and releases:** https://github.com/cessna80808-star/Sky-Myce

## Why this stack

A framework would add a toolchain, a dependency tree and a JavaScript runtime cost for what is mostly
documents. Hand-written HTML, on the other hand, would mean copy-pasting the head, header, footer, docs
navigation and CSP into about 30 pages. So there is one small build script, `build.mjs`, about 250 lines of
Node standard library. It:

- wraps each page in the shared layout;
- writes canonical URLs, the sitemap and the CSP from one config file;
- turns media slots into images or "capture pending" cards;
- builds the docs table of contents, previous/next links and the search index.

The output is a static folder deployed by the official GitHub Pages actions. There are no runtime
dependencies, no third-party scripts and no web fonts. The only network calls go to the SkyMyce relay, and
only when the live API is enabled.

## Quick start

Requires Node 20 or newer. There is nothing to install.

```bash
node build.mjs                                     # build into _site/ for the configured BASE_PATH (/SM-Web/)
node tools/serve.mjs --base /SM-Web/               # http://localhost:8080/SM-Web/
node tools/selftest.mjs && node tools/check-links.mjs
node tools/media-audit.mjs                         # which screenshots and clips are still missing
```

The same commands are available as `npm run build`, `npm run serve`, `npm test` and `npm run media`.

**Root path.** `npm run serve:root` builds into `_site-root/` with `--base /` and serves it at
`http://localhost:8080/`.

**Git Bash on Windows** rewrites arguments that look like paths (`/SM-Web/` becomes `C:/Program Files/Git/SM-Web/`).
Prefix those commands with `MSYS_NO_PATHCONV=1`, or use PowerShell or the npm scripts.

## Base path handling

The site works at `/` and at any sub-path without code changes:

- **Pages** link with relative URLs computed at build time, for example `../../docs/`, so one build works
  wherever it is served.
- **JavaScript** resolves every URL from its own module location (`new URL("../../", import.meta.url)` in
  `core.js`).
- **Absolute URLs** (canonical, Open Graph, sitemap, robots) come from `SITE_ORIGIN + BASE_PATH`.
- **`404.html`** is served by GitHub Pages at any depth, so it uses absolute `BASE_PATH` links. This is the
  only place where a wrong `BASE_PATH` would break links.

To move the site (a custom domain, or a repository renamed to `skymyce.github.io`), change `SITE_ORIGIN`
and `BASE_PATH` in `site.config.js` and rebuild.

## Configuration: `site.config.js`

| Key | Meaning |
| --- | --- |
| `SITE_ORIGIN`, `BASE_PATH` | Where the site is served. Default: `https://skymyce.github.io` + `/SM-Web/`. |
| `API_BASE` | Relay URL. It goes into the CSP and every API call. |
| `github.*` | Mod repo, releases, issues and this site's repo. |
| `discordInvite` | **TODO.** Empty hides all invite links. |
| `social` | **TODO.** List of `{ label, url }`. Empty hides it. |
| `features.liveApi` | `false` until the relay serves the browser endpoints in `docs/api-contract.md`. While false, no request goes to the relay and live areas show **Preview data**. |
| `features.webLogin` | Discord sign-in on the website (needs relay changes). |
| `features.webChatSend` | Lets the web chat send. Read-only by default. |
| `features.adminPanel`, `features.status` | Show the team console link and the status page. |
| `signing` | Release key id and Ed25519 public key (from the mod's `gradle.properties`). The download page verifies the signed manifest with it. |
| `requirements` | Minecraft, Java, Fabric Loader, Fabric Language Kotlin, Fabric API and SkyblockPV versions. Pages read them as `{{requirements.minecraft}}` tokens, so each value is written once. |
| `customDomain` | When set, the build writes a `CNAME` file. |

The release version itself comes from the relay's signed manifest when it is reachable. Otherwise it is the
newest entry in `src/data/changelog.json`.

### Data badges

Every live area labels its data:

- **Live**: from the relay.
- **Preview data**: the live API is disabled; deterministic demo data with visibly fake names.
- **Offline preview**: the live API is enabled but unreachable. The status page shows "Status unavailable"
  instead of demo bars.

## Project layout

```
site.config.js            the one config file (also shipped to the browser as assets/js/config.js)
build.mjs                 static build, zero dependencies
src/pages/**              page bodies; a <!--meta {...}--> JSON header sets title, description, layout and scripts
src/data/                 docs.json (docs nav), media-slots.json, changelog.json, incidents.json
src/assets/css/           site.css (design tokens and components), admin.css
src/assets/js/            main (motion, nav, lightbox), core, auth, per-page modules, preview-data
src/assets/img/           mark.svg (logo), favicons, og.png, cape textures
src/assets/media/         screenshots and clips (see docs/CAPTURE-GUIDE.md)
tools/                    serve, selftest, check-links, media-audit, render-brand (optional)
docs/                     api-contract.md, CAPTURE-GUIDE.md, mod-repo-cleanup.md
.github/workflows/pages.yml
```

## Adding content

**A page.** Create `src/pages/<path>/index.html` starting with:

```html
<!--meta {"title": "Title", "description": "One sentence.", "nav": "community", "scripts": ["my-module"]} -->
<section class="page-intro">...</section>
```

Link with `~/` (for example `href="~/docs/"`); the build rewrites it for the base path. Add an optional
`"noindex": true` to keep a page out of search engines and the sitemap.

**A doc.** Add the page with `"layout": "docs"`, `"updated": "YYYY-MM-DD"` and an optional `"lead"`, then add
it to `src/data/docs.json`. The sidebar, previous/next links, table of contents and search index update
automatically. Wrap commands as `<div class="code"><pre>/sm ...</pre></div>`; they get a Copy button.

**A media slot.** Declare it in `src/data/media-slots.json` (`kind`, `aspect`, `alt`, `spec`, optional
`caption`), then place `<media-slot id="page/slot-id"></media-slot>` in a page. Add the file following
`docs/CAPTURE-GUIDE.md`. `tools/selftest.mjs` fails if a declared slot isn't used anywhere.

**A changelog entry.** Add it at the top of `src/data/changelog.json`.

## Deploying to GitHub Pages

1. Push this repository (branch `main`) to `https://github.com/SkyMyce/SM-Web`.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` builds, runs the checks, and deploys on every push to
   `main`. You can also run it manually from the Actions tab.
4. The site appears at `https://skymyce.github.io/SM-Web/`.

There are no server functions, custom headers or redirects:

- The CSP is a `<meta>` tag.
- Clean URLs are `index.html` directories.
- `404.html` and `.nojekyll` are generated.

### Custom domain later

1. Set `customDomain` (for example `"skymyce.net"`), `SITE_ORIGIN` (`"https://skymyce.net"`) and
   `BASE_PATH` (`"/"`) in `site.config.js`, and push.
2. At your DNS provider, point an apex domain to GitHub's Pages IPs (A records `185.199.108.153`,
   `.109.153`, `.110.153`, `.111.153`), or a subdomain with a CNAME to `skymyce.github.io`.
3. In **Settings → Pages**, enter the domain and enable **Enforce HTTPS** once the certificate is issued.
4. Add the new origin to the relay's CORS and `return_to` allowlists (`docs/api-contract.md`) and to
   `fabric.mod.json` `contact.homepage`.

No page code changes are needed.

## Backend

Every endpoint the site expects is in **`docs/api-contract.md`**. It covers:

- which endpoints exist in the relay today and which are new;
- the token-based Discord sign-in flow;
- CORS, the WebSocket Origin check, rate limits and error shapes;
- admin authorization, which is always enforced server-side.

The relay is not modified by this repository.

## Security notes

- The CSP allows scripts only from this site, with no inline scripts or styles. A meta CSP can't set
  `frame-ancestors`, so the team console refuses to run inside a frame.
- User content (chat, names, cosmetics, leaderboard names) is only ever inserted as text.
- Sign-in tokens live in memory and `sessionStorage`, never in URLs, `localStorage` or cookies.
- `robots.txt` is only honoured at a domain root. Under `/SM-Web/` the `noindex` meta tags on `/admin/`,
  `/community/connect/` and `404.html` do that job.

## License

The site's code is licensed under the **GNU General Public License v3.0**; see [`LICENSE`](LICENSE).

The SkyMyce logo (`src/assets/img/mark.svg` and the PNGs rendered from it) is redrawn from the mod's mascot.
The cape textures in `src/assets/img/capes/` are copied from the mod. Both belong to the SkyMyce project, and
the mod repository uses its own licence. The owners should confirm whether these assets may be distributed
under the GPL, or mark them as excluded.

SkyMyce is not affiliated with Hypixel or Mojang.
