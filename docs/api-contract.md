# SkyMyce website ↔ relay API contract

Status: proposal. Nothing here has been implemented in the relay. Do not deploy relay changes from this
document without the owner's explicit go-ahead (`relay/README.md`: production is `--env backend`;
preserve bindings, secrets and state).

Legend: **EXISTS** = in `relay/src` today (shape derived from the code, mod repo 2.7.29).
**NEW** = proposed. **CHANGE** = an existing route needs an addition.

| Name | Value |
| --- | --- |
| Site origin | `https://skymyce.github.io` |
| Site base path | `/SM-Web/` |
| Relay (`API_BASE`) | `https://sky-myce-backend.skyblock-relay.workers.dev` |
| Local development origins | `http://localhost:8080` (any port you use with `tools/serve.mjs`) |

---

## 0. Why every live feature is in preview today

1. **No CORS.** No relay response sets `Access-Control-Allow-Origin`, so a page on github.io can't read any
   of them. That includes the public ones (`/health`, `/community/release`). Plain navigation to
   `/community/artifact?version=…` works without CORS; reading the manifest does not.
2. **Mod-only sessions.** `/community/leaderboard`, `/community/journal-comparison`, `/community/sharing`
   and `/community/cosmetics` need a community session token (`Authorization: Bearer <43 chars>`). The token
   comes from `/community/challenge` + `/community/connect/*`, which need a fresh **Minecraft session proof**
   (`verifyAccount`). A browser has no Minecraft identity, so it can't get one.
3. **Chat is Minecraft-WebSocket only.** Global Chat runs on `/websocket` with Minecraft-proof identity
   (`irc.ts`), plus the signed Discord bridge (`/discord/bridge?room=global-chat`).

`site.config.js` → `features.liveApi` stays `false` until sections 1-4 exist. While it is false the site makes
**no** requests to the relay. Every live area shows a **Preview data** badge with deterministic demo data.
With `liveApi: true`, a failed request shows **Offline preview** (or "Status unavailable" on /status).

---

## 1. CORS (CHANGE, applies to every route the site calls)

- Allowlist with **exact** origins, never `*`:
  `["https://skymyce.github.io"]`, plus `http://localhost:<port>` in non-production environments only.
- If `Origin` is in the allowlist: `Access-Control-Allow-Origin: <origin>`, `Vary: Origin`.
  Otherwise send no CORS headers. Don't reflect arbitrary origins.
- Preflight (`OPTIONS`): `Access-Control-Allow-Methods: GET, POST, DELETE`,
  `Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key`, `Access-Control-Max-Age: 600`.
- **Do not** send `Access-Control-Allow-Credentials`. The site never uses cookies (Safari and Firefox block
  third-party cookies anyway).
- Expose `Retry-After` (`Access-Control-Expose-Headers: Retry-After`) so the site can show rate-limit waits.
- WebSockets aren't covered by CORS. Check `Origin` against the same allowlist on upgrade and refuse
  (HTTP 403) on a mismatch.

Routes that need CORS: `/health`, `/status`, `/community/release`, `/community/public/*`,
`/community/web/*`, `/community/admin/*`.

---

## 2. Website sign-in: token flow (NEW)

The design is a relay-mediated Discord OAuth with PKCE, a one-time code returned in the URL **fragment**, and
bearer tokens kept in JS memory, mirrored to `sessionStorage` (tab-scoped). There are no cookies, no tokens
in query strings after the exchange, and no tokens in WebSocket URLs.

The site already implements this: `src/assets/js/auth.js` and `connect.js`.

### 2.1 Sequence

```
Site                                Relay                                   Discord
 |-- GET /community/web/oauth/start ->|                                         |
 |   ?return_to=<allowlisted URL>     |-- 302 authorize?client_id..&state=S2 -->|
 |   &state=S1&code_challenge=C       |                                         |
 |   &code_challenge_method=S256      |<-- GET /community/web/oauth/callback ---|
 |   &scope=web|admin                 |    ?code=D&state=S2                     |
 |                                    |   (exchange D with client secret,       |
 |                                    |    GET /users/@me, blacklist check)     |
 |<-- 303 return_to#code=K&state=S1 --|                                         |
 | (strip fragment immediately)       |                                         |
 |-- POST /community/web/session/exchange {code:K, codeVerifier:V} ------------>|
 |<-- 200 { accessToken, refreshToken, identity, ... } -------------------------|
```

### 2.2 `GET /community/web/oauth/start` (NEW, top-level navigation, no CORS needed)

| Query | Rule |
| --- | --- |
| `return_to` | Must **exactly** equal an allowlisted URL (below). No prefix or regex matching. |
| `state` | 22-128 chars `[A-Za-z0-9_-]`. Echoed back unchanged. |
| `code_challenge` | 43 chars base64url, SHA-256 of the verifier. `code_challenge_method=S256` only. |
| `scope` | `web` (default) or `admin`. |

`return_to` allowlist (production): `https://skymyce.github.io/SM-Web/community/connect/`
Development only: `http://localhost:8080/SM-Web/community/connect/`, `http://localhost:8080/community/connect/`.
If the site moves (custom domain, or a repo renamed to `skymyce.github.io`), add the new URL here and to CORS.

The relay stores a pending flow `{ challenge, return_to, scope, siteState, expiresAt: now+10 min }` keyed by a
fresh relay state `S2`, then redirects to Discord with `scope=identify`, `prompt=consent` and
`redirect_uri = https://sky-myce-backend.skyblock-relay.workers.dev/community/web/oauth/callback`.

### 2.3 `GET /community/web/oauth/callback` (NEW, Discord redirect target)

This is a separate path from the mod's `/community/oauth/callback`, whose flow is bound to a Minecraft connect
flow and a `__Host-` cookie. On success, the relay:

- exchanges the Discord code;
- rejects bots and blacklisted Discord IDs (`community_blacklist`, kind `discord`);
- issues a single-use code `K` (43 chars, TTL 60 s), bound to the challenge, Discord ID and scope;
- redirects with `303 See Other` to `return_to#code=K&state=S1`.

On failure it redirects to `return_to#error=<code>&state=S1`. Error codes: `access_denied`,
`identity_blacklisted`, `discord_unavailable`, `expired`.

The fragment keeps `K` out of server logs and `Referer`. The site removes it with `history.replaceState`
before doing anything else.

### 2.4 `POST /community/web/session/exchange` (NEW)

Request: `{ "code": "K", "codeVerifier": "V" }`. The relay checks `base64url(SHA-256(V)) === challenge`,
deletes `K` (single use), and for `scope=admin` requires `isAdmin(actor)`.

Response `200`:

```json
{
  "ok": true,
  "scope": "web",
  "accessToken": "43 chars base64url",
  "accessExpiresAt": 1792500000000,
  "refreshToken": "43 chars base64url",
  "refreshExpiresAt": 1792528800000,
  "identity": {
    "discordId": "17-20 digits",
    "username": "name",
    "displayName": "Display",
    "avatarUrl": "https://cdn.discordapp.com/avatars/…",
    "minecraft": [{ "uuid": "32 hex", "name": "IGN" }],
    "admin": false
  }
}
```

| Scope | Access TTL | Refresh | Absolute lifetime |
| --- | --- | --- | --- |
| `web` | 15 min | rotating, single use | 8 h |
| `admin` | 5 min | rotating, single use | 60 min, no extension |

Store tokens as SHA-256 hashes, like the existing `community_sessions`. Reusing a rotated refresh token
revokes the whole token family.

**Storage budget** (relay AGENTS.md, Durable Objects free plan): rows are written only on exchange, refresh and
logout. Never write per request or per heartbeat. Per-request auth is a read by token hash.

### 2.5 `POST /community/web/session/refresh` (NEW)

Request `{ "refreshToken": "…" }`. Response: same shape as exchange, with new tokens.
Errors: `401 session_expired`, `403 identity_blacklisted`.

### 2.6 `POST /community/web/session/logout` (NEW)

Send `Authorization: Bearer <access>`. Revokes the family. Response `{ "ok": true }`. Always succeeds.

### 2.7 Discord developer portal

Add this redirect URI to the existing OAuth application (client ID `1553617043914367068` in
`wrangler.jsonc`, env `backend`):

`https://sky-myce-backend.skyblock-relay.workers.dev/community/web/oauth/callback`

The website origin itself is **not** a Discord redirect URI in this design. It goes into the relay's
`return_to` allowlist and CORS allowlist. GitHub Pages has no per-branch preview origins, so one production
entry is enough. Local development needs the `localhost` entries in a non-production environment, or uses
preview mode.

---

## 3. Existing routes (EXISTS)

The relay already serves these routes. Shapes are summarised from the code.

| Route | Method | Auth | Shape / notes |
| --- | --- | --- | --- |
| `/health` | GET | none | `{ "service": "Sky-Myce relay", "version": 3 }` |
| `/community/release` | GET | none | Signed envelope `{ kid, payload, signature }` (base64; payload is the manifest JSON). Cache ≤ 60 s. |
| `/community/artifact?version=X` | GET | none | The JAR (`application/java-archive`, `ETag: "<sha256>"`). `409 release_changed` if X is not current. 6/min/IP. |
| `/community/leaderboard` | GET | community session | `LeaderboardResult` (below). Query: `category, metric, period, page (1-100), limit (1-25), search (≤100)` |
| `/community/journal-comparison?period=` | GET | community session | `{ ok, version:1, metric:"rng_drops", period, startAt, endAt, participantCount, totalDrops, meanPerIdentity, ownSharedCount, ownAvailable, ownUnavailableReason?, updatedAt, source, coverage }` |
| `/community/sharing` | GET/POST | community session | `SharingState`; POST `{ expectedRevision, policy }` → `sharing_conflict` on a revision mismatch |
| `/community/challenge`, `/community/connect/start|poll|cancel`, `/community/session/refresh|disconnect` | POST | Minecraft proof | Mod connection flow |
| `/community/oauth/start|authorize|callback` | GET | flow + `__Host-` cookie | Mod's browser Discord link (HTML pages) |
| `/community/contributions` | POST | community session | Contribution records (`contributionMetrics`) |
| `/community/cosmetics` | GET/POST | community session | Own profile, assets, `presets`, `quota { maxAssets: 8, maxBytes: 2 MiB, maxUploadBytes: 256 KiB }` |
| `/community/cosmetics/grant`, `/upload` (PUT), `/assets/{id}` (DELETE), `/preview/{id}` | — | community session | **Player self-service** cape upload. Not admin routes. |
| `/community/cosmetics/assets/{id}?uuid=` | GET | none | Active cape PNG (64 × 32). Usable from `<img>` without CORS. |
| `/community/news?source=game|derailious` | GET | none | Public news |
| `/websocket`, `/discord/*`, `/prompt/runner` | — | — | Mod and bot traffic; not for the site |

### 3.1 Release manifest (protocol 4)

The site verifies it in the browser (`src/assets/js/release.js`, tested in `tools/selftest.mjs`):

```json
{ "product": "sky-myce", "protocol": 4, "installation": "fabric", "minecraft": "26.1.2", "version": "2.7.29",
  "artifact": "releases/Sky-Myce-2.7.29.jar", "size": 1234567, "sha256": "64 hex",
  "issuedAt": 0, "expiresAt": 0, "notes": "optional, ≤ 8000 chars" }
```

- The signature is Ed25519 over the raw payload bytes.
- The key is `production-20260927`, SPKI `MCowBQYDK2VwAyEAbI6SZNtcVbtbzRKs0PfoU8MXp0nW+w1VeT71gDKM5NA=` (from `gradle.properties`).
- The validity window must be ≤ 14 days and must not have expired.
- `notes` is shown on /download and /changelog. One note per line is ideal.

### 3.2 `LeaderboardResult` v1

```json
{ "ok": true, "version": 1, "category": "dungeons", "metric": "dungeon_runs", "period": "all-time|weekly|monthly",
  "startAt": null, "endAt": 0, "metricLabel": "…", "description": "…", "unit": "runs|coins|milliseconds|drops|tasks",
  "aggregation": "event-sum|event-average|latest-snapshot", "available": true, "reason": "only when unavailable",
  "source": "…", "coverage": "…", "updatedAt": 0, "total": 0, "page": 1, "limit": 10, "search": "", "hasNext": false,
  "entries": [{ "rank": 1, "player": "IGN or \"Anonymous player\"", "value": 0, "sampleSize": 0, "updatedAt": 0,
                "source": "client-observation", "verification": "unverified" }] }
```

**Categories the site shows**, assuming the queued mod debloat removes the economy sharing category:

| Category | Metrics |
| --- | --- |
| `dungeons` | `dungeon_runs`, `dungeon_profit` (estimate), `dungeon_run_time` (average; lower ranks first) |
| `rng` | `rng_drops` |
| `other` | `completed_tasks` (`available: false`, with a reason) |

Periods are UTC: weekly runs from Monday 00:00, monthly from the 1st. Ranking uses SQL `RANK()`, so ties
share a rank. Search matches visible names only; anonymous entries can't be found by private username.

**Pending decision:** `economy` (`bazaar_profit`, `networth`, `purse`, `bank`). Net worth, purse and bank are
being removed. `bazaar_profit` depends on the `economy` sharing flag (`bazaar.ts`). If it should stay, map it
to the new single setting and add `{ id: "economy", metrics: ["bazaar_profit"] }` to `src/assets/js/metrics.js`.

---

## 4. Public read endpoints (NEW)

All of these are unauthenticated GETs with CORS and `Cache-Control: public, max-age=60`. They make no row
writes. Rate limits:

- the existing `REQUEST_LIMIT` (120/min/IP) and `SERVICE_LIMIT` already cover them;
- add `CONNECT_LIMIT`-style per-IP keys, `public:<path>:<ip>`, at 60/min.

### 4.1 `GET /community/public/leaderboard`

- Same query and `LeaderboardResult` as `/community/leaderboard`, built from the same `rankedDataset`.
- Rejects `identity` and `bazaar_profit` unless the economy decision above keeps them.
- Errors: `400 invalid_leaderboard`, `429 rate_limited`, `503 community_unavailable`.

Optional: add `previousRank` (number or null) to enable rank deltas. This needs a stored snapshot per
period, which costs row writes, so it is deferred. The site does not show deltas today.

### 4.2 `GET /community/public/journal-stats?period=`

Optional. Same as `journal-comparison` without `own*` fields.

### 4.3 `GET /community/public/cosmetics?page=1&limit=24`

- `limit` ≤ 48. Response: `{ ok, page, limit, hasNext, profiles: CosmeticProfile[] }`.
- `CosmeticProfile` (v5): `{ uuid, name, scale, revision, updatedAt, nameStyle, scaleX, scaleY, scaleZ, nametagScale, capePreset, capeAsset }`.
- Exclude blacklisted owners and profiles with `revision 0`. Order by `updatedAt` desc.
- Cape images keep using `/community/cosmetics/assets/{id}?uuid=`.

### 4.4 `GET /status`

Current health only, with no writes:

```json
{ "ok": true, "version": 1, "checkedAt": 0,
  "services": [{ "id": "relay|chat|leaderboards|releases", "label": "…", "description": "…",
                 "state": "operational|degraded|down", "history": [{ "day": 0, "state": "operational" }] }] }
```

`history` is optional. Day-by-day history needs persistence, and the relay's no-writes-on-alarm rule
forbids writing it there. Two options:

- leave `history` out (the site then shows current state only);
- feed it from an external monitor, for example a scheduled GitHub Action that pings `/health` and commits
  `data/status-history.json`. Not included.

Incident notes are hand-written in `src/data/incidents.json`.

---

## 5. Web Global Chat (NEW)

The site ships the full chat UI **read-only** (`features.webChatSend: false`).

### 5.1 Connection

`wss://sky-myce-backend.skyblock-relay.workers.dev/community/web/chat`

1. On upgrade, check `Origin` against the allowlist (403 if it doesn't match). Cap web sockets at 3 per
   account and N per IP.
2. Authenticate with the **first message**, within 5 s, so no token appears in the URL:
   `{ "type": "auth", "token": "<access>", "scope": "global", "send": true|false }`
3. Server reply:
   `{ "type": "ready", "canSend": bool, "sendAs": "IGN", "limits": { "burst": 6, "refillSeconds": 2, "minIntervalMs": 250, "maxLength": 1024, "duplicateMs": 15000 } }`
4. Before the access token expires, send `{ "type": "auth", "token": "<new>" }` on the same socket.
   No reconnect is needed.

Close codes:

| Code | Meaning |
| --- | --- |
| `4400` | Malformed message |
| `4401` | Authentication missing or expired. The client does not retry blindly. |
| `4403` | Forbidden or blacklisted |
| `4408` | No `auth` within 5 s |
| `4429` | Too many sockets or messages |

The client reconnects with jittered exponential backoff (1 s up to 30 s) on other closes.

### 5.2 Reading

The server forwards the same rich (model 1) packets subscribed Minecraft clients receive (`irc.ts`):

- `{ type: "irc_message", model: 1, scope: "global", room: "global-chat", id, sourceId, source: "minecraft"|"discord", from, text, timestamp, sender: { name, uuid?, discordId, cosmeticName?, avatarUrl? }, media: IrcMedia[], reply?, reactions: [], revision, mention }`
- `{ type: "irc_update", messageId, operation: "edit"|"delete"|"reaction", revision, text?, media?, reactions, moderated? }`

There is no history. Chat bodies stay live only, as in the relay today. Readers need a signed-in web session
so the stream can't be scraped anonymously.

### 5.3 Sending (only when the owner enables it)

`{ "type": "irc_send", "id": "32 hex", "text": "…", "replyTo": "32 hex?" }` → `{ "type": "irc_result", "id", "error"? }`

- **Send as:** the linked Minecraft IGN of the Discord account. With several linked accounts, use the most
  recently connected one, or let the client pick one of `identity.minecraft[].uuid` in `auth`.
  Accounts without a linked Minecraft identity get `canSend: false`.
- **Rate limits:** reuse the existing per-actor `global_chat_limits` bucket keyed by **account**, shared with
  the mod, so the web can't double a player's budget. Burst 6, refill 2 s, minimum interval 250 ms, duplicate
  text 15 s, 1024 characters (`GLOBAL_CHAT_MC_MAX_LENGTH`), and the global bucket. The relay is the
  authority; the site mirrors these limits only for instant feedback.
- **Reactions:** `{ type: "irc_operation", id, messageId, operation: "reaction", emoji, active }`.
  Emoji are restricted to `IRC_EMOJI` (👍 ❤️ 😂 🎉 👀 🔥). Same `IrcLifecycle.operate` checks and limits.
  Edit and delete apply to the sender's own messages only.
- **Origin marker:** set `source: "minecraft"` with an added `via: "web"`. Alternatively, extend
  `IrcRecord.source` with `"web"`, so the Discord bridge can label messages sent from the web.

### 5.4 Moderation and abuse

- Run `canUseIrc` and the blacklist check on every send. A blacklist change closes affected sockets with 4403.
- Moderator deletes go out as `irc_update` with `operation: "delete", moderated: true`. The site shows
  "Removed by a moderator."
- Run the existing traffic-cooldown (`CommunityTraffic`) on web sends.
- Optional: a minimum account age, or require one prior in-game connection, before web sending.
- Chat text is rendered with `textContent` only. Links must be `https:`. Images and video are embedded
  only from `cdn.discordapp.com` and `media.discordapp.net`, and the site's CSP enforces the same rule.

### 5.5 Why not SSE

`EventSource` cannot send an `Authorization` header, which would force the token into the URL.

---

## 6. Team console (NEW): `/community/admin/*`

**Every request** must:

1. present `Authorization: Bearer <admin-scope access token>`;
2. pass `isAdmin(actor)` **on the server**, using the durable `sky_accounts.is_admin = 1`, `status = active`
   and the configured guild. The existing code notes that Discord roles grant nothing; keep that.
3. be rate limited per admin (the existing `community-manage:${actor.id}`, 30/window) and audited
   (`hooks.audit`).

The front-end gate in `/admin/` only hides UI; it is not a security control. Mutations are POST or DELETE with
JSON bodies, carry an `Idempotency-Key` header, and return `{ ok, …, auditId }`. The UI applies changes
optimistically and rolls back on any non-2xx.

| Endpoint | Maps to existing logic | Notes |
| --- | --- | --- |
| `GET /community/admin/players?query=&status=&page=` | Discord backend `search`, `lookup`, `account` | `{ players: [{ accountId, discordId, discordName, minecraft:[{uuid,name}], status, sharing:"on"|"on-anon"|"off", lastSeen, sessions, cosmetics:{name,cape}, deviceObserved }], page, hasNext }` |
| `GET /community/admin/players/{accountId}` | `account`, `sessions`, `devices`, `audit` | Device hashes are admin-only; never send them to non-admin scopes |
| `POST /community/admin/players/{accountId}/sharing` `{ mode }` | `CommunitySharingStore.updateVerified` | `on` = all categories and `publicName` true; `on-anon` = same, `publicName` false; `off` = `enabled` false. Applies opt-out deletion and suppression. |
| `POST /community/admin/players/{accountId}/sessions/revoke` | `manage("session_kick")` | |
| `POST /community/admin/blacklist` `{ kind: "discord"|"minecraft", identity, reason }` | `manage("blacklist_add")` | Revokes sessions |
| `DELETE /community/admin/blacklist/{kind}/{identity}` `{ reason }` | `manage("blacklist_remove")` | |
| `GET /community/admin/blacklist` | `blacklist_list` | `{ entries: [{ kind, identity, label, reason, actor, at }] }` |
| `GET /community/admin/audit?page=` | `account_audit` | `{ entries: [{ at, actor, action, target, detail }] }` |
| `GET /community/admin/cosmetics/uploads` | `cosmetic_assets` | `{ uploads: [{ assetId, player, size, width, height, createdAt, status }] }` |
| `DELETE /community/admin/cosmetics/assets/{assetId}` | Admin variant of the asset delete | Resets the owner's cape and notifies rooms (`cosmeticChanged`) |
| `POST /community/admin/cosmetics/{uuid}/reset` | Admin write to `cosmetics_public` | Clears name, sizes and cape |
| `GET /community/admin/chat/recent` | `IrcLifecycle` metadata (15 min window) | `{ messages: [...] }` |
| `POST /community/admin/chat/{messageId}/delete` | `IrcLifecycle.operate` with a moderator actor | Fans out `irc_update`, `moderated: true`; deletes from Discord through the bridge |
| `GET /community/admin/reports`, `POST /community/admin/reports/{id}` `{ status }` | **Nothing exists** | Needs a new bounded `community_reports` table and a reporting entry point (an in-game "report" action and/or Discord). The console UI is ready. |

There are no cookies, so CSRF does not apply. If a cookie-based fallback is ever added, it must use
`SameSite=Strict; Secure; HttpOnly`, a CSRF token header, and an exact `Origin` check on every mutation.

---

## 7. Errors and rate limits

- **Error body:** `{ "ok": false, "error": "snake_case_code", "retryAt"?: epoch_ms }`.
- **Status codes:**

  | Status | Errors |
  | --- | --- |
  | 400 | `invalid_request`, `invalid_leaderboard`, … |
  | 401 | `session_expired`, `not_authorized` |
  | 403 | `identity_blacklisted`, `admin_required` |
  | 404 | — |
  | 409 | `sharing_conflict`, `release_changed` |
  | 429 | `rate_limited`, `traffic_cooldown`, with `Retry-After` |
  | 503 | `service_busy`, `community_unavailable`, `release_unavailable` |

- **Existing limits:** `REQUEST_LIMIT` is 120/60 s per IP on every path. `SERVICE_LIMIT` is 1000/60 s across
  `/community/*` and WebSockets. `CONNECT_LIMIT` is per path per IP. `DOWNLOAD_LIMIT` is 6/60 s per IP for
  the artifact. Global Chat uses burst 6, refill 2 s.
- **Proposed:** public reads at 60/min/IP per path. `/community/web/oauth/start` at 10/min/IP. Exchange and
  refresh at 20/min/IP. Admin uses the existing manage limiter.

---

## 8. Site-side security notes

- **CSP is a `<meta>` tag** (GitHub Pages can't set headers):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: <relay> cdn.discordapp.com media.discordapp.net; connect-src 'self' <relay> wss://<relay host>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'`.
  A meta CSP **cannot** express `frame-ancestors`, `report-uri`/`report-to` or `sandbox`, and it doesn't
  cover the HTML document's own response. The admin console therefore refuses to run inside a frame
  (JS check), and the site has no other sensitive actions to frame.
- There are no third-party scripts, fonts or styles. All user content (chat, names, cosmetics, leaderboard
  names) is inserted with `textContent`. Links are restricted to `https:`.
- Tokens are never placed in URLs after the exchange, in `localStorage`, or in cookies.
- `robots.txt` only works at a domain root, so it is ignored under `/SM-Web/`. `/admin/`, `/community/connect/`
  and `404.html` carry `<meta name="robots" content="noindex">` and are left out of the sitemap.

---

## 9. Relay change checklist

1. CORS helper with an exact allowlist, plus `OPTIONS` handling (section 1).
2. `/community/web/oauth/start|callback` and `/community/web/session/exchange|refresh|logout`, with hashed,
   rotating tokens and admin scope (section 2). Register the callback URI in Discord.
3. `/community/public/leaderboard`, `/community/public/cosmetics`, `/status` (section 4).
4. `/community/web/chat` WebSocket, read first, with send behind a server flag (section 5).
5. `/community/admin/*` (section 6) and the reports table if wanted.
6. Run `npm test` / `npm run check` and keep `test/storage-budget.mjs` passing (no per-request row writes).
7. Then set `features.liveApi`, `webLogin` and `webChatSend` in `site.config.js` as each piece goes live.
