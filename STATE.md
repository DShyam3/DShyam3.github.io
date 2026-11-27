Updated 2026-11-27. Local `main` and `origin/main` synced with anon default privileges, travel map surfaces/double-coastline fixes, Ponytail setup, and audit fixes.

## Closed

- **Ponytail setup & whole-repo audit fixes** (pushed; **Edge Functions not yet deployed** to hosted Supabase): Installed Ponytail skills in `.agents/skills/ponytail*` and added the always-on ruleset to `AGENTS.md`. Fixed TrueLayer token-refresh error handling, 401/403 masking, non-finite amount filtering, concurrent source-sync upsert race, and fetch timeouts; eliminated module-level `activeUsage` races in `watchlist-cron-sync` and `merchant-logo-cache`, stream-capped Brandfetch logo downloads, paginated `links-check`, fixed JPEG `0xFF 0xFF` fill bytes, and added Deno tests (`require-admin`, `cooldown`, `jpeg`). Fixed finance insert-before-delete for 4 settings tables, DB-first debt observations sorted by date, same-day CSV duplicate imports, debt month-overflow, cash-benefit tax stacking, negative pension pot, and rule-applied baseline drift. Deleted orphaned `src/lib/in-chunks.ts`, dead `equalEarth`/`sf-symbols` exports, duplicated helpers, and `dotenv`; replaced all `src/` `date-fns` call sites (`date-fns` kept in `package.json` as a `react-day-picker` peer dependency).
- **Cleaned card images** (`64aa9de3`, live on Pages via deploy `46042232214` attempt 2).

## Travel (pushed)

- All three map looks mark visited cities and outline visited-country borders and coastlines. Topographic and Satellite mosaic refine through 120, 45, 17 and 6 km hexes. Full-resolution imagery loads on demand. Reduced motion applies view changes immediately and disables idle rotation.
- The earlier local Chrome check showed a single coastline at 6 km in all three looks. Current map checks passed lint, frontend and Edge Function typechecks, production build and 59 tests in six map files. A separate cold 6 km check loaded both hemispheres and recorded one 67 ms frame gap (95th percentile 17 ms). Changing choices during a delayed load and reduced-motion globe/flat switching passed.
- Maximum frame intervals in one local desktop Chrome run, before → after: first appearance switch 367 → 17 ms, zoom into finer levels 200 → 17 ms, zoom out 33 → 17 ms, globe/flat 17 → 17 ms. Phone frame timing and real iPhone/iPad gestures are unverified.

## Last checks (2026-11-27)

| Check | Result |
|---|---|
| `npm run lint` / `typecheck` / `typecheck:functions` / `build` | Passed (`0` errors, `0` warnings). |
| `npm run test:functions` (Deno) | 124 passed, 0 failed. |
| `npm test` (Vitest) | 147 files, 3,245 passed. |
| `impeccable detect src/` | 0 anti-patterns (1 advisory). |

## Recent shipped work

- Links metadata, daily dead-link checking, likely seen language-aware paging, Payslip parser fixes, and cleaned card images are in Git / on `origin/main`.

## Still open / not verified

- **Ponytail audit fixes:** Modified Edge Functions (`truelayer-sync`, `watchlist-cron-sync`, `merchant-logo-cache`, `item-image`, `links-check`, `sync-bank-holidays`, `tmdb-proxy`, `travel-photo`) are **not yet deployed** to hosted Supabase. Monolith splits (#18) and `src/lib/finance/llm.ts` removal were intentionally deferred.
- **Travel & Inventory:** Real-device iPhone/iPad checks of map pinch zoom and touches.
- **Other surfaces:** Live owner-signed-in checks of `/watchlist/franchises`, `/watchlist/facts`, Dead-link failures, and manual TV sync.

## Next

1. Deploy updated Edge Functions to hosted Supabase.
2. Verify map appearance on iPhone/iPad; open Inventory and Links signed in on Pages; complete live owner-signed-in checks.

## Blockers

The billing lock cleared. The last confirmed Pages deployment is `46042232214` attempt 2.
