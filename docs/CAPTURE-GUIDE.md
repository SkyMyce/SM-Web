# Capture guide

Every screenshot and clip on the site lives in a **media slot**. Each slot is declared once in
`src/data/media-slots.json`, and the build turns it into an image or video. Until a file exists, the slot
shows a "Capture pending" card naming the expected file. The build checks which files exist, so there are
no broken requests.

```bash
node tools/media-audit.mjs              # every slot, present or missing, with file sizes
node tools/media-audit.mjs --missing    # only what still needs capturing
node tools/media-audit.mjs --shotlist   # Markdown checklist grouped by page
node tools/media-audit.mjs --strict     # exit 1 if anything is missing or over budget (for CI later)
```

## File naming

| Slot kind | Files to add |
| --- | --- |
| image | `src/assets/media/<slot-id>.webp`. `.png` or `.jpg` also work; WebP is preferred. |
| video | `src/assets/media/<slot-id>.mp4` (required) + `<slot-id>.webm` (optional) + `<slot-id>.jpg` poster (recommended) |

For example, the slot `dungeons/routing` becomes `src/assets/media/dungeons/routing.mp4`, `routing.webm`
and `routing.jpg`. Rebuild (`node build.mjs`) after adding files.

## Game setup (once, before the session)

- **Window:** 1920 × 1080 (fullscreen on a 1080p display, or a 1920 × 1080 window). Don't capture at
  other resolutions and scale up.
- **GUI scale 3.** The same scale everywhere keeps text sizes consistent across shots.
- **SkyMyce appearance:** theme preset **Signature**, graphics mode **High**.
- **Vanilla look:** default resource pack, no shaders. Other HUD mods off. F3 closed.
- **Privacy:** no other players' names or chat without their consent, no coordinates, no server IPs, no
  Discord usernames you don't own, and no purse or bank values you don't want public.
- **Scenes:** daylight with a calm background. For dungeon shots, use a party that agreed to be filmed.

## Screenshots

- Take them with F2, or OBS screenshots, as lossless PNG. Crop to the slot's aspect ratio:
  - 16:9 → **1920 × 1080**
  - 4:3 → **1200 × 900**, for HUD crops
- Convert to WebP at quality 82:

  ```bash
  cwebp -q 82 -m 6 -resize 1920 0 input.png -o src/assets/media/dungeons/party-finder.webp
  ```

- **Budget:** 400 KB per image. If a WebP is larger, lower the quality to 75 or crop tighter.

## Clips

- Record with OBS at 1920 × 1080, 60 fps, high-quality local recording (CQP around 18, MKV).
- **Length:** 4-12 s. Show one idea per clip: start just before the action and end just after it.
- **Export:** 1280 × 720, 30 fps, no audio, H.264 MP4 with `faststart`, plus optional VP9 WebM.
- **Budget:** 4 MB per clip (MP4), 200 KB per poster. Clips autoplay muted and loop when on screen. Users
  with reduced motion see the poster and can open the clip in the lightbox.

```bash
# MP4 (required). Trim with -ss (start) and -t (duration).
ffmpeg -ss 00:00:02 -t 8 -i raw.mkv -vf "scale=1280:-2:flags=lanczos,fps=30" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -an src/assets/media/dungeons/routing.mp4

# WebM (optional, often smaller)
ffmpeg -ss 00:00:02 -t 8 -i raw.mkv -vf "scale=1280:-2:flags=lanczos,fps=30" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -an src/assets/media/dungeons/routing.webm

# Poster from the first frame
ffmpeg -i src/assets/media/dungeons/routing.mp4 -frames:v 1 -q:v 4 src/assets/media/dungeons/routing.jpg
```

If an MP4 is over budget, raise `-crf` to 28-30, or shorten it.

## Repository size

GitHub Pages sites should stay under 1 GB and individual files under 100 MB. With the budgets above, all 53
slots together stay under roughly 120 MB. Don't commit raw recordings; keep them outside the repository.

## Shot list, ordered for one session

The full checklist (slot id, kind, spec and target path) comes from `node tools/media-audit.mjs --shotlist`.
The session below groups shots by place in the game so you move around as little as possible.

1. **Desktop, before launching**
   - `download/mods-folder`, `docs/install/mods-folder`: the mods folder with both JARs. Hide your user name.
   - `docs/install/crash-missing-kotlin`: launch once without Fabric Language Kotlin and capture the error.
   - `docs/faq/logs`: `logs/latest.log` in the instance folder.
2. **Any lobby, menus only**
   - `download/first-launch`, `docs/getting-started/menu`, `docs/commands/search`: `/sm` home, then search.
   - `everyday/themes`, `docs/graphics/modes`: Settings, Appearance and Performance.
   - `docs/community/connect`: `/sm community`.
   - `docs/cosmetics/studio`, `community/studio`: `/sm cosmetics`.
   - `everyday/status-bars` (clip), `docs/everyday/bars-editor`: `/sm bars`.
   - `docs/goldor/map`: `/sm hud` with the Goldor Map preview.
   - `docs/goldor/guide`: `/sm goldor guide mage s2`.
   - `community/chat-in-game`, `community/leaderboard-in-game`: `/sm irc` and `/sm leaderboard`.
3. **Private island**
   - `everyday/digest`: `/sm digest`.
   - `everyday/auto-refill` (clip), `everyday/loadouts` (clip), `everyday/xp-widget`.
   - `everyday/npc-dialogue`: talk to any NPC with options.
   - `everyday/price-history`: hover an item, press P.
   - `everyday/sign-enter` (clip): an Auction House sign.
   - `everyday/stash`: open the stash.
4. **Dungeon hub**
   - `dungeons/party-finder`, `docs/dungeons/party-finder-settings`: Party Finder and `/sm pf`.
   - `tracker/overview`, `tracker/loot-history`, `tracker/levels`, `tracker/rng-journal`,
     `tracker/journal-comparison`, `docs/tracker/filters`: `/sm dungeon` and `/sm journal`.
   - `tracker/widget`: tracker widget crop.
   - `docs/dungeons/routing-settings`: routing settings.
   - `dungeons/crush-camera` (clip): the `/sm crush-camera` preview.
5. **In a run (a cooperative party)**
   - `dungeons/missing-player`, `dungeons/routing` (clip), `tracker/splits` (clip).
   - `dungeons/leap-menu`.
   - F7/M7 only: `dungeons/goldor-map` (clip).
   - At the end: `dungeons/win-screen`, `dungeons/chest-profit`, `dungeons/chest-protection` (clip),
     `dungeons/requeue` (clip).

Finish with `node tools/media-audit.mjs --missing` to see what's left.
