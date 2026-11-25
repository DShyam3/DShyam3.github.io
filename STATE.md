# State

Updated 2026-11-25. `main` at `3c43a5fe` on GitHub Pages. The Transactions toolbar and transfer card overflow fixes and the Finance Try-again fix are shipped: three commits pushed to `main` on 2026-11-25 (`f62c2d84`, `6d8757fe`, `3c43a5fe`), Pages run `45695746333` succeeded. Hosted Supabase (`yvtiybyuifkiwyrnjebe`) has the per-episode score migrations and `watchlist-cron-sync` v34 live.

## Closed
- **Transactions toolbar and transfer card overflow, Finance Try-again race** (`f62c2d84`, `6d8757fe`, `3c43a5fe`). Toolbar wraps and its icon-only and short-label buttons have accessible names (`TransactionsTab.tsx`, "Import a statement"); transfer review cards wrap their buttons below the text on narrow cards (`TransferReviewSection.tsx`). Finance "Try again" waits for in-flight writes: module-level save queue and timed-out-save guard in `FinanceDataContext.tsx`; `src/integrations/supabase/write-tracking-fetch.ts` (+ `.test.ts`) counts in-flight table writes with a 100 ms quiet window; `FinanceSession.tsx` waits on it. Live: `grow basis-60` and `ml-auto ... flex-wrap` in the TransactionsTab chunk, the `finance_` write wait in the entry chunk, the write tracker in the client chunk. Browser-emulated at 320 and 375 (touch), 768, 1024, 1280, 1440 on the local stack.
- **Touch checkbox and switch size** (`d8f5600c`). Checkbox and Switch keep their drawn size under the coarse-pointer and Larger-mode grow rules; an invisible `::after` (`ui-hit-area`) takes the 2.75rem target, and a table row holding one grows to it. Transactions' "Select all on page" is a label. Live: rules in `index-B_5oCd6l.css`, class in `checkbox-IdPcNMmF.js`, label in `TransactionsTab-Bh4i3vdS.js`.
- **Finance error screen** (`fb52e71f`). FinanceHostBoundary renders the shared `ErrorScreen`, not AppShell, so a second throw cannot blank the site; load and render failures are told apart there and in FinanceSectionBoundary; the error title takes focus. Live: copy in `index-McXLNhnT.js` and `FinancePage-ClGVZOXy.js`.
- **Per-episode IMDb & TMDB ratings** (`4a44c99a`, another session). Migrations `20261124204936_watchlist_episode_scores` and `20261124211553_watchlist_season_omdb_rpc` applied on hosted; `watchlist-cron-sync` v34 deployed. TMDB (`1,080/1,082` regular seasons) and OMDb (`1,079/1,079` eligible seasons) backfills finished after the `2026-11-25 06:00–06:20Z` cron (`sync_log` `455–457`, all `success`).
- **Watchlist Finished tab** (`8d5c32f1`, another session). `/watchlist/finished` with `LibraryFiltersPopover.tsx` and the `/watchlist` shelf cleanup.
- **Rate what you've watched queue** (`e05e3049`), **Transaction details sheet** (`d5bc2ac2`), **Diary plan correction** (`5dccda52`). Live since `379caacc`.
- **Wikidata nightly cache**, verified live: the `2026-11-24 06:20:38Z` cron filled `tv-spinoffs` (58 links from 434 seeds) and `film-universes` (45 films).

## Last checks (2026-11-25, pushed tree at `3c43a5fe`, identical to the checked tree)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` & `npm run typecheck:functions` | pass |
| `npx vitest run` | 135 files / 3,095 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `npm run test:functions` | not rerun (57 Deno tests passed on `4a44c99a`) |
| `npm run ship-check` | not run (2026-11-24: 90/100; its launch blocker is an airport-code string matching the AWS-key pattern, checked and harmless) |

Maps refreshed in the main checkout at `3c43a5fe`: `graphify update .`, floorplan refresh, recent-work entry, floorplan build.

## Still open / not verified
- **Try-again gap (narrow, open, unverified).** A Finance write still reading its supabase-js session before it reaches fetch, pressed at that instant, is not counted, so Try again does not wait for it. The gap between the two steps of a two-step save (e.g. a debt reading then its balance) is also not counted. Window: a few milliseconds.
- **Overflow and Try-again fixes: not on real phone hardware.** Verified in browser emulation only (320–1440px, coarse pointer at phone widths).
- **Touch fixes, not on hardware.** Verified on the local stack at 375px with touch emulation and on desktop. The investment import table's targets were checked on a synthetic table, not the real dialog with a file.
- **Browser checks of new UI, signed in on live Pages:** episode score chips, season `avg` headers, Finished tab, rating queue, Transactions sheet. Hardware: Transactions on iPhone/iPad (soft keyboard over the sheet), Travel map touch preview on iPad, dot-matrix numbers on a phone.
- **Rate queue owner choices:** series rule, hidden titles excluded, skips per browser (`REHAUL_PLAN.md` Discover item 2). Hosted `watchlist_ratings` had 0 rows on 2026-11-24.
- **Owner-signed-in Watchlist checks:** Favourites `Refresh favourite details` and `Language unknown`; Discover steps 1–3, dislikes, taste line, order since `48bdbdcf`; Seen it's rating offer; Wildcards. Reviewer fixes on these not re-reviewed.
- **Transactions sheet leftovers:** Select typeahead guard not exercised in a browser; no hook tests for the shortcut guards; three InspectorSheet copies (WorkspaceInspector, CashFlowSurface, TransactionsTab).
- **Platform checks:** route error screen and stale-chunk reload not seen on live Pages.
- **Local Supabase stack** at `20261123135113`, without `20261124204936` or `20261124211553`; older stacks may carry `20261122221500` (`supabase db reset`, or `supabase migration repair --local --status reverted 20261122221500`).
- **Smaller unverified items:** hosted `finance_settings` payday schedule (`monthly_date`, day `29`); Revolut TrueLayer consent renewal when convenient.
- **Flaky test:** one earlier vitest run had 2 failures that did not reproduce; names not captured.
- **Floorplan:** 4 warnings, 1 file outside every node; `architecture.json` globs and `describe.mjs` not done.

## Next
1. Owner's signed-in checks on live Pages: the new Watchlist UI, the rating queue, the Transactions sheet, Discover (`REHAUL_PLAN.md` items 1–2), Favourites.
2. Owner's call on the rating queue's three choices.
3. Device checks: Transactions and touch checkboxes on iPhone and iPad, Travel map on iPad, dot-matrix numbers on a phone.

## Blockers
- Owner-specific checks require the owner's signed-in browser session.
