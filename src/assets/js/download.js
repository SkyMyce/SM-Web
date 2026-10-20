// Download page: signed release from the relay when available, otherwise the newest local changelog entry.
import { apiUrl, config, fetchJSON, fmt, h, initTabs, localJSON } from "./core.js";
import { verifyRelease } from "./release.js";

const facts = Object.fromEntries([...document.querySelectorAll("[data-f]")].map(node => [node.dataset.f, node]));
const badge = document.querySelector("[data-release-badge]");
const button = document.querySelector("[data-release-download]");
const note = document.querySelector("[data-release-note]");
const notesList = document.querySelector("[data-release-notes]");
const set = (key, value) => facts[key].replaceChildren(value);

const osTabs = document.querySelector("[data-os-tabs]");
if (osTabs) {
  const tabs = initTabs(osTabs);
  const os = /Mac/i.test(navigator.platform) ? "tab-mac" : /Linux|X11/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? "tab-linux" : "tab-win";
  tabs.select(document.getElementById(os), false);
}

function showNotes(lines) {
  notesList.replaceChildren(...lines.slice(0, 6).map(line => h("li", {}, line)));
}

const changelog = await localJSON("changelog.json").catch(() => ({ releases: [] }));
const latest = changelog.releases[0];
let live = null, failure = null;
if (config.features.liveApi) {
  try {
    const envelope = await fetchJSON(apiUrl("/community/release"));
    live = await verifyRelease(envelope, { ...config.signing, minecraft: config.requirements.minecraft });
  } catch (error) { failure = error; }
}

if (live?.status === "valid") {
  const m = live.manifest;
  badge.className = "badge badge--live"; badge.textContent = "Live · signature verified";
  set("version", m.version); set("size", fmt.bytes(m.size)); set("sha256", h("code", {}, m.sha256));
  set("signature", h("span", { class: "badge badge--live" }, `Valid Ed25519 (${config.signing.keyId})`));
  set("date", fmt.date(m.issuedAt));
  button.href = `${apiUrl("/community/artifact")}?version=${encodeURIComponent(m.version)}`;
  button.textContent = `Download ${m.version} (${fmt.bytes(m.size)})`;
  button.removeAttribute("rel");
  note.textContent = `Signed manifest valid until ${fmt.dateTime(m.expiresAt)}. GitHub Releases remains available as a mirror.`;
  const entry = changelog.releases.find(r => r.version === m.version);
  showNotes(typeof m.notes === "string" && m.notes.trim() ? m.notes.split(/\n+/).map(s => s.replace(/^[-*]\s*/, "")).filter(Boolean) : entry?.notes ?? ["See the changelog for details."]);
} else {
  const reason = live ? `The release service returned a manifest that failed verification (${live.reason}). Use GitHub.` :
    failure ? "The release service could not be reached." : "The release service is not connected to this site yet.";
  badge.className = `badge ${live || failure ? "badge--offline" : "badge--preview"}`;
  badge.textContent = live?.status === "unsupported" ? "Signature not checked" : live ? "Verification failed" : failure ? "Release service offline" : "From release notes";
  set("version", latest ? latest.version : "See GitHub");
  set("size", "Shown on the GitHub release");
  set("sha256", "Shown on the GitHub release");
  set("signature", live?.status === "unsupported" ? "Your browser cannot check Ed25519; the in-game updater still does." : "Checked by the in-game updater");
  set("date", latest ? fmt.date(Date.parse(latest.date + "T12:00:00Z")) : "Unknown");
  note.textContent = `${reason} The version above is the newest entry in the site's release notes; GitHub always has the current file.`;
  showNotes(latest?.notes ?? ["See the changelog for details."]);
}
