# State

Updated 2026-11-18 · `main` rebased/merged onto `origin/main` (`ac9fae38`), uncommitted local changes ready to commit & push.

## Landed locally (uncommitted) & on `origin/main`

- **Local Watchlist updates (uncommitted on `main`):**
  - Library search & shelf visibility: shelf dropdown shows `All shelves (N)` and live match counts per shelf while searching; picking a shelf narrows the search to that shelf without clearing the query. `WatchlistDetailDialog` displays a `Shelf: <shelf>` pill and `Favourite` heart pill in the top badge row.
  - Streaming platform allowlist: added `NOW`, `Paramount+`, `Channel 4`, and `Crunchyroll` (`sync-logic.ts`, cron-sync, `PlatformLogo.tsx`, `sync-logic.test.ts`).
  - Watchlist News `Following` + Discover/Season/Sync improvements (`Worth your attention` backdrop scrim, plot overview, `WeekStrip`, `OUT NOW` grid, `None of these` batch dismiss, `N season(s)`, series status pill in top badge row, season rating prompt and auto-advance).
- **On `origin/main` (`ac9fae38`):** Grouped film collections & TV spin-offs in Discover (`HAVE YOU ALREADY WATCHED?`) and Franchises (`TV SERIES & SPIN-OFFS IN YOUR LIBRARY`), `tmdb-proxy` v17, `watchlist-cron-sync` v20, migration `20261118201834_watchlist_tmdb_categories` applied, Library `Upcoming`/`Up to date` shelves & countdown pills, Diary, Import, and OMDb scores.

## Checks (2026-11-18, local working tree)

- `npm run lint`: 0 errors, 0 warnings
- `npm run typecheck`: pass
- `npm run typecheck:functions`: pass (`deno check`)
- Vitest: 32 test files pass (all tests green)
- `npm run build`: pass
- `graphify update .`: pass

## Next

1. Commit and push `main` (on top of `ac9fae38`), verify GitHub Pages deploy, and browser-verify Watchlist News `Following`, Discover, Franchise screens, Library search shelf filtering, and new platform badges on production.
2. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unverified:** Production browser checks for new features (Library shelf search narrowing, `Shelf:` pill, new streaming platforms, News `Following`, Discover, Franchise screens); signed-in admin flows (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads, `Seen it` date menu); `S{n}E{e}` live countdown pill; light mode; phone viewport; show creator and cast dialog.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, etc.) and `.claude/launch.json` in checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
