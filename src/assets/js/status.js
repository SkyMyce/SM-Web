// Status: NEW GET /status on the relay (docs/api-contract.md 4.4). Preview data only when the live API is
// disabled; if the relay is enabled but unreachable we show "Status unavailable" rather than demo bars.
import { apiUrl, config, fetchJSON, fmt, h, localJSON, setBadge } from "./core.js";
import { previewStatus } from "./preview-data.js";

const list = document.querySelector("[data-status-list]"), summary = document.querySelector("[data-status-summary]");
const badge = document.querySelector("[data-status-badge]"), note = document.querySelector("[data-status-note]");
const LABEL = { operational: "Operational", degraded: "Degraded", down: "Down", unknown: "Unknown" };
const CLASS = { operational: "ok", degraded: "degraded", down: "down" };

let data = null, state = "preview";
if (config.features.liveApi) {
  try { data = await fetchJSON(apiUrl("/status"), { timeout: 6000 }); state = "live"; } catch { state = "offline"; }
} else data = previewStatus();

if (!data) {
  setBadge(badge, "offline", "The relay could not be reached from your browser.");
  badge.textContent = "Status unavailable";
  summary.textContent = "Status unavailable";
  list.replaceChildren(h("div", { class: "svc" }, h("div", {}, h("h3", {}, "We couldn't reach the status service."),
    h("p", {}, "This can mean the relay is down or your network blocks it. In-game features that need it will say so; local features are unaffected."))));
} else {
  setBadge(badge, state);
  const worst = data.services.some(s => s.state === "down") ? "down" : data.services.some(s => s.state === "degraded") ? "degraded" : "operational";
  summary.textContent = worst === "operational" ? "All services operational" : worst === "degraded" ? "Some services degraded" : "Service disruption";
  list.replaceChildren(...data.services.map(service => {
    // History is optional: the relay may report current health only (see api-contract 4.4).
    const history = service.history ?? [];
    const ok = history.filter(d => d.state === "operational").length;
    return h("div", { class: "svc" },
      h("div", {}, h("h3", {}, service.label), h("p", {}, service.description)),
      h("span", { class: `badge ${service.state === "operational" ? "badge--live" : service.state === "degraded" ? "badge--preview" : "badge--offline"}` }, LABEL[service.state] ?? "Unknown"),
      history.length ? h("div", { class: "uptime", role: "img", "aria-label": `${service.label}: ${ok} of ${history.length} days fully operational` },
        history.map(day => h("i", { class: CLASS[day.state] ?? "", title: `${fmt.date(day.day)}: ${LABEL[day.state] ?? "No data"}` }))) : null,
      history.length ? h("div", { class: "uptime-legend", "aria-hidden": "true" }, h("span", {}, `${history.length} days ago`), h("span", {}, `${ok}/${history.length} days operational`), h("span", {}, "Today")) : null);
  }));
  note.textContent = state === "preview" ? "Preview data: the status endpoint is not deployed yet. These bars are generated, not measured." : `Checked ${fmt.dateTime(data.checkedAt)}.`;
}

const incidents = await localJSON("incidents.json").catch(() => ({ incidents: [] }));
const target = document.querySelector("[data-incidents]");
target.replaceChildren(...(incidents.incidents.length ? incidents.incidents.map(i => h("li", {},
  h("h3", { class: "h3" }, i.title, " ", h("time", { datetime: i.date }, fmt.date(Date.parse(i.date + "T12:00:00Z")))),
  h("p", { class: "muted" }, `${i.status}: ${i.body}`))) : [h("li", {}, h("p", { class: "muted" }, "No incidents recorded."))]));
