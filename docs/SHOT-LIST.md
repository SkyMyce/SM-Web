# Shot list: every image and clip the site needs

Game setup, file naming, encoding commands and size budgets are in [CAPTURE-GUIDE.md](CAPTURE-GUIDE.md).
Read that first. This file is the list of what to capture, in priority order.

Two rules that save re-shoots:

- **Keep every uncropped 1920 × 1080 original** (PNG or MKV). Several home-page images are the full
  frame of a shot that is cropped elsewhere, and I can crop from the original.
- **One idea per frame.** The HUD is the product. Hide other mods, F3, chat spam and other players' names.

## Part 1: home page (highest priority)

The home page currently shows drawn placeholders from `src/assets/img/draft/`. These are the only shots
that need a dedicated capture; everything else on the home page reuses a slot from part 2. Drop new files in
`src/assets/media/home/` and I will point the page at them.

| # | Where it shows | What to capture | Format | File |
| --- | --- | --- | --- | --- |
| 1 | **Hero frame**, the big dark panel under the headline. Today it is a HUD rebuilt in HTML. | A real run with the Signature theme. Ideal scene: M7 phase 3 (Goldor) as Mage, so the Dungeon Tracker widget, the Goldor panel with "Next Terminal" and the pre-leap countdown, status bars, hotbar and an "Ability Ready!" moment are all in frame. Rotate the camera slowly or stand still; the HUD is what should move. A 10-15 s clip plus the one still frame where the most widgets are visible. | Clip 1920 × 1080 → 1280 × 720 MP4 (+ WebM, + JPG poster), and a 1920 × 1080 still as WebP | `home/hero.mp4`, `home/hero.webm`, `home/hero.jpg`, `home/hero.webp` |
| 2 | **Hero background**, the floating islands at the bottom of the sky gradient. Drawn today; optional, the drawing can stay. | A wide panorama of floating islands against open sky, taken from height: the Hub seen from the Wizard Tower, or the Dungeon Hub from its highest point. Daylight, clear weather, no players. I will fade the top into the gradient, so leave plenty of empty sky above the islands. | 1920 × 1080 PNG, uncropped | `home/islands.png` |

Home-page images that reuse a part 2 slot (nothing extra to capture, just keep the original):

- Dungeons panel: `dungeons/party-finder`, and one still frame from the `dungeons/goldor-map` clip.
- Tracker panel: the uncropped original of `tracker/widget` (the tracker widget over a dungeon corridor).
- Everyday panel: one still frame from the in-game part of the `everyday/status-bars` clip.
- Step 2 "Put two JARs in your mods folder": `download/mods-folder`.
- Step 4 "Turn on only what you use": `download/first-launch`.

## Part 2: media slots, by page

Everything below is a slot declared in `src/data/media-slots.json`. The page shows a "Capture pending"
card until the file exists at the path shown. This section is the output of
`node tools/media-audit.mjs --shotlist`; rerun that for the live checklist after adding files.

Priority within part 2: the `dungeons/`, `tracker/`, `everyday/` and `download/` slots are on the feature
pages and the download page, so do those before the `docs/` and `community/` slots.


## dungeons

- [ ] **dungeons/party-finder** (image, 16:9): Screenshot. Party Finder open with at least one matching and one mismatched listing visible. → `src/assets/media/dungeons/party-finder.webp`
- [ ] **dungeons/missing-player** (image, 16:9): Screenshot. The alert shown when a party member has not entered the instance. → `src/assets/media/dungeons/missing-player.webp`
- [ ] **dungeons/requeue** (video, 16:9): Clip, 6-8 s. End of a run through the requeue into the next instance. → `src/assets/media/dungeons/requeue.mp4 + dungeons/requeue.webm + poster dungeons/requeue.jpg`
- [ ] **dungeons/chest-protection** (video, 16:9): Clip, 5-8 s. Click the reroll button on a chest holding a valuable item and show the block message. → `src/assets/media/dungeons/chest-protection.mp4 + dungeons/chest-protection.webm + poster dungeons/chest-protection.jpg`
- [ ] **dungeons/chest-profit** (image, 16:9): Screenshot. Croesus or the reward chest room with profit estimates visible. → `src/assets/media/dungeons/chest-profit.webp`
- [ ] **dungeons/win-screen** (image, 16:9): Screenshot. The post-run summary overlay right after a completed run. → `src/assets/media/dungeons/win-screen.webp`
- [ ] **dungeons/routing** (video, 16:9): Clip, 8-10 s. Walk two rooms following the route line on a class that has Blood routing enabled. → `src/assets/media/dungeons/routing.mp4 + dungeons/routing.webm + poster dungeons/routing.jpg`
- [ ] **dungeons/crush-camera** (video, 16:9): Clip, 8-12 s. The preview in /sm crush-camera, or a live Storm phase with the camera switching. → `src/assets/media/dungeons/crush-camera.mp4 + dungeons/crush-camera.webm + poster dungeons/crush-camera.jpg`
- [ ] **dungeons/goldor-map** (video, 16:9): Clip, 10-12 s. F7/M7 phase 3 with the Goldor Map widget and a pre-leap prompt. → `src/assets/media/dungeons/goldor-map.mp4 + dungeons/goldor-map.webm + poster dungeons/goldor-map.jpg`
- [ ] **dungeons/leap-menu** (image, 16:9): Screenshot. The Spirit Leap menu open with teammates listed. → `src/assets/media/dungeons/leap-menu.webp`

## tracker

- [ ] **tracker/overview** (image, 16:9): Screenshot. /sm dungeon with a floor selected and run history visible. → `src/assets/media/tracker/overview.webp`
- [ ] **tracker/rng-journal** (image, 16:9): Screenshot. /sm journal with a few entries and the search field visible. → `src/assets/media/tracker/rng-journal.webp`
- [ ] **tracker/loot-history** (image, 16:9): Screenshot. Tracker loot history with chests and estimated values. → `src/assets/media/tracker/loot-history.webp`
- [ ] **tracker/levels** (image, 16:9): Screenshot. Tracker Levels tab showing progress toward a target level. → `src/assets/media/tracker/levels.webp`
- [ ] **tracker/widget** (image, 4:3): Screenshot crop, 1200x900. The Dungeon Tracker widget in the dungeon hub. → `src/assets/media/tracker/widget.webp`
- [ ] **tracker/journal-comparison** (image, 16:9): Screenshot. The journal comparison panel (requires a community connection). → `src/assets/media/tracker/journal-comparison.webp`
- [ ] **tracker/splits** (video, 16:9): Clip, 8-10 s. Splits widget during a run, including a split being completed. → `src/assets/media/tracker/splits.mp4 + tracker/splits.webm + poster tracker/splits.jpg`

## everyday

- [ ] **everyday/digest** (image, 16:9): Screenshot. /sm digest main view. → `src/assets/media/everyday/digest.webp`
- [ ] **everyday/auto-refill** (video, 16:9): Clip, 5-6 s. Use the last item of a stack and show it refilled. → `src/assets/media/everyday/auto-refill.mp4 + everyday/auto-refill.webm + poster everyday/auto-refill.jpg`
- [ ] **everyday/stash** (image, 16:9): Screenshot. Stash menu with low-value items marked. → `src/assets/media/everyday/stash.webp`
- [ ] **everyday/loadouts** (video, 16:9): Clip, 5-6 s. Press a loadout key and show the swap. → `src/assets/media/everyday/loadouts.mp4 + everyday/loadouts.webm + poster everyday/loadouts.jpg`
- [ ] **everyday/status-bars** (video, 16:9): Clip, 8-10 s. /sm bars editor: drag a bar, snap it, then show it in game. → `src/assets/media/everyday/status-bars.mp4 + everyday/status-bars.webm + poster everyday/status-bars.jpg`
- [ ] **everyday/npc-dialogue** (image, 16:9): Screenshot. An NPC conversation with numbered options. → `src/assets/media/everyday/npc-dialogue.webp`
- [ ] **everyday/sign-enter** (video, 16:9): Clip, 4-5 s. Type a price on an Auction House sign and press Enter. → `src/assets/media/everyday/sign-enter.mp4 + everyday/sign-enter.webm + poster everyday/sign-enter.jpg`
- [ ] **everyday/xp-widget** (image, 4:3): Screenshot crop, 1200x900. Skill XP widget after an XP gain. → `src/assets/media/everyday/xp-widget.webp`
- [ ] **everyday/themes** (image, 16:9): Screenshot. Settings, Appearance, with the theme preset list. → `src/assets/media/everyday/themes.webp`
- [ ] **everyday/price-history** (image, 16:9): Screenshot. Hover an item, press P, graph visible. → `src/assets/media/everyday/price-history.webp`

## download

- [ ] **download/mods-folder** (image, 16:9): Screenshot. File explorer showing the mods folder with both JARs. Hide your user name. → `src/assets/media/download/mods-folder.webp`
- [ ] **download/first-launch** (image, 16:9): Screenshot. /sm main menu with the six categories. → `src/assets/media/download/first-launch.webp`

## docs/getting-started

- [ ] **docs/getting-started/menu** (image, 16:9): Screenshot. /sm home with the search field focused. → `src/assets/media/docs/getting-started/menu.webp`

## docs/install

- [ ] **docs/install/mods-folder** (image, 16:9): Screenshot. Same as download/mods-folder, cropped to the file list. → `src/assets/media/docs/install/mods-folder.webp`
- [ ] **docs/install/crash-missing-kotlin** (image, 16:9): Screenshot. Launch without Fabric Language Kotlin and capture the error screen. → `src/assets/media/docs/install/crash-missing-kotlin.webp`

## docs/commands

- [ ] **docs/commands/search** (image, 16:9): Screenshot. /sm search results for a keyword. → `src/assets/media/docs/commands/search.webp`

## docs/dungeons

- [ ] **docs/dungeons/party-finder-settings** (image, 16:9): Screenshot. Dungeon availability: floor, classes and PB limit. → `src/assets/media/docs/dungeons/party-finder-settings.webp`
- [ ] **docs/dungeons/routing-settings** (image, 16:9): Screenshot. Routing settings: Route, Mob markers, Appearance. → `src/assets/media/docs/dungeons/routing-settings.webp`

## docs/goldor

- [ ] **docs/goldor/map** (image, 16:9): Screenshot. HUD editor with the Goldor Map widget preview. → `src/assets/media/docs/goldor/map.webp`
- [ ] **docs/goldor/guide** (image, 16:9): Screenshot. Output of /sm goldor guide for one class and section. → `src/assets/media/docs/goldor/guide.webp`

## docs/tracker

- [ ] **docs/tracker/filters** (image, 16:9): Screenshot. Tracker with the filter controls open. → `src/assets/media/docs/tracker/filters.webp`

## docs/everyday

- [ ] **docs/everyday/bars-editor** (image, 16:9): Screenshot. /sm bars with guides visible while dragging. → `src/assets/media/docs/everyday/bars-editor.webp`

## docs/community

- [ ] **docs/community/connect** (image, 16:9): Screenshot. /sm community, connected, with Community data sharing visible. Hide Discord name if preferred. → `src/assets/media/docs/community/connect.webp`

## docs/cosmetics

- [ ] **docs/cosmetics/studio** (image, 16:9): Screenshot. /sm cosmetics with the player preview. → `src/assets/media/docs/cosmetics/studio.webp`

## docs/graphics

- [ ] **docs/graphics/modes** (image, 16:9): Screenshot. Settings, Performance, Graphics mode options. → `src/assets/media/docs/graphics/modes.webp`

## docs/faq

- [ ] **docs/faq/logs** (image, 16:9): Screenshot. File explorer showing logs/latest.log. → `src/assets/media/docs/faq/logs.webp`

## community

- [ ] **community/studio** (image, 16:9): Screenshot. /sm cosmetics with a custom name and cape. → `src/assets/media/community/studio.webp`
- [ ] **community/chat-in-game** (image, 16:9): Screenshot. /sm irc with a reply and a reaction visible. Use consenting players only. → `src/assets/media/community/chat-in-game.webp`
- [ ] **community/leaderboard-in-game** (image, 16:9): Screenshot. /sm leaderboard showing a category, period and the coverage line. → `src/assets/media/community/leaderboard-in-game.webp`

