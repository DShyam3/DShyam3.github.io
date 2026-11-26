# State

Updated 2026-11-26, `main` at `6b16f6a6`. `main` tracks `origin/main`. Commit `83c6bf9e` contains rating timestamps, Discover TV franchise and Likely seen changes, and the manual TV series-status picker and sync baseline. Hosted Supabase's migration list (read 2026-11-26) includes both of its migrations and both of `e3619d09`'s; `tmdb-proxy` / `watchlist-cron-sync` deployments are carried as reported. Main also holds peer commits `e3619d09` (overlapping custom franchises) and `fb9fac0a` (Likely seen paging fix) from another session.

## Closed
- **Daily dead-link check** (`1467d995`, `7c35d266`, `274e3bef`, `6b16f6a6`): `link_checks` holds one owner-only row per link; the `links-check` function runs daily via pg_cron (`40 4 * * *`) and the owner sees failing and stalled links behind a Links button. Hosted: function deployed, migration recorded as `20261126123059`, RLS on with an admin-only read. A manual run through the cron's path returned HTTP 200, `{"checked":7,"failed":0,"unchecked":0}`. GitHub Pages run `45820456648` succeeded. Decisions are in `REHAUL_HISTORY.md` 2026-11-26.
- **Manual TV series status** (`83c6bf9e`): the admin can choose Returning series, In production, Ended or Canceled in a show's details. `tv_shows.tmdb_status` remembers the last TMDB status; an unchanged TMDB value preserves the manual choice, and a changed value takes over. Migration `20261125210855_watchlist_tmdb_status_baseline.sql` backfills the baseline. Behaviour is unit tested; owner-signed-in UI and a live sync have not been checked.
- **Rating timestamps** (`83c6bf9e`): `watchlist_ratings.rated_at` records the initial rating date; edits preserve it, and Trakt imports carry their rated dates. Migration `20261125210500_watchlist_ratings_rated_at.sql` is on hosted (recorded as `20261125210715`).
- **Discover TV franchises, Likely seen “None of these”, reset confirmation, dialog focus return** (`83c6bf9e`): TV franchises include Wikidata `P8345` and `P179` siblings; failed franchise queries leave the old cache row. Likely seen can mark its page Not seen with Undo, reset asks first, and confirmations restore focus.
- **Transactions overflow and Finance Try again** (`f62c2d84`, `6d8757fe`, `3c43a5fe`), touch checkbox sizing (`d8f5600c`), Finance error screen (`fb52e71f`), episode scores (`4a44c99a`), Finished tab (`8d5c32f1`), rating queue (`e05e3049`) and Transactions details sheet (`d5bc2ac2`) remain in the tree. See FEATURES.md for current behaviour.

## Last checks (2026-11-26, rebased tree, same content as `6b16f6a6`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run test:functions` | 87 pass |
| `npx vitest run` | 136 files, 3,115 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns; one advisory, grid background at `src/index.css:388`, pre-existing |
| `npm run ship-check` | 90/100, unchanged; airport-code string flagged as AWS key (known false positive); no finding touches the new files |

Previous, 2026-11-25: lint, typecheck, typecheck:functions, build pass; test:functions 60 pass; ship-check 90/100 with the same airport-code false positive.

## Still open / not verified
- **Dead-link check:** the first scheduled run (after 2026-11-27 04:40 UTC) has not happened yet. The failing and stalled views are browser-checked only on the local stack. With 0 failing links and a fresh run the owner sees no button, so the live owner-signed-in view is unverified. No hardware check of the drawer.
- **Graphify and floorplan:** not refreshed for this work. The main checkout holds another session's uncommitted changes, so `graphify update .` and the floorplan refresh and build wait.
- **Manual TV status:** signed-in picker interaction, status-change News event, and a hosted sync that first preserves then replaces an override are not browser or live-database verified.
- **Discover after deployment:** successful hosted `tv-spinoffs` cache refresh and owner-signed-in checks of TV franchise cards, None of these/Undo, reset, menu focus return, Seen-it rating offer, dislikes, taste line, ordering and Wildcards. Browser-to-proxy IDs still travel in a GET URL; ~900 seeds is the practical ceiling; spin-off anchors remain order-dependent.
- **Ratings:** the owner has not decided the rating queue's series rule, hidden-title exclusion, or whether skips persist across browsers (`REHAUL_PLAN.md` Discover item 2). Hosted ratings had 0 rows on 2026-11-24.
- **Finance Try-again narrow gap:** a write reading its supabase-js session before fetch, or between steps of a two-step save, may be missed for a few milliseconds.
- **Browser checks:** episode score chips, season `avg` headers, Finished tab, rating queue, Transactions sheet, Favourites refresh and Language unknown, Select typeahead guard, route error screen, stale-chunk reload. Transactions shortcut guards have no hook tests; three InspectorSheet copies remain.
- **Hardware checks:** Transactions sheet and checkbox/switch targets on iPhone/iPad (including soft keyboard), Travel map touch preview on iPad, dot-matrix numbers on a phone, Links drawer. Existing width checks used browser emulation; the investment import table used a synthetic table.
- **Other:** hosted finance payday schedule (`monthly_date`, day 29) and Revolut TrueLayer consent renewal remain unverified; one earlier flaky Vitest run had 2 failures that did not reproduce and whose names were not captured. Floorplan has 4 existing warnings, 1 unassigned file, and pending `architecture.json` globs / `describe.mjs`.

## Next
1. Check the first scheduled run after 2026-11-27 04:40 UTC: `link_checks.checked_at` moves and `net._http_response` shows 200.
2. Confirm the hosted Wikidata `tv-spinoffs` cache refreshed after the function deployment; if stale, run the cache pass.
3. Owner-signed-in checks of the manual series-status picker, Discover, rating queue, Favourites, Transactions UI, and the live Links view.
4. Owner's call on the rating queue choices; then the device checks above.

## Blockers
- Owner-specific checks need the owner's signed-in browser session.
- None on hosted access: the connector worked on 2026-11-26 (deploy, migration, queries).
