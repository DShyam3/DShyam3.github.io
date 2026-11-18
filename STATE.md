# State

Updated 2026-11-18 · `main` (pushed on top of `5e4b3ac7`).

## Deployed & landed on `main`

- **Watchlist Discover/Franchises layout & faster add path:**
  - Responsive multi-column grids for franchise/collection cards: `HAVE YOU ALREADY WATCHED?` (`DiscoverySection.tsx`: 1 -> 2 -> 3 columns) and `/watchlist/franchises` (`WatchlistFranchises.tsx`: 1 -> 2 columns on `lg+`) eliminate the wide-screen single-column whitespace.
  - Eliminated full-library re-fetch on add (`WatchlistContext.tsx`): `addWatchlistItem` now appends the newly inserted movie or TV show (including its inserted seasons/episodes) directly into `watchlist` state via `setWatchlist`, invalidating `['watchlist', 'library-collections']` (for movies with a `collection_id`) and `invalidateWatchDerived(queryClient)` (when added as watched) instead of re-downloading the full library via `fetchData()`.
  - Eliminated duplicate `tv/{id}` TMDB fetch on TV show adds (`useTMDB.ts`, `WatchlistContext.tsx`, `DiscoverySection.tsx`, `useAddToLibrary.ts`, `WatchlistPage.tsx`): `getMovieDetails` returns `seasons` for TV shows and callers forward `options.seasons` into `addWatchlistItem`.
- **Earlier on `main` (`5e4b3ac7`, `1c6bbacb`, `ac9fae38`, `b7aa0e1b`, `5050676b`, `acf42c01`):**
  - `tmdb-proxy` v18 (`wikidata/tv-spinoffs` posters + dates), gap-first ranking, `Likely seen`, clickable posters/titles (`EntryPreviewDialog.tsx`), News `Following` scrim + `WeekStrip` + `OUT NOW` grid + `None of these`, Library shelf narrowing, `Shelf:` + `Favourite` pills, `NOW`/`Paramount+`/`Channel 4`/`Crunchyroll`, TMDB Library categories (`20261118201834` applied, `watchlist-cron-sync` v20), Diary, Franchises, Import, and OMDb scores (`20261118190243` applied, `OMDB_API_KEY` set).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts` | 32 files / 474 tests pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| Browser | not run against production for the new commit |

## Next

1. Verify GitHub Pages deploy for the latest `main` push and browser-verify `HAVE YOU ALREADY WATCHED?` (3-column grid, add-to-library / seen-it speed), `YOU MIGHT LIKE`, and `/watchlist/franchises` (2-column grid).
2. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unverified:** Production browser checks for the latest Watchlist features (multi-column Discover/Franchises grids, instant-state add path, spin-off posters, gap-first ordering, `Likely seen`, Library shelf search narrowing, `Shelf:` pill, new streaming platforms, News `Following`, Discover, Franchise screens); signed-in admin flows (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads, `Seen it` date menu); `S{n}E{e}` live countdown pill; light mode; phone viewport; show creator and cast dialog.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, etc.) and `.claude/launch.json` in local main checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
