# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **`/dev` status board & History rework**: Committed `src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, and `api-status.test.ts` (16/16 tests pass), with all `reviewer` (Pro) findings fixed (1,000-row PostgREST pagination, error-state banner & rate-limit guards, 12px Recharts floor, DST-safe sub-day bucketing, deterministic `id` tie-breaking).
- **Live browser audit fixes**: Fixed `WorkspaceInspector` mobile Vaul close button (`data-vaul-no-drag`) and ORB-blocked VS Code icon rewrite in `src/collections/link-icons.ts`.
- **Hosted DB**: Confirmed `20261120230000_watchlist_last_activity` (through `20261122201711_watchlist_not_seen`) already applied to `yvtiybyuifkiwyrnjebe`.
- **UI Craft & Floorplan Audit**: Completed Apple SF Symbols 7.3, shared Sovereign Folio dashboard primitives (`chart.tsx`, `metric-tile.tsx`, `bar-list.tsx`, `tracker.tsx`), mobile Vaul drawers, `layoutId` pills, smooth disclosure, dead-code/21-package cleanup, and large-file splits (15 → 10).

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` & `npm run build` | pass |
| `npx vitest run` (`api-status`, `link-icons`) | pass (21/21) |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns |
| `graphify update .` & `floorplan` refresh | pass |
| Live `browser` audit (`https://dshyam3.github.io`) | pass on Home, YearInHours, Travel, News, Diary; mobile drawer close + VS Code icon fixed |

## Still open & manual owner checks

- **Manual owner checks**: Real-phone mobile pass (Check 1), mobile PageSpeed Insights CWV (Check 5), `localStorage.setItem('umami.disabled', '1')` in owner browsers (Check 6), signed-in Discover steps 1–2 check, and Wikidata 06:20Z nightly run on 2026-11-23.
- **Minor live polish spotted in browser audit**: Investigate direct `Diary` → `Franchises` nav transition, desktop rail slight clip on `"08 INSPIRATION"` / `"Search"`, constellation label truncation when inspector is open, Experience `"Southmapton, UK"` typo (in DB), and `WatchlistDiary` Year `<select>` double chevron.
- **Ops**: Local DB drifted (`supabase db reset` restores it); Revolut bank access renewal in TrueLayer; `REHAUL_PLAN.md` items 9 & 10 b–d.
