// Changelog: local data/changelog.json, with the relay's signed manifest marking the current release when live.
import { apiUrl, config, fetchJSON, fmt, h, localJSON } from "./core.js";
import { verifyRelease } from "./release.js";

const list = document.querySelector("[data-cl-list]"), badge = document.querySelector("[data-cl-badge]");
const data = await localJSON("changelog.json").catch(() => ({ releases: [], source: "" }));
let current = null;
if (config.features.liveApi) {
  try {
    const result = await verifyRelease(await fetchJSON(apiUrl("/community/release")), { ...config.signing, minecraft: config.requirements.minecraft });
    if (result.status === "valid") current = result.manifest;
  } catch { /* fall through to local notes */ }
}
badge.className = `badge ${current ? "badge--live" : "badge--plain"}`;
badge.textContent = current ? `Current signed release: ${current.version}` : "From the site's release notes";
document.querySelector("[data-cl-source]").textContent = data.source ?? "";
const releases = [...data.releases];
if (current && !releases.some(r => r.version === current.version))
  releases.unshift({ version: current.version, date: new Date(current.issuedAt).toISOString().slice(0, 10), notes: (current.notes ?? "").split(/\n+/).filter(Boolean) });
list.replaceChildren(...releases.map(release => h("li", { id: `v${release.version}` },
  h("h2", {}, release.version, h("time", { datetime: release.date }, fmt.date(Date.parse(release.date + "T12:00:00Z"))),
    current?.version === release.version ? h("span", { class: "badge badge--live" }, "Current") : null),
  h("ul", {}, (release.notes.length ? release.notes : ["No notes."]).map(note => h("li", {}, note))))));
