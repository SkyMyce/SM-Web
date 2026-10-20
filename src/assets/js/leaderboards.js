// Community leaderboards: category tabs, metric/period selectors, search, pagination and per-page sorting.
// Query and result shapes follow relay/src/leaderboards.ts. State is mirrored in the URL query string.
import { fmt, h, liveOrPreview, setBadge } from "./core.js";
import { CATEGORIES, METRICS, PERIODS, fetchLeaderboard } from "./metrics.js";
import { previewLeaderboard } from "./preview-data.js";

const $ = sel => document.querySelector(sel);
const tabsEl = $("[data-lb-tabs]"), metricEl = $("[data-lb-metric]"), periodEl = $("[data-lb-period]"), searchEl = $("[data-lb-search]");
const body = $("[data-lb-body]"), wrap = $("[data-lb-wrap]");
const LIMIT = 10;
const brand = text => String(text ?? "").replaceAll("Sky-Myce", "SkyMyce");

const params = new URLSearchParams(location.search);
const state = { category: CATEGORIES.some(c => c.id === params.get("category")) ? params.get("category") : "dungeons",
  metric: params.get("metric"), period: PERIODS.some(p => p.id === params.get("period")) ? params.get("period") : "all-time",
  page: Math.min(100, Math.max(1, Number(params.get("page")) || 1)), search: (params.get("search") ?? "").slice(0, 100) };
if (!METRICS[state.metric] || METRICS[state.metric].category !== state.category) state.metric = CATEGORIES.find(c => c.id === state.category).metrics[0];
let result = null, sort = { key: "rank", dir: 1 }, seq = 0;

function formatValue(value, unit) {
  if (unit === "milliseconds") return fmt.duration(value);
  if (unit === "coins") return `${value < 0 ? "−" : ""}${fmt.compact(Math.abs(value))} coins`;
  return `${fmt.number(value, 2)} ${unit}`;
}

// Category tabs
CATEGORIES.forEach(cat => tabsEl.append(h("button", { role: "tab", type: "button", id: `tab-${cat.id}`, "aria-controls": "lb-panel",
  "aria-selected": String(cat.id === state.category), tabindex: cat.id === state.category ? "0" : "-1", dataset: { cat: cat.id } }, cat.label)));
const tabButtons = [...tabsEl.children];
tabButtons.forEach((tab, i) => {
  tab.addEventListener("click", () => selectCategory(tab.dataset.cat));
  tab.addEventListener("keydown", event => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabButtons.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = tabButtons[(next + tabButtons.length) % tabButtons.length];
    target.focus(); selectCategory(target.dataset.cat);
  });
});
PERIODS.forEach(p => periodEl.append(h("option", { value: p.id, selected: p.id === state.period }, p.label)));

function fillMetrics() {
  metricEl.replaceChildren(...CATEGORIES.find(c => c.id === state.category).metrics.map(id =>
    h("option", { value: id, selected: id === state.metric }, METRICS[id].label + (METRICS[id].available === false ? " (unavailable)" : ""))));
}
function selectCategory(id) {
  state.category = id; state.metric = CATEGORIES.find(c => c.id === id).metrics[0]; state.page = 1;
  tabButtons.forEach(t => { const on = t.dataset.cat === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
  fillMetrics(); load();
}
fillMetrics();
searchEl.value = state.search;
metricEl.addEventListener("change", () => { state.metric = metricEl.value; state.page = 1; load(); });
periodEl.addEventListener("change", () => { state.period = periodEl.value; state.page = 1; load(); });
let debounce = 0;
searchEl.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = searchEl.value.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 100); state.page = 1; load(); }, 250); });
$("[data-lb-form]").addEventListener("submit", event => event.preventDefault());
$("[data-lb-prev]").addEventListener("click", () => { if (state.page > 1) { state.page--; load(); } });
$("[data-lb-next]").addEventListener("click", () => { if (result?.hasNext && state.page < 100) { state.page++; load(); } });

// Column sorting (current page only)
document.querySelectorAll("[data-sort]").forEach(th => th.querySelector("button").addEventListener("click", () => {
  const key = th.dataset.sort;
  sort = { key, dir: sort.key === key ? -sort.dir : 1 };
  document.querySelectorAll("[data-sort]").forEach(other => other.removeAttribute("aria-sort"));
  th.setAttribute("aria-sort", sort.dir === 1 ? "ascending" : "descending");
  render();
}));

function skeleton() {
  wrap.setAttribute("aria-busy", "true");
  body.replaceChildren(...Array.from({ length: LIMIT }, () => h("tr", {}, ...Array.from({ length: 5 }, () => h("td", {}, h("span", { class: "skeleton" }))))));
}

async function load() {
  const id = ++seq;
  const query = { category: state.category, metric: state.metric, period: state.period, page: state.page, limit: LIMIT, ...(state.search ? { search: state.search } : {}) };
  const url = new URLSearchParams({ category: state.category, metric: state.metric, period: state.period, ...(state.page > 1 ? { page: state.page } : {}), ...(state.search ? { search: state.search } : {}) });
  history.replaceState(null, "", `${location.pathname}?${url}`);
  skeleton();
  const { data, state: source } = await liveOrPreview(() => fetchLeaderboard(query), () => previewLeaderboard({ ...query, search: state.search }));
  if (id !== seq) return; // a newer request superseded this one
  setBadge($("[data-lb-badge]"), source);
  result = data; sort = { key: "rank", dir: 1 };
  document.querySelectorAll("[data-sort]").forEach(th => th.removeAttribute("aria-sort"));
  $('[data-sort="rank"]').setAttribute("aria-sort", "ascending");
  render();
}

function render() {
  wrap.setAttribute("aria-busy", "false");
  const r = result;
  if (!r?.ok) { body.replaceChildren(h("tr", {}, h("td", { colspan: "5", class: "empty" }, "The leaderboard could not be loaded. Try again later; your mod is unaffected."))); return; }
  const def = METRICS[r.metric] ?? {};
  $("[data-lb-label]").textContent = brand(r.metricLabel);
  $("[data-lb-caption]").textContent = `${brand(r.metricLabel)}, ${PERIODS.find(p => p.id === r.period)?.label ?? r.period}`;
  $("[data-lb-description]").textContent = brand(r.description);
  $("[data-lb-value-head]").textContent = def.short ?? "Value";
  $("[data-lb-coverage-text]").textContent = brand(r.coverage);
  $("[data-lb-source-text]").textContent = brand(r.source);
  $("[data-lb-page]").textContent = `Page ${r.page}`;
  $("[data-lb-prev]").disabled = r.page <= 1;
  $("[data-lb-next]").disabled = !r.hasNext || r.page >= 100;
  if (r.available === false) {
    body.replaceChildren(h("tr", {}, h("td", { colspan: "5", class: "lb-unavailable" }, h("strong", {}, "Unavailable. "), brand(r.reason ?? "This metric is unavailable."))));
    $("[data-lb-summary]").textContent = "No data is collected for this metric.";
    return;
  }
  const rows = [...r.entries].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
  });
  body.replaceChildren(...(rows.length ? rows.map(e => h("tr", {},
    h("td", {}, h("span", { class: `lb-rank lb-rank--${e.rank}` }, `#${e.rank}`)),
    h("td", {}, h("span", { class: e.player === "Anonymous player" ? "lb-anon" : "" }, e.player)),
    h("td", { class: "num" }, formatValue(e.value, r.unit)),
    h("td", { class: "num", title: `${e.source}, ${e.verification}` }, fmt.number(e.sampleSize)),
    h("td", { class: "num" }, e.updatedAt ? fmt.date(e.updatedAt) : "—"))) :
    [h("tr", {}, h("td", { colspan: "5", class: "empty" }, r.search ? `No players match "${r.search}".` : "No complete shared records for this selection yet."))]));
  const lastPage = Math.max(1, Math.ceil(r.total / r.limit));
  $("[data-lb-summary]").textContent = `${fmt.number(r.total)} Minecraft identities${r.search ? " match" : ""} · page ${r.page} of ${Math.min(lastPage, 100)}${r.updatedAt ? ` · updated ${fmt.dateTime(r.updatedAt)}` : ""}`;
}

load();
