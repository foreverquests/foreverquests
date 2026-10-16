# ForeverQuests

Fan-made tracker for everything new in World of Warcraft: Forever — zones, dungeons, raids, race/class combos and systems, with a personal checklist (localStorage), patch timeline, launch countdown and per-item SEO pages.

- Content: `src/data.json` (public sources only; unconfirmed details flagged)
- Build: `node build.mjs` → `dist/` (no dependencies). `BASE_PATH` / `SITE_ORIGIN` env vars set the URL; defaults to `https://bobcatzd.github.io/foreverquests/`.
- Deploy: GitHub Actions (`.github/workflows/pages.yml`) builds and publishes to GitHub Pages on push to `main` (Settings → Pages → Source: GitHub Actions).
- Credits: original art by ForeverQuests; some icons by Lorc/Delapouite/Sbed from game-icons.net (CC BY 3.0). Not affiliated with Blizzard Entertainment.
