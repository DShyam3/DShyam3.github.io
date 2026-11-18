# State

Updated 2026-11-18 · `main` (pushed on top of `3e2f8303`).

## Deployed & landed on `main`

- **Watchlist loading, caching, update/resync, and nightly sync performance pass:**
  - **Loading & caching:**
    - `selectAllPages` (`src/integrations/supabase/select-all-pages.ts`) now fetches remaining 1,000-row pages in parallel after page 1 returns `count`.
    - `library-query.ts` now selects `collection_id, collection_name` on `movies` and sets `staleTime: 5 * 60 * 1000`, eliminating the duplicate `movies` table scan in `useDiscovery.ts` and `WatchlistFranchises.tsx`.
    - `useSiteWarmup.ts` now prefetches `watchlistRatingsQuery` alongside `watchlistLibraryQuery` so Discover recommendations don't stall on cold start.
    - `useTMDB.ts` now caches `getMovieDetails`, `getCollection`, and `getTvSpinoffs` in React Query (`30m` / `24h` `staleTime`) with in-flight deduplication across dialogs, Discover, and Franchises.
    - `useDiscovery.ts` & `discovery.ts`: per-collection `useQueries` share cache with `CollectionCard` and avoid re-fetching earlier collections on `Show more`; `curateDiscovery` calls are memoized; `interleaveBySeed` builds buckets in `O(n)`; `dismiss` no longer triggers a redundant `DISMISSED_QUERY_KEY` refetch after `setQueryData`.
  - **Updating & resyncing (`WatchlistContext.tsx`):**
    - `addFavourite` updates `favourites` in place via `.insert(...).select().single()` (no `fetchData()`), and `toggleFavourite` (`WatchlistPage.tsx`, `LibraryActions.tsx`) passes `facts` already in memory (no duplicate TMDB fetch).
    - `syncSingleItem` / `runServerSync(target)` refreshes only the single resynced row instead of re-fetching all 1,400+ titles and wiping `loadedShowsRef` / `loadedDescriptionsRef`.
    - `syncFavouriteFacts` runs with bounded concurrency (5) and updates `favourites` in place instead of `fetchData()`.
    - Lazy detail hydrations (`loadItemDescription`, `loadShowEpisodes`) skip invalidating `['watchlist', 'news']`; `setMovieWatched` uses `.update(...).select(...).single()`; `toggleEpisodeWatched` / `toggleSeasonWatched` update `watched_at` in one `setWatchlist` pass when marking watched now.
  - **Edge functions (in `main`, pending deploy to Supabase):**
    - `supabase/functions/tmdb-proxy/index.ts`: adds `Cache-Control` headers on `200` responses (`3600s` browser / `86400s` CDN for stable movie/collection/season/spinoff responses, `900s` / `3600s` for search/discover/show details).
    - `supabase/functions/watchlist-cron-sync/index.ts`: skips `hidden`/`stopped` titles during nightly runs, dirty-checks `movies` and `tv_shows` before writing, scopes `Returning Series`/`In Production` season refreshes to recent/latest seasons, avoids infinite TBA `episode_count` re-fetches on settled `Ended`/`Canceled` shows, eliminates both redundant `tv_show_episodes` `SELECT`s and unchanged season/episode writes, and batches removed-season deletes.

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts src/integrations/supabase/select-all-pages.test.ts` | 33 files / 481 tests pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| Edge functions deploy (`tmdb-proxy`, `watchlist-cron-sync`) | **not yet deployed** (awaiting user confirmation for hosted mutation `--yes`) |
| Browser | not run against production for the new commit |

## Next

1. Deploy `tmdb-proxy` and `watchlist-cron-sync` to Supabase (`npx supabase functions deploy tmdb-proxy watchlist-cron-sync --remote=yvtiybyuifkiwyrnjebe`).
2. Verify GitHub Pages deploy for the latest `main` push and browser-verify Discover, Franchises, Library adds/favourites/resyncs.
3. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unverified:** Hosted Edge Function deploy for `tmdb-proxy` (v19) and `watchlist-cron-sync` (v22); production browser checks for the latest Watchlist features and performance pass; signed-in admin flows; light mode; phone viewport.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, etc.) and `.claude/launch.json` in local main checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
