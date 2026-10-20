// Website session (Discord via the relay). Token flow, not cookies: see docs/api-contract.md section 2.
// Tokens live in memory with a sessionStorage copy (tab-scoped) so a reload keeps you signed in.
// They are never put in URLs, localStorage or cookies, and are sent only as "Authorization: Bearer".
import { apiUrl, config, fetchJSON, h, siteUrl, toast } from "./core.js";

const KEY = "sm.session", FLOW = "sm.oauth";
let session = null;
const listeners = new Set();
try { session = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { session = null; }

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
function save(next) {
  session = next;
  if (next) sessionStorage.setItem(KEY, JSON.stringify(next)); else sessionStorage.removeItem(KEY);
  listeners.forEach(fn => fn(session));
}
export const onSession = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const currentSession = () => session;

/** Starts Discord sign-in through the relay (NEW endpoint). Admin sessions request the "admin" scope. */
export async function startLogin(scope = "web") {
  if (!config.features.webLogin) { toast("Website sign-in is not available yet. Community features work in game with /sm community."); return; }
  const state = random(), verifier = random(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(FLOW, JSON.stringify({ state, verifier, scope, back: location.pathname + location.search, at: Date.now() }));
  const url = new URL(apiUrl("/community/web/oauth/start"));
  url.search = new URLSearchParams({ return_to: siteUrl("community/connect/"), state, code_challenge: challenge, code_challenge_method: "S256", scope }).toString();
  location.assign(url.href);
}

/** Called on /community/connect/: strips the one-time code from the URL first, then exchanges it. */
export async function completeLogin() {
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname); // never leave the code in history
  const flow = JSON.parse(sessionStorage.getItem(FLOW) ?? "null");
  sessionStorage.removeItem(FLOW);
  if (params.get("error")) throw new Error(params.get("error"));
  if (!flow || !params.get("code") || params.get("state") !== flow.state || Date.now() - flow.at > 10 * 60_000) throw new Error("invalid_state");
  const result = await fetchJSON(apiUrl("/community/web/session/exchange"), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: params.get("code"), codeVerifier: flow.verifier }) });
  save({ ...result, preview: false });
  return flow.back;
}

async function refresh() {
  if (!session?.refreshToken || session.refreshExpiresAt <= Date.now()) { save(null); return null; }
  try {
    const result = await fetchJSON(apiUrl("/community/web/session/refresh"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
    save({ ...session, ...result });
    return session;
  } catch { save(null); return null; }
}

/** Returns a usable access token, refreshing when it is about to expire. */
export async function accessToken() {
  if (!session || session.preview) return null;
  if (session.accessExpiresAt - Date.now() < 30_000) await refresh();
  return session?.accessToken ?? null;
}

export async function authFetch(path, init = {}) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error("session_expired"), { status: 401 });
  return fetchJSON(apiUrl(path), { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
}

export async function logout() {
  const token = session && !session.preview ? session.accessToken : null;
  save(null);
  if (token) fetchJSON(apiUrl("/community/web/session/logout"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

/** Preview-only identity so the signed-in UI can be explored without a backend. Clearly labelled everywhere. */
export function startPreviewSession(admin = false) {
  save({ preview: true, scope: admin ? "admin" : "web", accessExpiresAt: Date.now() + 3600_000,
    identity: { discordId: "000000000000000000", username: "preview-user", displayName: admin ? "Preview admin" : "Preview player",
      minecraft: [{ uuid: "00000000000000000000000000000000", name: "PreviewPlayer" }], admin } });
}

export function renderSessionSlot(slot) {
  if (!slot) return;
  const draw = () => {
    slot.replaceChildren();
    if (session) {
      const name = session.identity?.displayName ?? session.identity?.username ?? "Signed in";
      const out = h("button", { class: "btn btn--ghost btn--sm", type: "button" }, "Sign out");
      out.addEventListener("click", () => { logout(); toast("Signed out."); });
      slot.append(h("span", { class: "session-chip" },
        h("span", { class: "session-chip__avatar", "aria-hidden": "true" }, name.slice(0, 1).toUpperCase()),
        h("span", {}, name), session.preview ? h("span", { class: "badge badge--preview" }, "Preview") : null), out);
    } else if (config.features.webLogin) {
      const login = h("button", { class: "btn btn--ghost btn--sm", type: "button" }, "Sign in");
      login.addEventListener("click", () => startLogin());
      slot.append(login);
    }
  };
  onSession(draw); draw();
}
