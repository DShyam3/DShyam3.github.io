# State

Updated 2026-11-18 · `main` (pushed on top of `b7aa0e1b`).

## Deployed & landed on `main`

- **Grouped film collections & TV spin-offs in Discover and Franchises:**
  - `HAVE YOU ALREADY WATCHED?` on Discover groups incomplete TMDB film collections (`collection/{id}`) and connected TV spin-off universes (via Wikidata `P2512` through `tmdb-proxy?endpoint=wikidata/tv-spinoffs`, `tvFranchisesFromLinks`) in release order, with `Add to library`, `Seen it` (`WatchedWhenMenu` date picker), and `Not interested`.
  - Instalments surfaced in `HAVE YOU ALREADY WATCHED?` are excluded from `YOU MIGHT LIKE` so `YOU MIGHT LIKE` stays for discovering new titles.
  - `/watchlist/franchises` adds `TV SERIES & SPIN-OFFS IN YOUR LIBRARY` (savable as viewing orders) and `Seen it` date menu on missing entries.
  - `tmdb-proxy` v17 deployed and verified over HTTP (`endpoint=wikidata/tv-spinoffs`).
- **TMDB Library categories (`5050676b` + `20261118201834_watchlist_tmdb_categories`):** Hosted migration `20261118201834_watchlist_tmdb_categories` APPLIED (`yvtiybyuifkiwyrnjebe`); `watchlist-cron-sync` v20 DEPLOYED.
- **Library shelves + Discover grid/dialog (`b7aa0e1b`):** `Upcoming` holds every dated wait; `Up to date` holds open-ended running series; local-day countdown pills (`S1E8 in 3d`, `S3 in 2d`, `Out in 33d`); Discover uses `PosterCard`/`CardGrid` + rich detail dialog.
- **Earlier on `main` (`acf42c01` / `44f22ca`):** Diary, Franchises, import, OMDb scores & public ratings (`20261118190243_watchlist_tracking` applied, `OMDB_API_KEY` set; retire screenshot copy). First OMDb pass: 899/1,004 films checked, 0/343 shows yet (~450 queued for 06:00 UTC).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts` | 31 files / 468 tests pass |
| `npm run build` | pass |
| `tmdb-proxy` v17 HTTP probe | pass (`wikidata/tv-spinoffs` returns connected TV spin-offs) |
| Browser | not run against production for the new screens |

## Next

1. Verify GitHub Pages deploy for the latest `main` push, and browser-verify Discover (`HAVE YOU ALREADY WATCHED?`), Franchises (TV spin-offs and film collections), `S{n}E{e}` countdown pills, and signed-in admin flows on production.
2. After 2026-11-19 06:00 UTC parts: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout (~100 s/part).
3. Check Trakt export format against a real export (`last_watched_at`).

## Still unverified & blockers

- **Unverified:** Browser verification of new screens on production; signed-in admin flows (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads, `Seen it` date menu); `S{n}E{e}` live episode countdown pill; light mode; real phone; show "Created by" and cast dialog; `site_content` `about_me_1`/`about_me_2` (`section` NULL); ~30 anonymous warm-up reads; 2,447/2,532 undated watched episodes sort after dated titles under Recently watched.
- **Blockers:** Parallel sessions share checkouts; main checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` (`main` behind) has uncommitted edits/untracked drafts (`SITE_PLAN.md`, `*implementation*`, `.claude/launch.json`, `20261118130000_watchlist_tmdb_categories.sql`); worktrees `.claude/worktrees/caught-up` (`feat/watchlist-caught-up`) and `.claude/worktrees/affectionate-lamarr-f2d2cb` exist.
