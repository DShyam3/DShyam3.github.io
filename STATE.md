# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **UI Craft Step 3 (mobile drawers, motion, toasts)**: Wired swipe-to-dismiss Vaul bottom drawers on mobile into `FilterBar`, `WatchedWhenMenu`, `BankSyncStatus`, and `CashFlowSurface`; upgraded CV upload in `Index.tsx` to `toast.promise()`; added Framer Motion `layoutId` indicators to Home mode tabs (`Index.tsx`) and Finance section nav (`FinancePage.tsx`), plus smooth `AnimatePresence` disclosure on `YearInHours` *Sources and assumptions*.
- **Shared Sovereign Folio dashboard primitives** (`1310ea7d`): Added `src/components/ui/chart.tsx`, `metric-tile.tsx`, `bar-list.tsx`, and `tracker.tsx`, wired into `SurfaceHero`, `DashboardSurface`, `NetWorthTrend`, `BankSyncStatus`, `YearReviewView`, and `TravelPage`.
- **Incremental >1,000-line sub-module splits** (`00527d91`, Floorplan Health 15 → 10 large files) + **Apple SF Symbols 7.3 & Floorplan cleanup** (`ba5b34d2`) + **Discover taste data** (`fc16742f`, `fbe288dd`).

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

- Live browser verification of mobile Vaul drawers, `layoutId` pills, dashboard primitives, SF Symbols, large file splits, Discover steps 1–2, and Wikidata cache reads on cold load (desktop/mobile, light/dark, `prefers-reduced-motion`).
- Launch checklist manual checks: Check 1 (real phone), Check 5 (mobile PageSpeed), Check 6 (`umami.disabled`), Check 10 (private window).
- Migration `20261120230000_watchlist_last_activity.sql` NOT applied to `yvtiybyuifkiwyrnjebe` (needs owner's OK).

## Next

1. Live-verify the deployed site on desktop & phone (light/dark + reduced-motion) covering launch checks 1, 5, 6, 10 and Discover steps 1–2.
2. Confirm Wikidata 06:20Z nightly run on 2026-11-23.
3. Finish `/dev` status board (`src/features/dev/*`), run `reviewer`, and commit separately.

## Blockers

- Uncommitted `/dev` files (`src/features/dev/*`) and `deno.lock` in working tree; local DB drifted (`supabase db reset` restores it); Revolut bank access renewal.
