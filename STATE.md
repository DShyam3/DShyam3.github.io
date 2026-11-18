# State

Updated 2026-11-18 · `main` (pushed from `codex/tmdb-categories` on top of `acf42c01`).

## Landed on `main` — TMDB Library categories

TMDB-fact-derived Library categories (`Anime`, `Cartoon`, `K-Drama (TV)`, `Action`, `Sci-Fi`, `Documentary`) with schema-tolerant reads/writes (`category-schema.ts`, `library-categories.ts`, `library-query.ts`, `new-item.ts`, `discovery-add.ts`, `useTMDB.ts`, `watchlist-cron-sync/index.ts`).

- **Not applied / not deployed:** `supabase/migrations/20261118210000_watchlist_tmdb_categories.sql` is WRITTEN, NOT APPLIED to hosted yet, and `watchlist-cron-sync` is not yet redeployed with the new TMDB category fact fields (v18 is live). Client reads/writes fall back gracefully when the columns are absent.

## Deployed on hosted (`acf42c01` / `44f22ca`)

- **Diary, Franchises, import, OMDb scores & public ratings:** `20261118190243_watchlist_tracking` applied, `tmdb-proxy` v15 and `watchlist-cron-sync` v18 deployed, `OMDB_API_KEY` set (retire copy shown in chat screenshot). First OMDb pass (19:36–19:45 UTC, 3 parts, 200 OK): 899/1,004 films checked (851 IMDb, 724 RT, 731 Metacritic); 0/343 shows yet (~450 remaining queued for 06:00 UTC). Anon reads and security advisor checked.
- **Earlier on `main`:** `0ba78391` Discover fixes, `63fa21b6` Watchlist News/Library redesign, `3d17b507` Credits, `12bb88d9` TitleRef.

## Checks (2026-11-18, `codex/tmdb-categories`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts` | 31 files / 461 tests pass (30 watchlist + `rls-admin-check`) |
| `npm run build` | pass |
| `npm run ship-check` | 93/100 (critical: known airport-code false positive in `airport-countries.data.ts`) |
| `graphify update .` | pass (2,765 nodes, 6,534 edges) |
| Browser / hosted RPC | not run for new screens; `set_watched` scratch-tested only |

## Next

1. Apply `20261118210000_watchlist_tmdb_categories.sql` to hosted and redeploy `watchlist-cron-sync`.
2. Browser-verify every new screen on production (signed out and signed-in admin).
3. After 2026-11-19 06:00 UTC parts: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout (~100 s/part).
4. Check Trakt export format against a real export (`last_watched_at`).
5. Decide on Discover "Seen it" date prompt (currently stamps today; ~54 films added 2026-11-18).

## Still unverified & blockers

- **Unverified:** Signed-in admin on production (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads); light mode; real phone; show "Created by" and cast dialog; `site_content` `about_me_1`/`about_me_2` (`section` NULL); ~30 anonymous warm-up reads; 2,447/2,532 undated watched episodes sort after dated titles under Recently watched.
- **Blockers:** Parallel sessions share one checkout (fetch first, one committer); main checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` (`main` behind 20) has uncommitted edits/untracked drafts (`SITE_PLAN.md`, `*implementation*`, `.claude/launch.json`, overlapping watchlist/doc edits including `20261118130000_watchlist_tmdb_categories.sql`); worktrees `.claude/worktrees/caught-up` (`feat/watchlist-caught-up`) and `.claude/worktrees/affectionate-lamarr-f2d2cb` exist.
