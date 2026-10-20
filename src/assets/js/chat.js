// Web view of Global Chat. Message shapes follow relay/src/irc.ts + irc-model.ts (rich model 1).
// Read-only by default (features.webChatSend). The browser socket endpoint is NEW: docs/api-contract.md section 5.
// All user content is inserted with textContent; URLs must be https, and only Discord CDN media is embedded.
import { config, fmt, h, setBadge, siteUrl } from "./core.js";
import { accessToken, currentSession } from "./auth.js";
import { previewChat } from "./preview-data.js";

const EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "🔥"]; // IRC_EMOJI in irc-model.ts
const MEDIA_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const LIMITS = { burst: 6, refillMs: 2000, minIntervalMs: 250, duplicateMs: 15000, maxLength: 1024 }; // relay defaults
const $ = sel => document.querySelector(sel);
const log = $("[data-chat-log]"), stateEl = $("[data-chat-state]"), input = $("[data-chat-input]"), send = $("[data-chat-send]"), notice = $("[data-chat-notice]");
const messages = new Map();
let replyTo = null, socket = null, mode = "preview", retry = 0;

function setState(state, label) { stateEl.dataset.state = state; stateEl.textContent = label; }

/** Text with @mentions highlighted and https links made clickable. */
function richText(text) {
  const frag = document.createDocumentFragment();
  for (const part of text.split(/(https:\/\/[^\s<>"`]+|@[A-Za-z0-9_][A-Za-z0-9_.]{0,31})/g)) {
    if (!part) continue;
    if (part.startsWith("https://")) {
      let url = null; try { url = new URL(part.replace(/[),.;\]]+$/, "")); } catch {}
      frag.append(url && !url.username && !url.password ? h("a", { href: url.href, rel: "noopener noreferrer nofollow ugc", target: "_blank" }, part) : part);
    } else if (part.startsWith("@")) frag.append(h("span", { class: "mention" }, part));
    else frag.append(part);
  }
  return frag;
}

function mediaNode(item) {
  if (item.url === "PREVIEW_IMAGE") return h("img", { src: siteUrl("assets/img/og.png"), alt: item.name ?? "Image (preview)", loading: "lazy", width: 320, height: 168 });
  const url = (() => { try { const u = new URL(item.url); return u.protocol === "https:" ? u : null; } catch { return null; } })();
  if (!url) return null;
  if (!MEDIA_HOSTS.includes(url.hostname)) return h("a", { class: "file", href: url.href, rel: "noopener noreferrer nofollow ugc", target: "_blank" }, item.name ?? url.hostname);
  if (item.type === "video") return h("video", { src: url.href, controls: true, preload: "none", muted: true, playsinline: true });
  return h("img", { src: url.href, alt: item.name ?? "Shared image", loading: "lazy", ...(item.width ? { width: Math.min(320, item.width) } : {}) });
}

function render(msg) {
  const name = msg.sender?.cosmeticName ?? msg.sender?.name ?? msg.from ?? "Unknown";
  const canAct = mode !== "readonly" && config.features.webChatSend && !msg.deleted;
  const node = h("article", { class: `msg${msg.mention ? " msg--mention" : ""}`, id: `m-${msg.id}`, "aria-label": `${name} at ${fmt.time(msg.timestamp)}` });
  const avatarUrl = msg.sender?.avatarUrl && MEDIA_HOSTS.includes((() => { try { return new URL(msg.sender.avatarUrl).hostname; } catch { return ""; } })()) ? msg.sender.avatarUrl : null;
  const avatar = h("div", { class: "msg__avatar", "aria-hidden": "true" }, avatarUrl ? h("img", { src: avatarUrl, alt: "" }) : name.slice(0, 2).toUpperCase());
  const main = h("div", {});
  if (msg.reply) main.append(h("div", { class: "msg__reply" }, h("b", {}, msg.reply.from), " ", msg.reply.text || "Original message unavailable"));
  main.append(h("div", { class: "msg__head" }, h("span", { class: "msg__name" }, name),
    h("span", { class: `msg__src msg__src--${msg.source}` }, msg.source === "discord" ? "Discord" : "Minecraft"),
    h("time", { class: "msg__time", datetime: new Date(msg.timestamp).toISOString() }, fmt.time(msg.timestamp)),
    msg.editedAt && !msg.deleted ? h("span", { class: "msg__edited" }, "(edited)") : null));
  if (msg.deleted) main.append(h("p", { class: "msg__deleted" }, msg.moderated ? "Removed by a moderator." : "Message deleted."));
  else {
    if (msg.text) main.append(h("p", { class: "msg__text" }, richText(msg.text)));
    const media = (msg.media ?? []).slice(0, 4).map(mediaNode).filter(Boolean);
    if (media.length) main.append(h("div", { class: "msg__media" }, media));
  }
  if (msg.reactions?.length && !msg.deleted) main.append(h("div", { class: "msg__reactions" }, msg.reactions.filter(r => EMOJI.includes(r.emoji)).map(r =>
    h("button", { class: "reaction", type: "button", "aria-pressed": String(!!r.mine), disabled: !canAct, "aria-label": `${r.emoji} ${r.count} reaction${r.count === 1 ? "" : "s"}`,
      onclick: () => react(msg.id, r.emoji, !r.mine) }, r.emoji, h("span", {}, String(r.count))))));
  if (canAct) main.append(h("div", { class: "msg__actions", role: "toolbar", "aria-label": "Message actions" },
    h("button", { type: "button", title: "Reply", "aria-label": `Reply to ${name}`, onclick: () => startReply(msg) }, "↩"),
    ...EMOJI.slice(0, 4).map(emoji => h("button", { type: "button", "aria-label": `React ${emoji}`, onclick: () => react(msg.id, emoji, true) }, emoji))));
  node.append(avatar, main);
  return node;
}

function upsert(msg) {
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  messages.set(msg.id, msg);
  const existing = document.getElementById(`m-${msg.id}`), node = render(msg);
  if (existing) existing.replaceWith(node); else log.append(node);
  while (log.children.length > 300) { messages.delete(log.firstElementChild.id.slice(2)); log.firstElementChild.remove(); }
  if (nearBottom) log.scrollTop = log.scrollHeight;
}

// ---------- Sending (only when enabled) ----------
const bucket = { credits: LIMITS.burst, updated: Date.now(), last: 0, recent: new Map() };
function localRateCheck(text) {
  const now = Date.now();
  bucket.credits = Math.min(LIMITS.burst, bucket.credits + (now - bucket.updated) / LIMITS.refillMs); bucket.updated = now;
  const key = text.trim().replace(/\s+/g, " ");
  if ((bucket.recent.get(key) ?? 0) > now) return "duplicate_text";
  if (bucket.credits < 1 || now - bucket.last < LIMITS.minIntervalMs) return "rate_limited";
  bucket.credits--; bucket.last = now; bucket.recent.set(key, now + LIMITS.duplicateMs);
  return null;
}
const ERRORS = { rate_limited: "Slow down: you can send a few messages, then one every two seconds.", duplicate_text: "That message was just sent. Wait a few seconds before repeating it.",
  invalid_message: "That message can't be sent. Remove control characters and keep it under 1024 characters.", not_authorized: "Your session can't send right now. Link a Minecraft account in game and sign in again.",
  identity_blacklisted: "This account can't use community chat.", temporarily_unavailable: "Chat is busy. Try again in a moment.", message_expired: "That message is too old to change.",
  message_deleted: "That message was deleted.", reaction_limit: "That message has too many reactions." };
function showNotice(text, warn = false) { notice.textContent = text; notice.classList.toggle("chat__notice--warn", warn); }

function startReply(msg) {
  replyTo = msg;
  $("[data-chat-replying]").hidden = false;
  $("[data-chat-replying-text]").textContent = `Replying to ${msg.sender?.name ?? msg.from}`;
  input.focus();
}
$("[data-chat-cancel-reply]").addEventListener("click", () => { replyTo = null; $("[data-chat-replying]").hidden = true; });
const packetId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");

function react(messageId, emoji, active) {
  if (!config.features.webChatSend || mode === "readonly") return;
  if (mode === "preview") {
    const msg = messages.get(messageId); if (!msg) return;
    const reactions = [...(msg.reactions ?? [])], existing = reactions.find(r => r.emoji === emoji);
    if (existing) { existing.mine = !existing.mine; existing.count += existing.mine ? 1 : -1; } else reactions.push({ emoji, count: 1, mine: true });
    upsert({ ...msg, reactions: reactions.filter(r => r.count > 0) });
    return;
  }
  socket?.send(JSON.stringify({ type: "irc_operation", scope: "global", id: packetId(), messageId, operation: "reaction", emoji, active }));
}

$("[data-chat-form]").addEventListener("submit", event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || send.disabled) return;
  if (text.length > LIMITS.maxLength || /[\x00-\x09\x0b-\x1f\x7f-\x9f§‪-‮⁦-⁩]/.test(text)) { showNotice(ERRORS.invalid_message, true); return; }
  const limited = localRateCheck(text);
  if (limited) { showNotice(ERRORS[limited], true); return; }
  if (mode === "preview") {
    const s = currentSession();
    upsert({ id: packetId(), source: "minecraft", from: s?.identity?.minecraft?.[0]?.name ?? "PreviewPlayer", sender: { name: s?.identity?.minecraft?.[0]?.name ?? "PreviewPlayer" },
      text, timestamp: Date.now(), media: [], reactions: [], ...(replyTo ? { reply: { messageId: replyTo.id, from: replyTo.sender?.name ?? replyTo.from, text: replyTo.text } } : {}) });
    showNotice("Preview: this message stayed in your browser.");
  } else socket?.send(JSON.stringify({ type: "irc_send", scope: "global", id: packetId(), text, ...(replyTo ? { replyTo: replyTo.id } : {}) }));
  input.value = ""; replyTo = null; $("[data-chat-replying]").hidden = true;
});
input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("[data-chat-form]").requestSubmit(); } });

function setComposer(enabled, placeholder, message) {
  input.disabled = send.disabled = !enabled;
  input.placeholder = placeholder;
  showNotice(message);
}

// ---------- Live socket (first-message auth; no token in the URL) ----------
async function connect() {
  const token = await accessToken();
  if (!token) { setState("offline", "Sign in to read chat"); return; }
  setState(retry ? "reconnecting" : "connecting", retry ? "Reconnecting" : "Connecting");
  const api = new URL(config.API_BASE);
  socket = new WebSocket(`wss://${api.host}/community/web/chat`);
  socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "auth", token, scope: "global", send: config.features.webChatSend })));
  socket.addEventListener("message", event => {
    let data; try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === "ready") {
      retry = 0; setState("live", "Live");
      if (data.canSend && config.features.webChatSend) { mode = "live"; setComposer(true, "Message #global", `Sending as ${data.sendAs}. Messages are bridged to Discord.`); }
      else { mode = "readonly"; setComposer(false, "Read-only on the web", "Read-only on the web. Send from the game with /sm irc <message>."); }
    } else if (data.type === "irc_message" && data.scope === "global") upsert(data);
    else if (data.type === "irc_update" || data.type === "irc_operation") {
      const msg = messages.get(data.messageId); if (!msg || (data.revision ?? 0) < (msg.revision ?? 0)) return;
      upsert({ ...msg, revision: data.revision, reactions: data.reactions ?? msg.reactions,
        ...(data.operation === "delete" ? { deleted: true, moderated: !!data.moderated, text: "", media: [] } : {}),
        ...(data.operation === "edit" ? { text: data.text ?? msg.text, media: data.media ?? msg.media, editedAt: Date.now() } : {}) });
    } else if (data.type === "irc_result" && data.error) showNotice(ERRORS[data.error] ?? "Chat rejected that action.", true);
  });
  socket.addEventListener("close", event => {
    if (event.code === 4401 || event.code === 4403) { setState("offline", event.code === 4403 ? "Not allowed" : "Session expired"); return; }
    retry = Math.min(retry + 1, 6);
    setState("reconnecting", "Reconnecting");
    setTimeout(connect, Math.min(30000, 1000 * 2 ** retry) * (0.75 + Math.random() * 0.5));
  });
}

if (config.features.liveApi && config.features.webLogin && currentSession() && !currentSession().preview) {
  setBadge($("[data-chat-badge]"), "live");
  setComposer(false, "Read-only on the web", "");
  connect();
} else {
  mode = "preview";
  setBadge($("[data-chat-badge]"), config.features.liveApi ? "offline" : "preview",
    config.features.liveApi ? "Sign in to read the live channel. Showing demo messages." : undefined);
  setState("preview", "Preview");
  previewChat().forEach(upsert);
  if (config.features.webChatSend) setComposer(true, "Message #global (preview)", "Preview: messages stay in your browser. Rate limits match the relay.");
  else setComposer(false, "Read-only on the web", "Read-only on the web. Send from the game with /sm irc <message>.");
}
