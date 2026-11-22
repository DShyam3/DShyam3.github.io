# State

Updated 2026-11-22. Branch `discover-taste` (worktree `.claude/worktrees/discover-answers`), rebased on `origin/main` at `1310ea7d`. No uncommitted work from this session.

## Closed

- **Discover as taste data, step 3: taste profile** (`fbe288dd`, "feat(watchlist): a taste profile picks each source title's best fits in You might like", pushed 2026-11-22). Live via `00527d91`. No migration.
  - Its own Pages run `45072452942` failed on Typecheck, not on its code: `ba5b34d2` (another session's UI commit) left `src/contexts/DotMatrixContext.tsx` failing TS2352 (`iconPatterns`).
  - `00527d91` removed `iconPatterns`, sat on top of `fbe288dd`, and its Pages run `45072502745` succeeded.
- **Discover step 2: Likely seen and Not seen** (`fc16742f`, migration `20261122201711_watchlist_not_seen` applied to hosted).
- **Discover step 1: answers store why and where** (`ec6881fa`, migration `20261122192738_watchlist_dismissal_reasons` applied to hosted).
- **Sub-module splits** (`5d1c72fc`, Floorplan Health 15 → 10 large files; `00527d91`, another session, finance, watchlist and globe modules split further).
- **UI craft, Apple SF Symbols & Floorplan cleanup** (`ba5b34d2`): 49 SF Symbols 7.3 SVG components, Sonner/Vaul/cmdk/NumberFlow, motion tokens, dead-code and 21 unused package removal, finance types moved to `src/lib/finance/types.ts`.
- **Shared Sovereign Folio dashboard primitives** (`1310ea7d`): Added `src/components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`, `ChartLegend`), `metric-tile.tsx` (`MetricTile` with `NumberFlow`), `bar-list.tsx` (`BarList`, `CategoryBar`), and `tracker.tsx` (`Tracker`), wired into `SurfaceHero`, `DashboardSurface`, `NetWorthTrend`, `BankSyncStatus`, `YearReviewView`, and `TravelPage`.

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings (at `fbe288dd` after rebase on `ba5b34d2`) |
| `npm run typecheck` | failed at `fbe288dd` on `DotMatrixContext.tsx` TS2352 from `ba5b34d2`; `00527d91` removed it; no local re-run recorded since |
| `npm run build` | pass (at `fbe288dd` after rebase on `ba5b34d2`) |
| Tests | 128 test files / 2,998 tests (at `fbe288dd` after rebase) |
| `npm run typecheck:functions` & `test:functions` | pass (44 pass), earlier today, not re-run |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns, earlier today, not re-run |

## Still open & not verified (carry forward)

- **Discover steps 1–3, signed-in owner view**: not verified (REHAUL_PLAN Discover item 4).
- **Discover, signed out, local dev server**: taste line, best-fit picks, the same tiles after leaving Discover and returning, no console errors on a clean load. Verified.
- **Discover, live after `00527d91`**: taste line reads "films lean to Comedy, Action, Adventure · 2010s · English; series lean to Drama, Comedy, Adventure · 2020s · English", no errors. YOU MIGHT LIKE still read "Finding more suggestions…" at 20s (its known paging through already-known titles).
- **Reviewer (Opus) on step 3**: both bugs fixed (profile frozen before ratings; part-watched series weighted as backlog), and all risks fixed. The fixes are not re-reviewed.
- **Wikidata nightly cache** (`f618f259`, on main; migration `20261122195334` applied to hosted): cold-load reads on live and the 06:20Z run are not yet verified.
- Remaining UI Craft rollouts: Vaul mobile drawers (`FilterBar` & `WatchedWhenMenu` WIP in `git stash`, plus `BankSyncStatus` / `CashFlowSurface`), Sonner `toast.promise()`/Undo, remaining `layoutId` pills & height disclosures.
- Live browser verification of dashboard primitives, UI craft, SF Symbols, Vaul/cmdk, and large file splits.
- Launch checklist manual checks: Check 1 (real phone), Check 5 (mobile PageSpeed), Check 6 (`umami.disabled`), Check 10 (private window).

## Next

1. REHAUL_PLAN "Discover as taste data" items 1–3: answers carry genres so dislikes count; wildcards; Seen it offers the rating.
2. Verify the signed-in owner view of Discover steps 1–3 (REHAUL_PLAN Discover item 4).
3. Live-verify the Wikidata cache's cold-load reads and the 06:20Z run.
4. Pop `wip: step 3 mobile Vaul drawers` stash and finish remaining UI Craft rollouts (#1, #3, #4) + Phase 5 live visual audit.
5. Live-verify launch checklist items (1, 5, 6, 10). Finish `/dev` status board (`src/features/dev/*`), run `reviewer`, and commit separately.

## Blockers

- Uncommitted `/dev` files (`src/features/dev/*`) must stay separate; local DB drifted (`supabase db reset` restores it); Revolut bank access renewal.
- Worktree `.claude/worktrees/discover-answers` has its own `node_modules` (`npm ci`) and a gitignored `.env` symlink to the shared checkout's.
