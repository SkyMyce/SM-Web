// Community hub: weekly top runs (live or preview) and the website session card.
import { config, fmt, h, liveOrPreview, setBadge } from "./core.js";
import { currentSession, logout, onSession, startLogin, startPreviewSession } from "./auth.js";
import { previewLeaderboard } from "./preview-data.js";
import { fetchLeaderboard } from "./metrics.js";

const query = { category: "dungeons", metric: "dungeon_runs", period: "weekly", page: 1, limit: 5, search: "" };
const list = document.querySelector("[data-top-list]");
const { data, state } = await liveOrPreview(
  () => fetchLeaderboard(query),
  () => previewLeaderboard(query));
setBadge(document.querySelector("[data-top-badge]"), state);
list.replaceChildren(...(data.entries.length ? data.entries.map(entry => h("li", {},
  h("span", { class: `lb-rank lb-rank--${entry.rank}` }, `${entry.rank}`),
  h("span", { class: entry.player === "Anonymous player" ? "lb-anon" : "" }, entry.player),
  h("span", { class: "subtle" }, `${fmt.number(entry.value)} runs`))) : [h("li", { class: "empty" }, "No shared runs this week yet.")]));
document.querySelector("[data-top-note]").textContent = `${data.total} Minecraft identities · UTC week from Monday · consenting players only`;

const account = document.querySelector("[data-account]");
function drawAccount(session) {
  account.replaceChildren();
  if (session) {
    const id = session.identity ?? {};
    account.append(
      h("p", {}, "Signed in as ", h("strong", {}, id.displayName ?? id.username ?? "Discord user"), session.preview ? " " : "", session.preview ? h("span", { class: "badge badge--preview" }, "Preview session") : ""),
      h("p", { class: "muted" }, id.minecraft?.length ? `Linked Minecraft: ${id.minecraft.map(m => m.name).join(", ")}` : "No Minecraft account linked yet. Connect from /sm community in game."),
      h("div", { class: "btn-row" }, h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => logout() }, "Sign out")));
    return;
  }
  if (config.features.webLogin) {
    account.append(h("p", { class: "muted" }, "Sign in with Discord to see your rank and read chat as yourself."),
      h("div", { class: "btn-row" }, h("button", { class: "btn btn--primary btn--sm", type: "button", onclick: () => startLogin() }, "Sign in with Discord")));
  } else {
    account.append(h("p", { class: "muted" }, "Website sign-in is not available yet: the relay needs the browser endpoints described in the API contract. Your in-game connection is unaffected."),
      h("div", { class: "btn-row" }, h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => startPreviewSession(false) }, "Explore a preview session")),
      h("p", { class: "data-note" }, "A preview session is a local, fake identity to show the signed-in layout. Nothing is sent anywhere."));
  }
}
onSession(drawAccount);
drawAccount(currentSession());
