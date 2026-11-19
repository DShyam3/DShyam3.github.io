# State

Updated 2026-11-18 · `main` at `5e4b3ac7` (uncommitted `TitleScores`/TMDB score changes + Supabase caching, progressive warmup & public IndexedDB persistence ready to commit/push).

## Ready to commit & push on `main`

- **Supabase caching, progressive warmup & public IndexedDB persistence:**
  - `src/lib/query-cache-persistence.ts` (+ `query-cache-persistence.test.ts`), `src/App.tsx`: raised default React Query `staleTime` to `10m` and added zero-dependency IndexedDB persistence for an explicit allowlist of public queries only (Finance, Beliefs, personal ratings, `sync_log`, signed photo URLs, and admin Travel journal rows are never written to disk).
  - `src/hooks/useSiteWarmup.ts`, `src/features/finance/FinanceSession.tsx`: replaced the single-burst startup prefetch with a route-aware 3-stage idle queue (warming Diary, Viewing Orders, Travel journal, `favouriteTitlesQuery`, TrueLayer status, and Merchant Logos) and staggered idle Finance warmup by 2.5s off-route.
  - `src/features/finance/useTrueLayer.ts`, `useMerchantLogos.ts`, `FinanceDataContext.tsx`, `FinancePage.tsx`: moved `check_connection` and merchant logos into shared React Query entries (eliminating 3× duplicate Edge Function calls on `/finance` open and per-tab refetches on Home/Accounts), bumped `refreshIfStale` to `10m`, skipped duplicate `finance_profiles` reads and cached static reference tables across background refreshes.
  - `src/features/watchlist/WatchlistContext.tsx`, `library-query.ts`, `ratings-query.ts`: moved `sync_log` into React Query with explicit columns and aligned library/ratings `staleTime` to `10m`.
  - `src/features/travel/journal-media.ts`, `TravelJournalPanel.tsx`, `journal-archive.ts`, `useTravelJournal.ts`, `EdcBuilderDialog.tsx`, `FactCards.tsx`: batched Travel photo signed URLs (`createSignedUrls`), parallelized backup/restore photo transfers (concurrency 4), removed duplicate EDC invalidation, and narrowed `FactCards` `site_content` invalidation to `about`.
- **Watchlist `TitleScores` badges + TMDB score (`TitleScores.tsx`, `WatchlistDetailDialog.tsx`, `EntryPreviewDialog.tsx`, `tmdb-types.ts`, `useTMDB.ts`):**
  - Added `tmdb_rating` / `tmdb_votes` to TMDB detail records and rendered colour-coded badges/icons (`My score`, `IMDb`, `RT`, `Metacritic`, `TMDB`).

## Deployed & landed on `main` (`5e4b3ac7` and earlier)

- **Watchlist Discover, News & Franchises:** `tmdb-proxy` v18 deployed; gap-first ranking, `Likely seen` consensus, `EntryPreviewDialog`, News `Following` scrim + `WeekStrip` + `OUT NOW` grid, Library shelf filters/categories (`20261118201834`), Diary, Franchises, Import, and OMDb scores (`20261118190243`; 899/1,052 films checked, 0/377 shows yet).

## Checks (2026-11-18, local working tree)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 107 files pass (incl. `query-cache-persistence.test.ts`) |
| `npm run build` | pass |
| `graphify update .` | pass |
| Browser | not run for caching/IndexedDB changes, `TitleScores`, or recent Watchlist commits |

## Next

1. Commit and push the uncommitted changes on `main`.
2. Verify GitHub Pages deploy and browser-verify: Watchlist ↔ Finance switching + internal tabs (Network tab confirming single `check_connection`, no 60s churn, IndexedDB public cache hydration on reload, no Finance keys in IndexedDB), `TitleScores`/TMDB scores, Discover, and `/watchlist/franchises`.
3. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unverified:** Browser verification of IndexedDB public cache hydration/privacy boundary, staged warmup, Watchlist ↔ Finance switching, Travel batched signed URLs, `TitleScores` badges/TMDB scores, Watchlist Discover/News/Franchise/Library flows, signed-in admin flows, `S{n}E{e}` live countdown pill, light mode, phone viewport, and show creator/cast dialog.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`) and `.claude/launch.json` in local main checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
