// Team console. The front-end gate is UX only: every /community/admin/* endpoint must check the caller's
// durable admin flag server-side (docs/api-contract.md section 6). Preview mode uses local mock data, saves
// nothing, and is bannered. Mutations are optimistic and roll back if the request fails.
import { config, fmt, h, siteUrl, toast } from "./core.js";
import { authFetch, currentSession, logout, onSession, startLogin, startPreviewSession } from "./auth.js";
import { previewAdmin, previewChat } from "./preview-data.js";

// A meta CSP cannot set frame-ancestors and GitHub Pages sends no X-Frame-Options, so refuse to run framed.
if (window.top !== window.self) { document.body.replaceChildren(); throw new Error("framed"); }

const $ = sel => document.querySelector(sel);
const main = $("[data-adm-main]"), drawer = $("[data-adm-drawer]");
const SHARING = { on: "On", "on-anon": "On (anon)", off: "Off" };
let db = null, preview = true, simulateFailure = false, lastFocus = null;

// ---------- API (live or preview) ----------
async function api(path, init) {
  if (!preview) return authFetch(`/community/admin${path}`, init);
  await new Promise(r => setTimeout(r, 350));
  if (simulateFailure && init?.method && init.method !== "GET") throw new Error("simulated_failure");
  return { ok: true };
}
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

/** Apply locally, send, and undo on failure. */
async function optimistic(apply, undo, request, done) {
  apply(); route();
  try { await request(); toast(done); }
  catch (error) { undo(); route(); toast(`Failed and rolled back: ${error.message}`, "error"); }
}

function audit(action, target, detail = "") {
  db.audit.unshift({ at: Date.now(), actor: currentSession()?.identity?.displayName ?? "you", action, target, detail });
}

// ---------- Confirm dialog ----------
function confirmAction({ title, text, ok = "Confirm", reason = false }) {
  const dialog = $("[data-adm-confirm]");
  $("[data-adm-confirm-title]").textContent = title;
  $("[data-adm-confirm-text]").textContent = text;
  $("[data-adm-confirm-ok]").textContent = ok;
  $("[data-adm-confirm-reason-wrap]").hidden = !reason;
  const input = $("[data-adm-confirm-reason]"); input.value = "";
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok" ? { reason: input.value.trim() || "Administrator moderation" } : null), { once: true }));
}

// ---------- Tables ----------
function table({ columns, rows, onOpen, empty = "Nothing here." }) {
  const tbody = h("tbody", {}, rows.length ? rows.map((row, i) => {
    const tr = h("tr", { tabindex: onOpen ? "0" : null, dataset: { index: i } }, columns.map(c => h("td", { class: c.num ? "num" : "" }, c.render(row))));
    if (onOpen) { tr.addEventListener("click", event => { if (!event.target.closest("button, a, select")) onOpen(row, tr); }); tr.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); onOpen(row, tr); } }); }
    return tr;
  }) : [h("tr", {}, h("td", { colspan: String(columns.length), class: "empty" }, empty))]);
  return h("div", { class: "table-wrap" }, h("table", { class: "adm-table" }, h("thead", {}, h("tr", {}, columns.map(c => h("th", { scope: "col", class: c.num ? "num" : "" }, c.label)))), tbody));
}
const statusBadge = status => h("span", { class: `badge ${status === "active" || status === "resolved" ? "badge--live" : status === "open" ? "badge--preview" : "badge--offline"}` }, status);
function filterBar(placeholder, value, onInput, extra = []) {
  const input = h("input", { class: "input", type: "search", placeholder, value, "data-filter": "", "aria-label": placeholder });
  input.addEventListener("input", () => onInput(input.value));
  return h("div", { class: "adm-filters" }, input, ...extra);
}

// ---------- Sections ----------
const state = { playerQuery: "", playerStatus: "all", reportStatus: "open", auditQuery: "" };
const SECTIONS = {
  overview: () => {
    const open = db.reports.filter(r => r.status === "open").length;
    return [h("h1", {}, "Overview"), h("div", { class: "adm-stats" },
      stat("Players", db.players.length, "#/players"), stat("Open reports", open, "#/reports"),
      stat("Uploads to review", db.uploads.filter(u => u.status === "ready").length, "#/cosmetics"), stat("Blacklisted identities", db.blacklist.length, "#/blacklist")),
      h("h2", {}, "Recent actions"), auditTable(db.audit.slice(0, 6))];
  },
  players: () => {
    const q = state.playerQuery.toLowerCase();
    const rows = db.players.filter(p => (state.playerStatus === "all" || p.status === state.playerStatus) &&
      (!q || p.minecraft.some(m => m.name.toLowerCase().includes(q) || m.uuid.includes(q)) || p.discordName.toLowerCase().includes(q) || p.discordId.includes(q)));
    const status = h("select", { class: "select", "aria-label": "Status" }, ["all", "active", "blacklisted"].map(s => h("option", { value: s, selected: s === state.playerStatus }, s === "all" ? "All statuses" : s)));
    status.addEventListener("change", () => { state.playerStatus = status.value; route(); });
    return [h("h1", {}, "Players"), filterBar("Filter by IGN, UUID, Discord name or ID", state.playerQuery, v => { state.playerQuery = v; renderKeepFocus(); }, [status]),
      table({ rows, onOpen: openPlayer, empty: "No players match.", columns: [
        { label: "Minecraft", render: p => p.minecraft.map(m => m.name).join(", ") },
        { label: "Discord", render: p => p.discordName },
        { label: "Status", render: p => statusBadge(p.status) },
        { label: "Sharing", render: p => SHARING[p.sharing] },
        { label: "Sessions", num: true, render: p => String(p.sessions) },
        { label: "Last seen", render: p => fmt.relative(p.lastSeen) }] })];
  },
  reports: () => {
    const rows = db.reports.filter(r => state.reportStatus === "all" || r.status === state.reportStatus);
    const status = h("select", { class: "select", "aria-label": "Report status" }, ["open", "resolved", "dismissed", "all"].map(s => h("option", { value: s, selected: s === state.reportStatus }, s)));
    status.addEventListener("change", () => { state.reportStatus = status.value; route(); });
    return [h("h1", {}, "Reports"), h("div", { class: "adm-filters" }, status), table({ rows, empty: "No reports in this view.", columns: [
      { label: "Received", render: r => fmt.dateTime(r.createdAt) }, { label: "Kind", render: r => r.kind }, { label: "Target", render: r => r.target },
      { label: "Reason", render: r => r.reason }, { label: "Excerpt", render: r => h("span", { class: "subtle" }, r.excerpt) }, { label: "Status", render: r => statusBadge(r.status) },
      { label: "Actions", render: r => r.status !== "open" ? "" : h("div", { class: "btn-row" },
        h("button", { class: "btn btn--sm", type: "button", onclick: () => setReport(r, "resolved") }, "Resolve"),
        h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => setReport(r, "dismissed") }, "Dismiss")) }] })];
  },
  chat: () => [h("h1", {}, "Chat moderation"), h("p", { class: "subtle" }, "Recent Global Chat messages (live metadata is kept for 15 minutes). Deleting removes the message for Minecraft and Discord."),
    table({ rows: db.chat, empty: "No recent messages.", columns: [
      { label: "Time", render: m => fmt.time(m.timestamp) }, { label: "From", render: m => `${m.sender?.name ?? m.from} (${m.source})` },
      { label: "Message", render: m => m.deleted ? h("em", { class: "subtle" }, "deleted") : m.text || "(media)" },
      { label: "Actions", render: m => m.deleted ? "" : h("div", { class: "btn-row" },
        h("button", { class: "btn btn--danger btn--sm", type: "button", onclick: () => deleteMessage(m) }, "Delete"),
        m.source === "minecraft" ? h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => blacklistIdentity("minecraft", m.sender?.uuid ?? "", m.sender?.name ?? m.from) }, "Blacklist") : null) }] })],
  cosmetics: () => [h("h1", {}, "Cosmetics"), h("p", { class: "subtle" }, "Uploaded capes (64 × 32 PNG, validated on upload). Removing one resets the owner's cape."),
    h("ul", { class: "adm-capes" }, db.uploads.length ? db.uploads.map(u => {
      const swatch = h("div", { class: "adm-cape", "aria-hidden": "true" });
      swatch.style.backgroundImage = `url("${siteUrl(`assets/img/capes/${u.preset}.png`)}")`;
      return h("li", { class: "card" }, swatch, h("strong", {}, u.player), h("span", { class: "subtle" }, `${u.width}×${u.height} · ${fmt.bytes(u.size)} · ${fmt.dateTime(u.createdAt)}`),
        statusBadge(u.status === "ready" ? "active" : u.status),
        u.status === "ready" ? h("button", { class: "btn btn--danger btn--sm", type: "button", onclick: () => removeUpload(u) }, "Remove") : null);
    }) : [h("li", { class: "empty" }, "No uploads.")])],
  blacklist: () => [h("h1", {}, "Identity blacklist"), h("p", { class: "subtle" }, "Blacklisting revokes sessions and blocks community access for a Discord account or Minecraft UUID."),
    table({ rows: db.blacklist, empty: "No blacklisted identities.", columns: [
      { label: "Kind", render: b => b.kind }, { label: "Identity", render: b => h("code", {}, b.label ?? b.identity) }, { label: "Reason", render: b => b.reason },
      { label: "By", render: b => b.actor }, { label: "Since", render: b => fmt.date(b.at) },
      { label: "Actions", render: b => h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => unblacklist(b) }, "Remove") }] })],
  audit: () => {
    const q = state.auditQuery.toLowerCase();
    return [h("h1", {}, "Audit log"), filterBar("Filter by action, actor or target", state.auditQuery, v => { state.auditQuery = v; renderKeepFocus(); }),
      auditTable(db.audit.filter(a => !q || `${a.action} ${a.actor} ${a.target} ${a.detail}`.toLowerCase().includes(q)))];
  },
};
const stat = (label, value, href) => h("a", { class: "adm-stat", href }, h("span", {}, label), h("strong", {}, String(value)));
const auditTable = rows => table({ rows, empty: "No entries.", columns: [
  { label: "When", render: a => fmt.dateTime(a.at) }, { label: "Actor", render: a => a.actor }, { label: "Action", render: a => h("code", {}, a.action) },
  { label: "Target", render: a => a.target }, { label: "Detail", render: a => h("span", { class: "subtle" }, a.detail) }] });

// ---------- Actions ----------
function setReport(report, status) {
  const before = report.status;
  optimistic(() => { report.status = status; audit(`report_${status}`, report.target, report.id); }, () => { report.status = before; db.audit.shift(); },
    () => post(`/reports/${report.id}`, { status }), `Report ${status}.`);
}
async function deleteMessage(message) {
  if (!await confirmAction({ title: "Delete message?", text: `Removes this message from Minecraft and Discord for everyone.`, ok: "Delete" })) return;
  optimistic(() => { message.deleted = true; audit("chat_delete", message.sender?.name ?? message.from); }, () => { message.deleted = false; db.audit.shift(); },
    () => post(`/chat/${message.id}/delete`), "Message deleted.");
}
async function removeUpload(upload) {
  if (!await confirmAction({ title: "Remove cape?", text: `Deletes ${upload.player}'s uploaded cape and resets their cape.`, ok: "Remove", reason: true })) return;
  optimistic(() => { upload.status = "removed"; audit("cape_remove", upload.player, upload.assetId.slice(0, 8)); }, () => { upload.status = "ready"; db.audit.shift(); },
    () => api(`/cosmetics/assets/${upload.assetId}`, { method: "DELETE" }), "Cape removed.");
}
async function blacklistIdentity(kind, identity, label) {
  const ok = await confirmAction({ title: `Blacklist ${label}?`, text: "Revokes their sessions and blocks community access until removed.", ok: "Blacklist", reason: true });
  if (!ok) return;
  const entry = { kind, identity, label, reason: ok.reason, actor: "you", at: Date.now() };
  const player = db.players.find(p => p.minecraft.some(m => m.uuid === identity || m.name === label));
  const before = player?.status;
  optimistic(() => { db.blacklist.unshift(entry); if (player) player.status = "blacklisted"; audit("blacklist_add", label, `kind=${kind}; ${ok.reason}`); },
    () => { db.blacklist.splice(db.blacklist.indexOf(entry), 1); if (player) player.status = before; db.audit.shift(); },
    () => post("/blacklist", { kind, identity, reason: ok.reason }), `${label} blacklisted.`);
}
async function unblacklist(entry) {
  const ok = await confirmAction({ title: `Remove ${entry.label ?? entry.identity} from the blacklist?`, text: "They can reconnect to community services.", ok: "Remove", reason: true });
  if (!ok) return;
  const index = db.blacklist.indexOf(entry), player = db.players.find(p => p.minecraft.some(m => m.uuid === entry.identity));
  optimistic(() => { db.blacklist.splice(index, 1); if (player) player.status = "active"; audit("blacklist_remove", entry.label ?? entry.identity, ok.reason); },
    () => { db.blacklist.splice(index, 0, entry); if (player) player.status = "blacklisted"; db.audit.shift(); },
    () => api(`/blacklist/${entry.kind}/${entry.identity}`, { method: "DELETE" }), "Removed from blacklist.");
}

function openPlayer(player, row) {
  lastFocus = row;
  $("[data-adm-drawer-title]").textContent = player.minecraft.map(m => m.name).join(", ");
  const sharing = h("select", { class: "select", "aria-label": "Community data sharing" }, Object.entries(SHARING).map(([v, l]) => h("option", { value: v, selected: v === player.sharing }, l)));
  sharing.addEventListener("change", async () => {
    const next = sharing.value, before = player.sharing;
    if (next === "off" && !await confirmAction({ title: "Turn sharing off?", text: "Removes this player's prior contributions. It cannot be undone.", ok: "Turn off" })) { sharing.value = before; return; }
    optimistic(() => { player.sharing = next; audit("sharing_set", player.minecraft[0].name, `${before} → ${next}`); }, () => { player.sharing = before; sharing.value = before; db.audit.shift(); },
      () => post(`/players/${player.accountId}/sharing`, { mode: next }), "Sharing updated.");
  });
  $("[data-adm-drawer-body]").replaceChildren(
    h("dl", { class: "adm-dl" },
      h("dt", {}, "Account"), h("dd", {}, h("code", {}, player.accountId)),
      h("dt", {}, "Discord"), h("dd", {}, `${player.discordName} · `, h("code", {}, player.discordId)),
      h("dt", {}, "Minecraft"), h("dd", {}, player.minecraft.map(m => h("div", {}, `${m.name} `, h("code", {}, m.uuid)))),
      h("dt", {}, "Status"), h("dd", {}, statusBadge(player.status)),
      h("dt", {}, "Sessions"), h("dd", {}, `${player.sessions} active · last seen ${fmt.relative(player.lastSeen)}`),
      h("dt", {}, "Device observed"), h("dd", {}, player.deviceObserved ? "Yes (hash on file, admin-only)" : "No"),
      h("dt", {}, "Cosmetics"), h("dd", {}, `${player.cosmetics.name ? "Custom name" : "No name"} · ${player.cosmetics.cape ? "custom cape" : "no cape"}`)),
    h("label", { class: "field" }, h("span", {}, "Community data sharing"), sharing),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn--sm", type: "button", onclick: async () => {
        if (!await confirmAction({ title: "Revoke sessions?", text: "Signs this account out of community services on every device.", ok: "Revoke" })) return;
        const before = player.sessions;
        optimistic(() => { player.sessions = 0; audit("session_kick", player.minecraft[0].name); }, () => { player.sessions = before; db.audit.shift(); }, () => post(`/players/${player.accountId}/sessions/revoke`), "Sessions revoked.");
      } }, "Revoke sessions"),
      h("button", { class: "btn btn--sm", type: "button", onclick: async () => {
        if (!await confirmAction({ title: "Reset cosmetics?", text: "Clears the shared name, sizes and cape for this player.", ok: "Reset", reason: true })) return;
        const before = { ...player.cosmetics };
        optimistic(() => { player.cosmetics = { name: false, cape: false }; audit("cosmetics_reset", player.minecraft[0].name); }, () => { player.cosmetics = before; db.audit.shift(); },
          () => post(`/cosmetics/${player.minecraft[0].uuid}/reset`), "Cosmetics reset.");
      } }, "Reset cosmetics"),
      player.status === "active" ? h("button", { class: "btn btn--danger btn--sm", type: "button", onclick: () => blacklistIdentity("discord", player.discordId, player.discordName) }, "Blacklist Discord")
        : h("span", { class: "subtle" }, "Blacklisted")));
  drawer.hidden = false;
  $("[data-adm-drawer-close]").focus();
}
function closeDrawer() { drawer.hidden = true; lastFocus?.focus(); }
$("[data-adm-drawer-close]").addEventListener("click", closeDrawer);

// ---------- Routing and keyboard ----------
function route() {
  const name = (location.hash.match(/^#\/(\w+)/)?.[1]) ?? "overview";
  const section = SECTIONS[name] ? name : "overview";
  document.querySelectorAll("[data-route]").forEach(a => a.dataset.route === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  main.replaceChildren(...SECTIONS[section]());
}
function renderKeepFocus() {
  const value = document.activeElement?.matches?.("[data-filter]") ? document.activeElement.value : null;
  route();
  if (value !== null) { const input = main.querySelector("[data-filter]"); input.focus(); input.setSelectionRange(value.length, value.length); }
}
addEventListener("hashchange", () => { closeDrawer(); route(); main.focus(); });
document.addEventListener("keydown", event => {
  if (!db || $("[data-adm-confirm]").open) return;
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName ?? "");
  if (event.key === "Escape" && !drawer.hidden) { closeDrawer(); return; }
  if (typing) return;
  const n = Number(event.key);
  if (n >= 1 && n <= 7) { location.hash = `#/${Object.keys(SECTIONS)[n - 1]}`; return; }
  if (event.key === "/") { event.preventDefault(); main.querySelector("[data-filter]")?.focus(); return; }
  if (event.key === "j" || event.key === "k") {
    const rows = [...main.querySelectorAll("tr[tabindex]")];
    if (!rows.length) return;
    const i = rows.indexOf(document.activeElement);
    rows[Math.max(0, Math.min(rows.length - 1, i + (event.key === "j" ? 1 : -1)))].focus();
  }
});

// ---------- Boot ----------
function drawSession(session) {
  const slot = $("[data-adm-session]");
  slot.replaceChildren();
  if (session) slot.append(h("span", { class: "subtle" }, session.identity?.displayName ?? "Signed in"),
    h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => logout() }, "Sign out"));
}
async function boot(session) {
  drawSession(session);
  const gate = $("[data-adm-gate]"), shell = $("[data-adm-shell]"), banner = $("[data-adm-banner]");
  if (!session) {
    db = null; shell.hidden = true; gate.hidden = false; banner.hidden = true; closeDrawer();
    const actions = $("[data-adm-gate-actions]");
    actions.replaceChildren(...[
      config.features.webLogin ? h("button", { class: "btn btn--primary", type: "button", onclick: () => startLogin("admin") }, "Sign in with Discord") : null,
      h("button", { class: `btn ${config.features.webLogin ? "btn--ghost" : "btn--primary"}`, type: "button", onclick: () => startPreviewSession(true) }, "Open preview console")].filter(Boolean));
    $("[data-adm-gate-note]").textContent = config.features.webLogin ? "Admin sessions are short-lived and are not refreshed beyond one hour."
      : "Sign-in is not enabled: the relay's admin endpoints don't exist yet. The preview console uses local mock data.";
    return;
  }
  preview = !!session.preview;
  if (!preview && !session.identity?.admin) {
    shell.hidden = true; gate.hidden = false; $("[data-adm-gate-actions]").replaceChildren();
    $("[data-adm-gate-note]").textContent = "This Discord account doesn't have team access.";
    return;
  }
  gate.hidden = true; shell.hidden = false;
  if (preview) {
    db = { ...previewAdmin(), chat: previewChat() };
    banner.hidden = false;
    const toggle = h("input", { type: "checkbox", id: "sim-fail" });
    toggle.addEventListener("change", () => { simulateFailure = toggle.checked; });
    banner.replaceChildren(h("strong", {}, "Preview mode."), " Local mock data. Nothing is saved or sent. ",
      h("label", { for: "sim-fail" }, toggle, " Simulate failed requests (shows rollback)"));
  } else {
    banner.hidden = true;
    try {
      const [players, reports, uploads, blacklist, auditLog, chat] = await Promise.all(["/players", "/reports", "/cosmetics/uploads", "/blacklist", "/audit", "/chat/recent"].map(path => api(path)));
      db = { players: players.players, reports: reports.reports, uploads: uploads.uploads, blacklist: blacklist.entries, audit: auditLog.entries, chat: chat.messages };
    } catch (error) {
      main.replaceChildren(h("h1", {}, "Console unavailable"), h("p", {}, error.status === 403 ? "The relay refused this session: team access is checked server-side." : "The admin endpoints could not be reached."));
      return;
    }
  }
  route();
}
onSession(boot);
boot(currentSession());
