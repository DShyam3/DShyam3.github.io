# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **Shared Sovereign Folio dashboard primitives**: Added `src/components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`, `ChartLegend`), `metric-tile.tsx` (`MetricTile` with `NumberFlow`), `bar-list.tsx` (`BarList`, `CategoryBar`), and `tracker.tsx` (`Tracker`), wired into `SurfaceHero`, `DashboardSurface`, `NetWorthTrend`, `BankSyncStatus`, `YearReviewView`, and `TravelPage`.
- **Incremental >1,000-line sub-module splits** (`5d1c72fc`, Floorplan Health 15 → 10 large files): Split `holidays.ts`, `uk-tax-calculator.ts`, `student-loan.ts`, `WatchlistPage.tsx`, `FinancePage.tsx`, `DotMatrixGlobe.tsx`, `WatchlistContext.tsx`, `FinanceDataContext.tsx`, `TaxIncomeSurface.tsx`, `TransactionsTab.tsx`, and `BudgetSurface.tsx`.
- **UI craft, Apple SF Symbols & Floorplan cleanup** (`ba5b34d2`): 49 SF Symbols 7.3 SVG components, Sonner/Vaul/cmdk/NumberFlow, motion tokens, dead-code & 21 unused package removal, finance types moved to `src/lib/finance/types.ts`.
- **Discover as taste data** (`fc16742f`, `fbe288dd`, migration `20261122201711_watchlist_not_seen` applied to hosted).

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns |
| `graphify update .` & `floorplan` refresh | pass |
| `npm run typecheck:functions` & `test:functions` | pass (44 pass) |

## Still open & not verified (carry forward)

- Remaining UI Craft rollouts: Vaul mobile drawers (`FilterBar` & `WatchedWhenMenu` WIP in `git stash`, plus `BankSyncStatus` / `CashFlowSurface`), Sonner `toast.promise()`/Undo, remaining `layoutId` pills & height disclosures.
- Live browser verification of dashboard primitives, UI craft, SF Symbols, Vaul/cmdk, large file splits, Discover steps 1–2, and Wikidata cache reads on cold load.
- Launch checklist manual checks: Check 1 (real phone), Check 5 (mobile PageSpeed), Check 6 (`umami.disabled`), Check 10 (private window).
- Migration `20261120230000_watchlist_last_activity.sql` NOT applied to `yvtiybyuifkiwyrnjebe` (needs owner's OK).

## Next

1. Pop `wip: step 3 mobile Vaul drawers` stash and finish remaining UI Craft rollouts (#1, #3, #4) + Phase 5 live visual audit.
2. Live-verify Discover steps 1–2, Wikidata 06:20Z run, and launch checklist items (1, 5, 6, 10).
3. Finish `/dev` status board (`src/features/dev/*`), run `reviewer`, and commit separately.

## Blockers

- Uncommitted `/dev` files (`src/features/dev/*`) must stay separate; local DB drifted (`supabase db reset` restores it); Revolut bank access renewal.
