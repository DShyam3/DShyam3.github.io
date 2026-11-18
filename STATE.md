# State

Updated 2026-11-18 · `main` (pushed from `codex/tmdb-categories` on top of `5050676b`).

## Deployed & landed on `main`

- **TMDB Library categories (`5050676b` + `20261118201834_watchlist_tmdb_categories`):** Hosted migration `20261118201834_watchlist_tmdb_categories` APPLIED (`yvtiybyuifkiwyrnjebe`); `watchlist-cron-sync` v20 DEPLOYED (with TMDB fact fields); `tmdb-proxy` v16 active. Security & performance advisors checked 2026-11-18 (no new findings).
- **Library shelves + Discover grid/dialog (pushed to `main`):** `Upcoming` holds every dated wait (including caught-up series with a dated return); `Up to date` holds open-ended running series; local-day countdown pills (`S1E8 in 3d`, `S3 in 2d`, `Out in 33d`); Discover uses `PosterCard`/`CardGrid` + rich detail dialog (poster, genres, platform, series status, credits, runtime).
- **Earlier on `main` (`acf42c01` / `44f22ca`):** Diary, Franchises, import, OMDb scores & public ratings (`20261118190243_watchlist_tracking` applied, `OMDB_API_KEY` set; retire screenshot copy). First OMDb pass: 899/1,004 films checked, 0/343 shows yet (~450 queued for 06:00 UTC).

## Checks (2026-11-18, `codex/tmdb-categories`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts` | 31 files / 466 tests pass |
| `npm run build` | pass |
| `graphify update .` | pass (2,771 nodes, 6,564 edges, 135 communities) |
| Browser / hosted RPC | not run for new screens; `set_watched` scratch-tested only |

## Next

1. Verify GitHub Pages deploy for the latest `main` push, and browser-verify all new screens on production (signed out and signed-in admin), plus `S{n}E{e}` live episode countdown pill.
2. After 2026-11-19 06:00 UTC parts: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout (~100 s/part).
3. Check Trakt export format against a real export (`last_watched_at`).
4. Decide on Discover "Seen it" date prompt (currently stamps today; ~54 films added 2026-11-18).

## Still unverified & blockers

- **Unverified:** Browser verification of new screens on production; signed-in admin flows (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads); `S{n}E{e}` live episode countdown pill; light mode; real phone; show "Created by" and cast dialog; `site_content` `about_me_1`/`about_me_2` (`section` NULL); ~30 anonymous warm-up reads; 2,447/2,532 undated watched episodes sort after dated titles under Recently watched.
- **Blockers:** Parallel sessions share checkouts; main checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` (`main` behind 20) has uncommitted edits/untracked drafts (`SITE_PLAN.md`, `*implementation*`, `.claude/launch.json`, `20261118130000_watchlist_tmdb_categories.sql`); worktrees `.claude/worktrees/caught-up` (`feat/watchlist-caught-up`) and `.claude/worktrees/affectionate-lamarr-f2d2cb` exist.
