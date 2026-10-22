# Shot list: every image and clip the site needs

Game setup, file naming, encoding commands and size budgets are in [CAPTURE-GUIDE.md](CAPTURE-GUIDE.md).
Read that first. This file is the list of what to capture, in priority order.

Two rules that save re-shoots:

- **Keep every uncropped 1920 × 1080 original** (PNG or MKV). Several home-page images are the full
  frame of a shot that is cropped elsewhere, and I can crop from the original.
- **One idea per frame.** The HUD is the product. Hide other mods, F3, chat spam and other players' names.

## Part 1: home page

The hero screenshot (`home/hero.webp`) and the Dungeon Hub background (`home/dungeon-hub.webp`) are in. The
area panels reuse slot files: `dungeons/party-finder`, `dungeons/goldor-map`, `tracker/overview`,
`everyday/digest` and `download/first-launch`.

Still wanted:

- **Hero clip (optional).** 10-15 s of a real run with the HUD visible, M7 phase 3 as Mage is ideal. Export
  `home/hero.mp4` (+ `.webm`, + `.jpg` poster) and I will swap the still for it.
- **Step 2 image.** Capture `download/mods-folder` and the home page step will be pointed at it; until then it shows
  the last draft illustration.

## Part 2: media slots, by page

Everything below is a slot declared in `src/data/media-slots.json`. The page shows a "Capture pending"
card until the file exists at the path shown. This section is the output of
`node tools/media-audit.mjs --shotlist`; rerun that for the live checklist after adding files.

Priority within part 2: the `dungeons/`, `tracker/`, `everyday/` and `download/` slots are on the feature
pages and the download page, so do those before the `docs/` and `community/` slots.


## dungeons

- [x] **dungeons/party-finder** (image, 16:9): Screenshot. /sm pf with dungeon friends listed. → `src/assets/media/dungeons/party-finder.webp`
- [ ] **dungeons/missing-player** (image, 16:9): Screenshot. The alert shown when a party member has not entered the instance. → `src/assets/media/dungeons/missing-player.webp`
- [ ] **dungeons/requeue** (video, 16:9): Clip, 6-8 s. End of a run through the requeue into the next instance. → `src/assets/media/dungeons/requeue.mp4 + dungeons/requeue.webm + poster dungeons/requeue.jpg`
- [ ] **dungeons/chest-protection** (video, 16:9): Clip, 5-8 s. Click the reroll button on a chest holding a valuable item and show the block message. → `src/assets/media/dungeons/chest-protection.mp4 + dungeons/chest-protection.webm + poster dungeons/chest-protection.jpg`
- [ ] **dungeons/chest-profit** (image, 16:9): Screenshot. Croesus or the reward chest room with profit estimates visible. → `src/assets/media/dungeons/chest-profit.webp`
- [ ] **dungeons/win-screen** (image, 16:9): Screenshot. The post-run summary overlay right after a completed run. → `src/assets/media/dungeons/win-screen.webp`
- [ ] **dungeons/routing** (video, 16:9): Clip, 8-10 s. Walk two rooms following the route line on a class that has Blood routing enabled. → `src/assets/media/dungeons/routing.mp4 + dungeons/routing.webm + poster dungeons/routing.jpg`
- [ ] **dungeons/crush-camera** (video, 16:9): Clip, 8-12 s. The preview in /sm crush-camera, or a live Storm phase with the camera switching. → `src/assets/media/dungeons/crush-camera.mp4 + dungeons/crush-camera.webm + poster dungeons/crush-camera.jpg`
- [x] **dungeons/goldor-map** (image, auto): Screenshot crop. The Goldor Map widget during F7/M7 phase 3. → `src/assets/media/dungeons/goldor-map.webp`
- [ ] **dungeons/leap-menu** (image, 16:9): Screenshot. The Spirit Leap menu open with teammates listed. → `src/assets/media/dungeons/leap-menu.webp`

## tracker

- [x] **tracker/overview** (image, auto): Screenshot. /sm dungeon, Overview tab. → `src/assets/media/tracker/overview.webp`
- [x] **tracker/rng-journal** (image, auto): Screenshot. /sm journal with a few entries and the search field visible. → `src/assets/media/tracker/rng-journal.webp`
- [x] **tracker/loot-history** (image, 16:9): Screenshot. Tracker loot history with chests and estimated values. → `src/assets/media/tracker/loot-history.webp`
- [x] **tracker/levels** (image, 16:9): Screenshot. Tracker Levels tab showing progress toward a target level. → `src/assets/media/tracker/levels.webp`
- [x] **tracker/widget** (image, auto): Screenshot crop. The Dungeon Tracker widget. → `src/assets/media/tracker/widget.webp`
- [ ] **tracker/journal-comparison** (image, 16:9): Screenshot. The journal comparison panel (requires a community connection). → `src/assets/media/tracker/journal-comparison.webp`
- [ ] **tracker/splits** (video, 16:9): Clip, 8-10 s. Splits widget during a run, including a split being completed. → `src/assets/media/tracker/splits.mp4 + tracker/splits.webm + poster tracker/splits.jpg`

## everyday

- [x] **everyday/digest** (image, 16:9): Screenshot. /sm digest main view. → `src/assets/media/everyday/digest.webp`
- [ ] **everyday/auto-refill** (video, 16:9): Clip, 5-6 s. Use the last item of a stack and show it refilled. → `src/assets/media/everyday/auto-refill.mp4 + everyday/auto-refill.webm + poster everyday/auto-refill.jpg`
- [x] **everyday/stash** (image, 1:1): Screenshot. Stash menu with low-value items marked. → `src/assets/media/everyday/stash.webp`
- [ ] **everyday/loadouts** (video, 16:9): Clip, 5-6 s. Press a loadout key and show the swap. → `src/assets/media/everyday/loadouts.mp4 + everyday/loadouts.webm + poster everyday/loadouts.jpg`
- [ ] **everyday/status-bars** (video, 16:9): Clip, 8-10 s. /sm bars editor: drag a bar, snap it, then show it in game. → `src/assets/media/everyday/status-bars.mp4 + everyday/status-bars.webm + poster everyday/status-bars.jpg`
- [ ] **everyday/npc-dialogue** (image, 16:9): Screenshot. An NPC conversation with numbered options. → `src/assets/media/everyday/npc-dialogue.webp`
- [ ] **everyday/sign-enter** (video, 16:9): Clip, 4-5 s. Type a price on an Auction House sign and press Enter. → `src/assets/media/everyday/sign-enter.mp4 + everyday/sign-enter.webm + poster everyday/sign-enter.jpg`
- [ ] **everyday/xp-widget** (image, 4:3): Screenshot crop, 1200x900. Skill XP widget after an XP gain. → `src/assets/media/everyday/xp-widget.webp`
- [ ] **everyday/themes** (image, 16:9): Screenshot. Settings, Appearance, with the theme preset list. → `src/assets/media/everyday/themes.webp`
- [x] **everyday/price-history** (image, 16:9): Screenshot. Hover an item, press P, graph visible. → `src/assets/media/everyday/price-history.webp`

## download

- [ ] **download/mods-folder** (image, 16:9): Screenshot. File explorer showing the mods folder with both JARs. Hide your user name. → `src/assets/media/download/mods-folder.webp`
- [x] **download/first-launch** (image, 16:9): Screenshot. /sm home screen. → `src/assets/media/download/first-launch.webp`

## docs/getting-started

- [x] **docs/getting-started/menu** (image, 16:9): Screenshot. /sm home screen. → `src/assets/media/docs/getting-started/menu.webp`

## docs/install

- [ ] **docs/install/mods-folder** (image, 16:9): Screenshot. Same as download/mods-folder, cropped to the file list. → `src/assets/media/docs/install/mods-folder.webp`
- [ ] **docs/install/crash-missing-kotlin** (image, 16:9): Screenshot. Launch without Fabric Language Kotlin and capture the error screen. → `src/assets/media/docs/install/crash-missing-kotlin.webp`

## docs/commands

- [ ] **docs/commands/search** (image, 16:9): Screenshot. /sm search results for a keyword. → `src/assets/media/docs/commands/search.webp`

## docs/dungeons

- [x] **docs/dungeons/party-finder-settings** (image, 16:9): Screenshot. Dungeon availability: floor, classes and PB limit. → `src/assets/media/docs/dungeons/party-finder-settings.webp`
- [x] **docs/dungeons/routing-settings** (image, 16:9): Screenshot. Routing settings: Route, Mob markers, Appearance. → `src/assets/media/docs/dungeons/routing-settings.webp`

## docs/goldor

- [x] **docs/goldor/map** (image, auto): Screenshot crop. The Goldor Map widget. → `src/assets/media/docs/goldor/map.webp`
- [x] **docs/goldor/guide** (image, 21:9): Screenshot. Output of /sm goldor guide for one class and section. → `src/assets/media/docs/goldor/guide.webp`
- [x] **docs/goldor/settings** (image, 16:9): Screenshot. Dungeons, Boss, Goldor Coordination settings. → `src/assets/media/docs/goldor/settings.webp`

## docs/tracker

- [ ] **docs/tracker/filters** (image, 16:9): Screenshot. Tracker with the filter controls open. → `src/assets/media/docs/tracker/filters.webp`
- [x] **docs/tracker/rng-widget** (image, auto): Screenshot crop. The Recent RNG widget. → `src/assets/media/docs/tracker/rng-widget.webp`

## docs/everyday

- [ ] **docs/everyday/bars-editor** (image, 16:9): Screenshot. /sm bars with guides visible while dragging. → `src/assets/media/docs/everyday/bars-editor.webp`

## docs/community

- [x] **docs/community/connect** (image, 16:9): Screenshot. /sm community, connected, with Community data sharing visible. Hide Discord name if preferred. → `src/assets/media/docs/community/connect.webp`

## docs/cosmetics

- [ ] **docs/cosmetics/studio** (image, 16:9): Screenshot. /sm cosmetics with the player preview. → `src/assets/media/docs/cosmetics/studio.webp`

## docs/graphics

- [x] **docs/graphics/modes** (image, auto): Screenshot crop. Chat after Graphics Auto picks a mode. → `src/assets/media/docs/graphics/modes.webp`

## docs/faq

- [x] **docs/faq/logs** (image, 16:9): Screenshot. File explorer showing the instance logs folder. → `src/assets/media/docs/faq/logs.webp`

## community

- [ ] **community/studio** (image, 16:9): Screenshot. /sm cosmetics with a custom name and cape. → `src/assets/media/community/studio.webp`
- [ ] **community/chat-in-game** (image, 16:9): Screenshot. /sm irc with a reply and a reaction visible. Use consenting players only. → `src/assets/media/community/chat-in-game.webp`
- [x] **community/leaderboard-in-game** (image, 16:9): Screenshot. /sm leaderboard showing a category, period and the coverage line. → `src/assets/media/community/leaderboard-in-game.webp`

