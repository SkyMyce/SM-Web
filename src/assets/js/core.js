// Shared helpers. Base-path aware: every URL is resolved from this module's own location,
// so the same build works at "/" and at any sub-path.
import config from "./config.js";

export { config };
export const siteRoot = new URL("../../", import.meta.url);
export const siteUrl = path => new URL(path.replace(/^\//, ""), siteRoot).href;
export const apiUrl = path => new URL(path, config.API_BASE).href;
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Escape for text placed into HTML strings. Prefer textContent; use this when templating. */
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Tiny element builder. Text is always set via textContent; never pass untrusted HTML. */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}

/** Only https URLs on an allowlist may become src/href in user-generated content. */
export function safeUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (hosts && !hosts.includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export async function fetchJSON(url, { timeout = 8000, ...init } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, credentials: "omit", headers: { Accept: "application/json", ...(init.headers ?? {}) } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(body?.error ?? `http_${response.status}`), { status: response.status, body, retryAfter: response.headers.get("Retry-After") });
    return body;
  } finally { clearTimeout(timer); }
}

/** Local data shipped with the site (data/*.json). */
export const localJSON = name => fetchJSON(siteUrl(`data/${name}`));

/**
 * Live data with an honest fallback. Returns { data, state } where state is
 * "live" (from the relay), "preview" (live API disabled in config) or "offline" (relay unreachable).
 */
export async function liveOrPreview(live, preview) {
  if (!config.features.liveApi) return { data: await preview(), state: "preview" };
  try { return { data: await live(), state: "live" }; }
  catch (error) { console.info("[SkyMyce] live data unavailable, showing preview:", error.message); return { data: await preview(), state: "offline", error }; }
}

const BADGES = { live: ["badge--live", "Live"], preview: ["badge--preview", "Preview data"], offline: ["badge--offline", "Offline preview"] };
export function setBadge(node, state, detail) {
  if (!node) return;
  const [cls, label] = BADGES[state] ?? BADGES.preview;
  node.className = `badge ${cls}`;
  node.textContent = label;
  node.title = detail ?? (state === "live" ? "Data from the SkyMyce relay" : state === "offline"
    ? "The relay could not be reached. Showing deterministic demo data." : "The live service is not connected to this site yet. Showing deterministic demo data.");
}

export function toast(message, kind = "info", ms = 4200) {
  let region = document.querySelector(".toast-region");
  if (!region) { region = h("div", { class: "toast-region", role: "status", "aria-live": "polite" }); document.body.append(region); }
  const node = h("div", { class: `toast${kind === "error" ? " toast--error" : ""}` }, h("span", { text: message }));
  region.append(node);
  setTimeout(() => node.remove(), ms);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const area = h("textarea", { class: "sr-only" }); area.value = text; document.body.append(area); area.select();
    const ok = document.execCommand("copy"); area.remove(); return ok;
  }
}

export const fmt = {
  number: (value, digits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value),
  compact: value => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value),
  bytes: value => value >= 1048576 ? `${(value / 1048576).toFixed(2)} MB` : `${(value / 1024).toFixed(1)} KB`,
  date: ms => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  dateTime: ms => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  time: ms => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  /** Same format as the relay's Discord leaderboard: m:ss.mmm or h:mm:ss.mmm. */
  duration: value => {
    const millis = Math.round(value), minutes = Math.floor(millis / 60000);
    const prefix = millis < 3600000 ? String(minutes) : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
    return `${prefix}:${String(Math.floor(millis / 1000) % 60).padStart(2, "0")}.${String(millis % 1000).padStart(3, "0")}`;
  },
  relative: ms => {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return `${Math.floor(s / 86400)} d ago`;
  },
};

/** Deterministic PRNG for preview data (mulberry32). */
export function seeded(seed) {
  let a = typeof seed === "number" ? seed : [...String(seed)].reduce((acc, c) => Math.imul(acc ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** WAI-ARIA tabs: arrow keys move, Home/End jump, selection follows focus. Panels via aria-controls. */
export function initTabs(list, onSelect) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab, focus = true) => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
      const panel = t.getAttribute("aria-controls") && document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
    onSelect?.(tab);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", event => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); select(tabs[(next + tabs.length) % tabs.length]);
    });
  });
  return { select: (tab, focus) => select(tab, focus) };
}
