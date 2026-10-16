# ForeverScout

> Rebranded from ForeverQuests (Oct 2026). Domain foreverscout.com pending; site still served at /foreverquests/ on GitHub Pages.

Fan-made tracker for everything new in World of Warcraft: Forever — zones, dungeons, raids, race/class combos and systems, with a personal checklist (localStorage), patch timeline, launch countdown and per-item SEO pages.

- Content: `src/data.json` (public sources only; unconfirmed details flagged)
- Build: `node build.mjs` → `dist/` (no dependencies). `BASE_PATH` / `SITE_ORIGIN` env vars set the URL; defaults to `https://foreverquests.github.io/foreverquests/`.
- Deploy: GitHub Actions (`.github/workflows/pages.yml`) builds and publishes to GitHub Pages on push to `main` (Settings → Pages → Source: GitHub Actions).
- Credits: original art by ForeverScout; some icons by Lorc/Delapouite/Sbed from game-icons.net (CC BY 3.0). Not affiliated with Blizzard Entertainment.

## Data pipeline (wago.tools)
`node scripts/sync-wago.mjs` finds the latest WoW Forever build (`wowf`) and Classic Era 1.15.x on wago.tools (UA `ForeverScout/1.0 (+https://foreverquests.github.io/foreverquests/)`, used with Wago's permission), downloads ItemSparse, QuestV2, QuestLine, QuestLineXQuest, AreaTable, Map and LFGDungeons as CSV and diffs them.
- Every diff candidate goes to `review/pending.json` / `review/pending.md`; `review/state.json` makes reruns only surface new things.
- Curated finds (new dungeons, quest lines, maps, top-level zones, Epic+ items ilvl ≥ 40; junk/test/placeholder names and re-IDed Era names skipped) are auto-appended to `src/data.json` with new `idx` values. Existing idx are never changed.
- Each run's additions are logged in `review/log/CHANGELOG.md`.
- `.github/workflows/sync-wago.yml` runs daily, commits to main and redeploys Pages.
