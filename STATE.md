# State

Updated 2026-11-21. Branch `main`, rebased on `origin/main` (`36324d8d`).

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`): uncommitted, not deployed. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.
- Other uncommitted edits: `DotMatrixGlobe.tsx` (Travel), `useTMDB.ts` (Watchlist).

## Pushed, awaiting live browser check

- Watchlist (this push): Favourites tab & search (`WatchlistFavourites.tsx`, `WatchlistNav.tsx`, `FactCards.tsx`, `library-state.ts`), `WatchlistFranchises.tsx` `pb-8` & 44×44px/`h-7` search clear pills, franchise undated-filtering, Coming soon priority & `watchlist_collection_upcoming` cache; `reviewer` (`pro`) findings fixed, `20261121130500_watchlist_collection_upcoming.sql` applied & `watchlist-cron-sync` (including `8be68f3f` and `ba8dc6b6`) deployed remotely (`yvtiybyuifkiwyrnjebe`), not yet browser-verified on live.
- Watchlist: Franchises dims titles marked Not interested (`9452aeb3` on `main`). Signed-in owner path not browser-verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- Discover ordering by last activity (`31819643`), MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard & telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).

## Still open

- Migration `20261120230000_watchlist_last_activity.sql` is NOT applied to `yvtiybyuifkiwyrnjebe` (needs owner's OK; frontend falls back without the column).
- `watchlist-cron-sync` open items (`REHAUL_PLAN.md` item 10 b–d): watched episodes and ratings deleted; rated-then-unwatched seasons deleted; Season 0 specials deleted unchecked.
- Design questions (`REHAUL_PLAN.md` item 9): hiding/Stopped-watching stamping `last_activity_at`; history import stamping all imported titles with one `now()`.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate).
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks (2026-11-21, on rebased tree)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npx vitest run` (watchlist + `rls-admin-check.test.ts`) | pass, 37 files / 512 tests |
| `npm run build` | pass |
| `graphify update .` | pass |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Browser-verify live after Pages deploys: Favourites tab & search, clear-search pill, Franchises bottom padding & undated filtering, Coming soon `In your franchise` priority.
2. Owner's OK to apply `20261120230000_watchlist_last_activity.sql` to `yvtiybyuifkiwyrnjebe`, then browser-check Discover order.
3. Run `reviewer` on the `/dev` diff (3 files), then commit by path.

## Blockers

- Uncommitted `/dev`, `DotMatrixGlobe.tsx`, and `useTMDB.ts` files from other sessions must stay separate. Revolut bank access renewal.
