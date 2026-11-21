# State

Updated 2026-11-21. Branch `main`, head `419e3340` (custom `franchise` override & year-dedupe commit ready to push).

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`; held in `git stash@{0}`): not committed, not deployed. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.

## Pushed, awaiting live browser check

- Watchlist (this push): `tvFranchisesFromLinks` respects explicit custom `franchise` overrides (excluding reassigned shows from Wikidata's group) and `customFranchisesFromLibrary` strips duplicate trailing `(YYYY)` years (`src/features/watchlist/franchise.ts`, `franchise.test.ts`); not yet browser-verified on live.
- Watchlist (`419e3340`): bumped `tv-spinoffs` query cache key to `v2` (`useTMDB.ts`, `WatchlistFranchises.tsx`, `useDiscovery.ts`) for immediate widened sibling TV franchise results, and merged library items whose custom `franchise` tag matches an existing TV franchise or film universe name into that card (`franchise.ts`, `franchise.test.ts`); not yet browser-verified on live.
- Watchlist (`747dd7e5`): Discover poster-order fix (`useDiscovery.ts`, `DiscoverySection.tsx`), Franchises shared film universes / merged TV franchise cards / `Largest` | `A–Z` sort (`franchise.ts`, `franchise.test.ts`, `WatchlistFranchises.tsx`), and `tmdb-proxy` Pass 2 sibling TV franchise expansion (`supabase/functions/tmdb-proxy/index.ts`, deployed `--no-verify-jwt` to `yvtiybyuifkiwyrnjebe`). `reviewer` (`pro`) ran and all 4 findings are fixed (movie vs TV saved-order matching, `stopped` exclusion for visitors on Franchises, bounded 10-worker TMDB enrichment + non-deprecated `P179`, per-`LibraryType` `recommendationsOrder`); not yet browser-verified on live.
- Watchlist (`354995c2`): Favourites tab & search (`WatchlistFavourites.tsx`, `WatchlistNav.tsx`, `FactCards.tsx`, `library-state.ts`), `WatchlistFranchises.tsx` `pb-8` & 44×44px/`h-7` search clear pills, franchise undated-filtering, Coming soon priority & `watchlist_collection_upcoming` cache; `20261121130500_watchlist_collection_upcoming.sql` applied & `watchlist-cron-sync` (including `8be68f3f` and `ba8dc6b6`) deployed remotely (`yvtiybyuifkiwyrnjebe`), not yet browser-verified on live.
- Watchlist: Franchises dims titles marked Not interested (`9452aeb3` on `main`). Signed-in owner path not browser-verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- Discover ordering by last activity (`31819643`), MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard & telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).

## Still open

- Migration `20261120230000_watchlist_last_activity.sql` is NOT applied to `yvtiybyuifkiwyrnjebe` (needs owner's OK; frontend falls back without the column).
- `watchlist-cron-sync` open items (`REHAUL_PLAN.md` item 10 b–d): watched episodes and ratings deleted; rated-then-unwatched seasons deleted; Season 0 specials deleted unchecked.
- Design questions (`REHAUL_PLAN.md` item 9): hiding/Stopped-watching stamping `last_activity_at`; history import stamping all imported titles with one `now()`.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate).
- Travel hovered-hex outline and two-minute globe lock: pushed with this commit; not yet checked on the live site.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks (2026-11-21, on this tree)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run src/features/watchlist/` | pass, 36 files (37 tests in `franchise.test.ts`; full suite not re-run) |
| `npm run build` | pass |
| `graphify update .` | pass |
| `npm run typecheck:functions` | not re-run (no function changes); earlier pass 2026-11-21 |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Browser-verify live after Pages deploys: custom `franchise` override & year-dedupe, `tv-spinoffs` v2 cache & tag merge, Discover poster order, Franchises universes / merged TV cards / `Largest` sort, Favourites tab/search, clear-search pill, padding & undated filtering, Coming soon priority.
2. Owner's OK to apply `20261120230000_watchlist_last_activity.sql` to `yvtiybyuifkiwyrnjebe`, then browser-check Discover order.
3. Pop `git stash@{0}` for `/dev` (3 files), run `reviewer`, then commit by path.

## Blockers

- Uncommitted `/dev` (`git stash@{0}`) and `DotMatrixGlobe.tsx` files from other sessions must stay separate. Revolut bank access renewal.
