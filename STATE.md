# State

Updated 2026-11-22. Branch `main`, committing and pushing to `origin/main`.

## Closed
- **Watchlist atomic prune & cron sync deployment**: Migration `20261122221500_watchlist_atomic_prune.sql` applied to hosted Supabase (`yvtiybyuifkiwyrnjebe`); Edge Function `watchlist-cron-sync` deployed; Deno unit tests passing (55/55).
- **Watchlist polish**: Phone News switch row collapsed to compact `<NativeSelect>` in `src/pages/WatchlistNews.tsx`; dead `upNextQueryOptions` / `selectUpNextRail` removed (`up-next-query.ts`, `watchlist-utils.ts`, 120/120 tests pass).

## Checks (2026-11-22)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` & `npm run build` | pass |
| `npm run test:functions` | pass (55/55) |
| `npx vitest run` | pass (120/120) |

## Still open
- Confirm Wikidata nightly cache run at `06:20Z` on `2026-11-23`.
- Renew Revolut bank consent in TrueLayer when convenient.
