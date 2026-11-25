# State

Updated 2026-11-25. `main` tracks `origin/main`; this handoff and the status picker's focus-ring polish are in the current tree. Commit `83c6bf9e` contains rating timestamps, Discover TV franchise and Likely seen changes, and the manual TV series-status picker and sync baseline. The previous handoff reports both new migrations applied on local and hosted Supabase and `tmdb-proxy` / `watchlist-cron-sync` deployed; hosted state could not be independently queried in this turn.

## Closed
- **Manual TV series status** (`83c6bf9e`): the admin can choose Returning series, In production, Ended or Canceled in a show's details. `tv_shows.tmdb_status` remembers the last TMDB status; an unchanged TMDB value preserves the manual choice, and a changed value takes over. Migration `20261125210855_watchlist_tmdb_status_baseline.sql` backfills the baseline. Behaviour is unit tested; owner-signed-in UI and a live sync have not been checked.
- **Rating timestamps** (`83c6bf9e`): `watchlist_ratings.rated_at` records the initial rating date; edits preserve it, and Trakt imports carry their rated dates. Migration `20261125210500_watchlist_ratings_rated_at.sql` is reported applied on local and hosted.
- **Discover TV franchises, Likely seen “None of these”, reset confirmation, dialog focus return** (`83c6bf9e`): TV franchises include Wikidata `P8345` and `P179` siblings; failed franchise queries leave the old cache row. Likely seen can mark its page Not seen with Undo, reset asks first, and confirmations restore focus. The hosted `tv-spinoffs` cache still needs a successful refresh after function deployment; the previous handoff measured 117 links against Wikidata, not the refreshed hosted cache.
- **Transactions overflow and Finance Try again** (`f62c2d84`, `6d8757fe`, `3c43a5fe`), touch checkbox sizing (`d8f5600c`), Finance error screen (`fb52e71f`), episode scores (`4a44c99a`), Finished tab (`8d5c32f1`), rating queue (`e05e3049`) and Transactions details sheet (`d5bc2ac2`) remain in the tree. See FEATURES.md for current behaviour.

## Last checks (2026-11-25, working tree including focus-ring polish)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run test:functions` | 60 pass |
| `npx vitest run src/features/watchlist/library-state.test.ts` | 25 pass |
| `npm run build` | pass |
| local `impeccable detect src/` | 0 anti-patterns; regex scan only |
| npx Impeccable source scan | unavailable: npm registry DNS failure |
| `npm run ship-check` | 90/100; airport-code string flagged as AWS key, previously checked harmless; Semgrep skipped |
| `graphify update .`; floorplan refresh and build | pass; floorplan retains 4 warnings, 1 unassigned file |

## Still open / not verified
- **Manual TV status:** signed-in picker interaction, status-change News event, and a hosted sync that first preserves then replaces an override are not browser or live-database verified.
- **Discover after deployment:** successful hosted `tv-spinoffs` cache refresh and owner-signed-in checks of TV franchise cards, None of these/Undo, reset, menu focus return, Seen-it rating offer, dislikes, taste line, ordering and Wildcards. Browser-to-proxy IDs still travel in a GET URL; ~900 seeds is the practical ceiling; spin-off anchors remain order-dependent.
- **Ratings:** the owner has not decided the rating queue's series rule, hidden-title exclusion, or whether skips persist across browsers (`REHAUL_PLAN.md` Discover item 2). Hosted ratings had 0 rows on 2026-11-24.
- **Finance Try-again narrow gap:** a write reading its supabase-js session before fetch, or between steps of a two-step save, may be missed for a few milliseconds.
- **Browser checks:** episode score chips, season `avg` headers, Finished tab, rating queue, Transactions sheet, Favourites refresh and Language unknown, Select typeahead guard, route error screen, stale-chunk reload. Transactions shortcut guards have no hook tests; three InspectorSheet copies remain.
- **Hardware checks:** Transactions sheet and checkbox/switch targets on iPhone/iPad (including soft keyboard), Travel map touch preview on iPad, dot-matrix numbers on a phone. Existing width checks used browser emulation; the investment import table used a synthetic table.
- **Other:** hosted finance payday schedule (`monthly_date`, day 29) and Revolut TrueLayer consent renewal remain unverified; one earlier flaky Vitest run had 2 failures that did not reproduce and whose names were not captured. Floorplan has 4 existing warnings, 1 unassigned file, and pending `architecture.json` globs / `describe.mjs`.

## Next
1. Confirm the hosted Wikidata `tv-spinoffs` cache refreshed after the function deployment; if stale, run the cache pass.
2. Owner-signed-in checks of the manual series-status picker and Discover, rating queue, Favourites, and Transactions UI.
3. Owner's call on the rating queue choices; then the device checks above.

## Blockers
- Owner-specific checks need the owner's signed-in browser session.
- Hosted Supabase verification was denied by the connector in this turn, so migration and function deployment are carried as reported, not newly verified.
