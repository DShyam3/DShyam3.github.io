# State

Updated 2026-11-25. `main` at `993d935a`, pushed to GitHub Pages (run `45637596757`: success). Hosted Supabase (`yvtiybyuifkiwyrnjebe`) has the per-episode score migrations and `watchlist-cron-sync` v34 live.

## Closed
- **Touch checkbox and switch size** (`d8f5600c`). Checkbox and Switch keep their drawn size under the coarse-pointer and Larger-mode grow rules; an invisible `::after` (`ui-hit-area`) takes the 2.75rem target, and a table row holding one grows to it. Transactions' "Select all on page" is a label. Live: rules in `index-B_5oCd6l.css`, class in `checkbox-IdPcNMmF.js`, label in `TransactionsTab-Bh4i3vdS.js`.
- **Finance error screen** (`fb52e71f`). FinanceHostBoundary renders the shared `ErrorScreen`, not AppShell, so a second throw cannot blank the site; load and render failures are told apart there and in FinanceSectionBoundary; the error title takes focus. Live: copy in `index-McXLNhnT.js` and `FinancePage-ClGVZOXy.js`.
- **Per-episode IMDb & TMDB ratings** (`4a44c99a`, another session). Migrations `20261124204936_watchlist_episode_scores` and `20261124211553_watchlist_season_omdb_rpc` applied on hosted; `watchlist-cron-sync` v34 deployed. TMDB (`1,080/1,082` regular seasons) and OMDb (`1,079/1,079` eligible seasons) backfills finished after the `2026-11-25 06:00–06:20Z` cron (`sync_log` `455–457`, all `success`).
- **Watchlist Finished tab** (`8d5c32f1`, another session). `/watchlist/finished` with `LibraryFiltersPopover.tsx` and the `/watchlist` shelf cleanup.
- **Rate what you've watched queue** (`e05e3049`), **Transaction details sheet** (`d5bc2ac2`), **Diary plan correction** (`5dccda52`). Live since `379caacc`.
- **Wikidata nightly cache**, verified live: the `2026-11-24 06:20:38Z` cron filled `tv-spinoffs` (58 links from 434 seeds) and `film-universes` (45 films).

## Last checks (2026-11-25, `993d935a` before push)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` & `npm run typecheck:functions` | pass |
| `npx vitest run` | 134 files / 3,090 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `npm run test:functions` | not rerun (57 Deno tests passed on `4a44c99a`) |
| `npm run ship-check` | not run (2026-11-24: 90/100; its launch blocker is an airport-code string matching the AWS-key pattern, checked and harmless) |

Reviewer (Opus) on the two fixes: no bugs; its risks fixed except the Finance "Try again" race below.

## Still open / not verified
- **Touch fixes, not on hardware.** Verified on the local stack at 375px with touch emulation and on desktop. The investment import table's targets were checked on a synthetic table, not the real dialog with a file.
- **Finance "Try again" race (pre-existing, from review).** After a render failure, Try again mounts a fresh FinanceDataProvider whose first read waits only on its own empty save queue, so it can read before the previous provider's last save lands; timed-out-save guards reset. Unlikely at human speed; a module-level in-flight save set would close it.
- **Noticed at 375px under coarse pointer, not from these fixes.** Transactions toolbar buttons (Rules, Filter, Sort) overflow their text; a "Name says transfer" pill in the transfer review card wraps into a near-circle.
- **Browser checks of new UI, signed in on live Pages:** episode score chips, season `avg` headers, Finished tab, rating queue, Transactions sheet. Hardware: Transactions on iPhone/iPad (soft keyboard over the sheet), Travel map touch preview on iPad, dot-matrix numbers on a phone.
- **Rate queue owner choices:** series rule, hidden titles excluded, skips per browser (`REHAUL_PLAN.md` Discover item 2). Hosted `watchlist_ratings` had 0 rows on 2026-11-24.
- **Owner-signed-in Watchlist checks:** Favourites `Refresh favourite details` and `Language unknown`; Discover steps 1–3, dislikes, taste line, order since `48bdbdcf`; Seen it's rating offer; Wildcards. Reviewer fixes on these not re-reviewed.
- **Transactions sheet leftovers:** Select typeahead guard not exercised in a browser; no hook tests for the shortcut guards; three InspectorSheet copies (WorkspaceInspector, CashFlowSurface, TransactionsTab).
- **Platform checks:** route error screen and stale-chunk reload not seen on live Pages.
- **Local Supabase stack** at `20261123135113`, without `20261124204936` or `20261124211553`; older stacks may carry `20261122221500` (`supabase db reset`, or `supabase migration repair --local --status reverted 20261122221500`).
- **Smaller unverified items:** hosted `finance_settings` payday schedule (`monthly_date`, day `29`); Revolut TrueLayer consent renewal when convenient.
- **Flaky test:** one earlier vitest run had 2 failures that did not reproduce; names not captured.
- **graphify and floorplan:** refreshed 2026-11-25 in the main checkout at `993d935a` (graphify update; floorplan refresh, recent work, build). Floorplan: 4 warnings, 1 file outside every node; `architecture.json` globs and `describe.mjs` not done.

## Next
1. Owner's signed-in checks on live Pages: the new Watchlist UI, the rating queue, the Transactions sheet, Discover (`REHAUL_PLAN.md` items 1–2), Favourites.
2. Owner's call on the rating queue's three choices.
3. Device checks: Transactions and touch checkboxes on iPhone and iPad, Travel map on iPad, dot-matrix numbers on a phone.

## Blockers
- Owner-specific checks require the owner's signed-in browser session.
