// Deterministic demo data for preview/offline mode. Shapes match the relay (or the NEW endpoints
// specified in docs/api-contract.md). Names are visibly fake; every view that uses this shows a badge.
import { seeded } from "./core.js";
import { COVERAGE, METRICS, SOURCE, periodStart } from "./metrics.js";

const NAMES = ["Preview_Mage", "Demo_Archer", "SampleTank", "Preview_Healer", "Demo_Berserk", "MockRunner", "Preview_Rat", "DemoCarry",
  "SampleLeaper", "Preview_Bonzo", "Demo_Scarf", "MockStorm", "PreviewGoldor", "Demo_Necron", "SampleThorn", "Preview_Livid",
  "DemoSadan", "MockMaxor", "Preview_Lever", "Demo_Device", "SampleSS", "Preview_EE2", "DemoCrypt", "MockSecret"];

function players(metric, period) {
  const rand = seeded(`${metric}:${period}`);
  const count = period === "weekly" ? 18 : period === "monthly" ? 31 : 47;
  const scale = period === "weekly" ? .12 : period === "monthly" ? .35 : 1;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const anon = rand() < .28;
    const name = anon ? "Anonymous player" : `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ""}`;
    let value, sampleSize;
    if (metric === "dungeon_runs") { value = Math.max(1, Math.round((900 * rand() ** 2.2 + 3) * scale)); sampleSize = value; }
    else if (metric === "dungeon_profit") { sampleSize = Math.max(1, Math.round((600 * rand() ** 2 + 2) * scale)); value = Math.round(sampleSize * (rand() * 1.4e6 - 1.2e5)); }
    else if (metric === "dungeon_run_time") { sampleSize = Math.max(3, Math.round((300 * rand() ** 2 + 3) * scale)); value = Math.round(310000 + rand() * 420000); }
    else { value = Math.max(1, Math.round((38 * rand() ** 2.6 + 1) * scale)); sampleSize = value; }
    rows.push({ player: name, value, sampleSize, updatedAt: Date.UTC(2026, 9, 19) - Math.floor(rand() * 6) * 86400000 - Math.floor(rand() * 86400000),
      source: "client-observation", verification: "unverified" });
  }
  return rows;
}

/** Mirrors GET /community/leaderboard (LeaderboardResult v1), including RANK() ties and search. */
export function previewLeaderboard({ category, metric, period = "all-time", page = 1, limit = 10, search = "" }) {
  const def = METRICS[metric];
  const now = Date.UTC(2026, 9, 20, 12);
  const base = { ok: true, version: 1, category, metric, period, startAt: periodStart(period, now), endAt: now, metricLabel: def.label,
    description: def.description, unit: def.unit, aggregation: def.aggregation, available: def.available !== false, source: SOURCE, coverage: COVERAGE,
    page, limit, search, updatedAt: 0, total: 0, hasNext: false, entries: [], ...(def.reason ? { reason: def.reason } : {}) };
  if (def.available === false) return base;
  const asc = def.aggregation === "event-average";
  const sorted = players(metric, period).sort((a, b) => asc ? a.value - b.value : b.value - a.value);
  let rank = 0;
  const ranked = sorted.map((row, i) => ({ ...row, rank: i && sorted[i - 1].value === row.value ? rank : (rank = i + 1) }));
  const query = search.toLowerCase();
  // Anonymous names are never searchable by private username (relay rule): they only match the literal label.
  const filtered = ranked.filter(row => row.player.toLowerCase().includes(query));
  const entries = filtered.slice((page - 1) * limit, page * limit);
  return { ...base, total: filtered.length, updatedAt: Math.max(0, ...filtered.map(r => r.updatedAt)), entries, hasNext: page * limit < filtered.length };
}

/** Global Chat messages in the rich (model 1) shape the relay sends to subscribed clients. */
export function previewChat() {
  const t0 = Date.UTC(2026, 9, 20, 18, 2);
  const sender = (name, source, discordId) => ({ name, discordId, ...(source === "minecraft" ? { uuid: "0".repeat(32) } : {}) });
  const m = (i, from, source, text, extra = {}) => ({ type: "irc_message", model: 1, scope: "global", room: "global-chat", id: `preview${String(i).padStart(25, "0")}`,
    source, from, text, timestamp: t0 + i * 47000, sender: sender(from, source, String(100000000000000000 + i)), media: [], revision: 0, reactions: [], mention: false, ...extra });
  return [
    m(1, "Preview_Mage", "minecraft", "anyone up for M7? need a healer, I have EE2 covered"),
    m(2, "demo.discord", "discord", "this is a preview message bridged from Discord", { reactions: [{ emoji: "👍", count: 3 }] }),
    m(3, "Demo_Archer", "minecraft", "@Preview_Mage I can heal after this run", { reply: { messageId: "preview" + "1".padStart(25, "0"), from: "Preview_Mage", text: "anyone up for M7? need a healer, I have EE2 covered" } }),
    m(4, "SampleTank", "minecraft", "the Goldor map called my pre-leap before I even looked at it", { reactions: [{ emoji: "🔥", count: 2 }, { emoji: "😂", count: 1 }] }),
    m(5, "demo.discord", "discord", "screenshot of the new splits HUD:", { media: [{ id: "preview-media", type: "image", url: "PREVIEW_IMAGE", name: "splits.png", width: 1200, height: 630 }] }),
    m(6, "Preview_Healer", "minecraft", "", { deleted: true }),
    m(7, "MockRunner", "minecraft", "gg, that was a clean S+", { editedAt: t0 + 7 * 47000 + 9000, revision: 1 }),
  ];
}

/** CosmeticProfile v5 shapes (relay/src/cosmetics.ts). capeAsset is omitted: previews use the four presets. */
export function previewCosmetics() {
  const p = (i, name, nameStyle, scaleY, nametagScale, capePreset, extra = {}) => ({ uuid: String(i).padStart(32, "0"), name, nameStyle, scale: scaleY,
    scaleX: extra.scaleX ?? scaleY, scaleY, scaleZ: extra.scaleZ ?? scaleY, nametagScale, capePreset, capeAsset: null, revision: 1, updatedAt: Date.UTC(2026, 9, 18) - i * 3600_000 });
  return [
    p(1, "Preview Rat", { text: "Preview ", color: "aqua", bold: true, extra: [{ text: "Rat", color: "#b59be6" }] }, 1, 1, "sky-myce"),
    p(2, "Tiny Tank", { text: "Tiny Tank", color: "gold" }, .6, 1.2, "forest"),
    p(3, "Demo Giant", { text: "Demo ", color: "red", extra: [{ text: "Giant", color: "yellow", italic: true }] }, 1.6, .9, "sunset"),
    p(4, "Wide Mage", { text: "Wide Mage", color: "light_purple", underlined: true }, 1, 1, "void", { scaleX: 1.5, scaleZ: 1.5 }),
    p(5, "Sample", { text: "Sample", color: "green", strikethrough: true }, .9, 1.4, null),
    p(6, "Night Owl", { text: "Night ", color: "dark_aqua", extra: [{ text: "Owl", color: "white", bold: true }] }, 1.1, 1, "void"),
  ];
}

/** NEW GET /status shape (docs/api-contract.md). 30 daily buckets per service. */
export function previewStatus() {
  const rand = seeded("status");
  const days = Array.from({ length: 30 }, (_, i) => Date.UTC(2026, 8, 21) + i * 86400000);
  const service = (id, label, description) => ({ id, label, description, state: "operational",
    history: days.map(day => { const r = rand(); return { day, state: r > .97 ? "degraded" : "operational" }; }) });
  return { ok: true, version: 1, checkedAt: Date.UTC(2026, 9, 20, 12), services: [
    service("relay", "Relay API", "Health and community HTTP routes"),
    service("chat", "Global Chat", "Minecraft and Discord chat bridge"),
    service("leaderboards", "Leaderboards", "Community ranking queries"),
    service("releases", "Signed releases", "Release manifest and downloads"),
  ] };
}

/** NEW admin endpoint shapes (docs/api-contract.md section 6). */
export function previewAdmin() {
  const rand = seeded("admin");
  const players = NAMES.slice(0, 18).map((name, i) => ({
    accountId: `acct_${String(i + 1).padStart(4, "0")}`, discordId: String(200000000000000000 + i * 7919), discordName: `${name.toLowerCase()}#discord`,
    minecraft: [{ uuid: (i + 10).toString(16).padStart(32, "0"), name }], status: i === 4 ? "blacklisted" : "active",
    sharing: ["on", "on-anon", "on-anon", "off"][i % 4], lastSeen: Date.UTC(2026, 9, 20) - Math.floor(rand() * 20) * 3600_000,
    sessions: 1 + Math.floor(rand() * 2), cosmetics: { name: rand() > .5, cape: rand() > .7 }, deviceObserved: rand() > .2 }));
  const reports = [
    { id: "rpt_0001", kind: "chat", status: "open", createdAt: Date.UTC(2026, 9, 20, 9), reporter: "Demo_Archer", target: "MockRunner", reason: "Spam", excerpt: "(preview) repeated message" },
    { id: "rpt_0002", kind: "cosmetic", status: "open", createdAt: Date.UTC(2026, 9, 19, 21), reporter: "SampleTank", target: "Preview_Rat", reason: "Offensive cape", excerpt: "Cape asset 1f2e…" },
    { id: "rpt_0003", kind: "chat", status: "resolved", createdAt: Date.UTC(2026, 9, 18, 14), reporter: "Preview_Mage", target: "Demo_Scarf", reason: "Harassment", excerpt: "(preview) message removed" },
  ];
  const uploads = [
    { assetId: "a".repeat(32), player: "Preview_Rat", size: 1834, width: 64, height: 32, createdAt: Date.UTC(2026, 9, 20, 8), status: "ready", preset: "sunset" },
    { assetId: "b".repeat(32), player: "Demo_Archer", size: 2210, width: 64, height: 32, createdAt: Date.UTC(2026, 9, 19, 17), status: "ready", preset: "forest" },
  ];
  const blacklist = [{ kind: "minecraft", identity: (14).toString(16).padStart(32, "0"), label: "Demo_Berserk", reason: "Administrator moderation", actor: "Preview admin", at: Date.UTC(2026, 9, 17) }];
  const audit = [
    { at: Date.UTC(2026, 9, 20, 10, 4), actor: "Preview admin", action: "blacklist_add", target: "Demo_Berserk", detail: "kind=minecraft" },
    { at: Date.UTC(2026, 9, 19, 16, 40), actor: "Preview admin", action: "session_kick", target: "MockRunner", detail: "" },
    { at: Date.UTC(2026, 9, 18, 12, 0), actor: "system", action: "traffic_cooldown", target: "DemoCarry", detail: "Repeated incoming traffic limit violations" },
  ];
  return { players, reports, uploads, blacklist, audit };
}
