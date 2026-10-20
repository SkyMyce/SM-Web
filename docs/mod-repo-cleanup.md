# Proposed cleanup in the mod repository (not applied)

This change set is separate from the website. **Nothing here has been applied.** The website was built
against `D:\Code\Sky-Myce-main` at 2.7.29, read-only. A queued debloat of the mod already rewrites
`FEATURES.md`; these items should ride along with it or follow it.

## 1. `src/main/resources/fabric.mod.json`

The current file still has the Fabric example mod's contact links. It also has a licence identifier that
contradicts `LICENSE`, and both authors in one string.

```diff
-	"name": "Sky-Myce",
-	"description": "A Hypixel Skyblock QOL mod",
-	"authors": [
-		"mycellium, cessna808-star"
-	],
-	"contact": {
-		"homepage": "https://fabricmc.net/",
-		"sources": "https://github.com/FabricMC/fabric-example-mod"
-	},
-	"license": "CC0-1.0",
+	"name": "SkyMyce",
+	"description": "A client-side Fabric mod for Hypixel SkyBlock: dungeon tools, tracking, a guided Bazaar workflow and a clean HUD.",
+	"authors": [
+		"mycellium",
+		"cessna808-star"
+	],
+	"contact": {
+		"homepage": "https://skymyce.github.io/SM-Web/",
+		"sources": "https://github.com/cessna80808-star/Sky-Myce",
+		"issues": "https://github.com/cessna80808-star/Sky-Myce/issues"
+	},
+	"license": "LicenseRef-SkyMyce",
```

- `homepage` is the confirmed site URL. If the site later moves to `https://skymyce.github.io/` or a custom
  domain, change it again. Nothing else in the mod depends on it.
- `sources` and `issues` assume the mod repo stays at `cessna80808-star/Sky-Myce`. Update them if it moves
  to the SkyMyce org.
- `license`: `LICENSE` is a custom "run, view and contribute only" licence, not CC0. `LicenseRef-SkyMyce`
  is the SPDX form for a custom licence. The owner should confirm the intended licence first.
- Changing `name` only changes the display name. The mod id `skymyce` stays the same.

## 2. `FEATURES.md`

The current file says "Sky-Hawk" throughout and lists features being removed (Wardrobe Keybinds) or
described differently now. Either:

- **(preferred)** delete it and link the website from `README.md` (the site's feature pages and docs replace
  it), or
- make sure the debloat rewrite uses "SkyMyce" and drops every "Sky-Hawk" reference.

## 3. `README.md`

- "Current release: 2.5.15" is stale (`gradle.properties` says 2.7.29). Remove the hard-coded version and
  link the website's download page, which reads the signed release.
- Rename "Sky-Myce" to "SkyMyce" in prose, and add the website link and the dependency note:
  Fabric Language Kotlin is required separately; Fabric API and SkyblockPV are bundled.

## 4. Remaining brand strings (separate, later)

These user-visible strings still say "Sky-Myce". Change them in a later release, together with any tests
that assert them:

- `SkyMyceCommands.kt`: the key mapping name `"Open Sky-Myce Menu"`.
- `relay/src/community.ts`: the OAuth HTML `<title>Connect Sky-Myce</title>` and its page text.
- `relay/src/index.ts`: `/health` returns `"Sky-Myce relay"`.
- `relay/src/leaderboards.ts`: the coverage text ("Consenting Sky-Myce participants …") and the Discord
  embed title.
- `relay/src/discord-accounts.ts`: backend subcommands still called `skyhawk_search`, `skyhawk_lookup` and
  `skyhawk_overview`.
- `relay/src/cosmetics.ts`: the cape preset label `"Sky-Myce"`.

The release artifact name `releases/Sky-Myce-<version>.jar` is checked by
`verifyCommunityManifest`. Renaming it is a protocol change, so leave it as is.
