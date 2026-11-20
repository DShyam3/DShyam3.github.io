# State

Updated 2026-11-20 · `main` pushed to `origin/main` (all instrumented edge functions deployed to `yvtiybyuifkiwyrnjebe`: `tmdb-proxy`, `sync-bank-holidays`, `watchlist-cron-sync`, `truelayer-sync`, `merchant-logo-cache`; `20261120201500_api_usage_metrics.sql` applied remotely). Working tree clean.

## Pushed, still open

- Status-first `/dev` dashboard, full API/cron telemetry (TMDB, OMDb, Wikidata, Supabase, TrueLayer, Brandfetch, UK Bank Holidays, Book Catalogues), and Discover franchise retry/loading fixes: pushed to `main`, awaiting GitHub Pages deploy & live browser check.
- `5296949c` (2026-11-20): Travel projection picker + H3 zoom levels, Home constellation fix, Watchlist News pagination/calendar layout, Watchlist Franchises expansion & filtering.
- Open: Marvel as one group (needs new `tmdb-proxy` universe lookup); Revolut bank access needs renewing; real-device Travel zoom/constellation and OMDb weekly refresh (~2026-11-25) verification.

## Checks (2026-11-20)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm test` | pass, 119 files / 2,885 tests |
| `npm run build` | pass |
| `graphify update .` | pass |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Browser-verify `/dev` (live status cards, reset countdown, History modal chart) and Discover (`Show more series & collections`, 429 retry banner) on live once Pages deploys.
2. Verify real-device Travel zoom/projection/constellation and weekly OMDb refresh (~2026-11-25).
