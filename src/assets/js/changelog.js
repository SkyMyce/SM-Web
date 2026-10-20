// Release notes are pre-rendered by the build. When the relay is live, mark the current signed release
// (and add it on top if the site's notes don't have it yet).
import { apiUrl, config, fetchJSON, fmt, h } from "./core.js";
import { verifyRelease } from "./release.js";

if (config.features.liveApi) {
  try {
    const result = await verifyRelease(await fetchJSON(apiUrl("/community/release")), { ...config.signing, minecraft: config.requirements.minecraft });
    if (result.status === "valid") {
      const m = result.manifest, badge = document.querySelector("[data-cl-badge]");
      badge.className = "badge badge--live"; badge.textContent = `Current signed release: ${m.version}`;
      let item = document.getElementById(`v${m.version}`);
      if (!item) {
        item = h("li", { id: `v${m.version}` }, h("h2", {}, m.version, " ", h("time", { datetime: new Date(m.issuedAt).toISOString() }, fmt.date(m.issuedAt))),
          h("ul", {}, (m.notes ?? "").split(/\n+/).filter(Boolean).map(note => h("li", {}, note.replace(/^[-*]\s*/, "")))));
        document.querySelector("[data-cl-list]").prepend(item);
      }
      item.querySelector("h2").append(" ", h("span", { class: "badge badge--live" }, "Current"));
    }
  } catch { /* keep the pre-rendered notes */ }
}
