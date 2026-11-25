# State

Updated 2026-11-25. `main` pushed with `watchlist_ratings.rated_at`, `tv_shows.tmdb_status`, Discover TV franchises, Likely seen "None of these", reset confirmation, and dialog focus return. Hosted Supabase (`yvtiybyuifkiwyrnjebe`) and local Supabase both have `watchlist_ratings_rated_at` and `watchlist_tmdb_status_baseline` applied; `tmdb-proxy` and `watchlist-cron-sync` are deployed.

## Closed
- **Rating timestamps (`watchlist_ratings.rated_at`)** (DB migration `20261125210500_watchlist_ratings_rated_at.sql` applied on hosted and local; pushed to `main`). Added `rated_at` (`DEFAULT now() NOT NULL`, backfilled from `updated_at`) to `watchlist_ratings` in `supabase/schemas/20_watchlist.sql`; `WatchlistContext.tsx` omits `rated_at` on upsert so first ratings stamp `now()` and later edits preserve it; `import_watch_history`, `trakt-import.ts`, and `import-match.ts` carry Trakt's `rated_at`.
- **Discover TV franchises, Likely seen "None of these", reset confirmation, dialog focus return, `tv_shows.tmdb_status` baseline** (pushed to `main`; `tmdb-proxy` and `watchlist-cron-sync` deployed; `20261125210855_watchlist_tmdb_status_baseline.sql` applied on hosted and local; Wikidata `tv-spinoffs` cache row will refresh on the next cron or manual run). TV franchises also read each show's media franchise (`P8345`); siblings come from `P8345` and `P179` in two parallel best-effort queries; seed cap 1,000; the cron keeps its old row when franchise queries fail; client keys bumped to `v3` (`useDiscovery.ts`, `WatchlistFranchises.tsx`, `useTMDB.ts`). Measured live: 117 links, Star Wars group 23 series, MCU TV 8. Likely seen's "None of these" marks its shown tiles `Not seen` and offers Undo (`useNotSeen.ts`, `DiscoverySection.tsx`). "Reset Discover answers…" asks first. `useDeleteConfirm` returns focus to its opener, its menu trigger, or a fallback. Decisions in `REHAUL_HISTORY.md` (2026-11-25).
- **Transactions toolbar and transfer card overflow, Finance Try-again race** (`f62c2d84`, `6d8757fe`, `3c43a5fe`). Toolbar wraps and its icon-only and short-label buttons have accessible names (`TransactionsTab.tsx`, "Import a statement"); transfer review cards wrap their buttons below the text on narrow cards (`TransferReviewSection.tsx`). Finance "Try again" waits for in-flight writes: module-level save queue and timed-out-save guard in `FinanceDataContext.tsx`; `src/integrations/supabase/write-tracking-fetch.ts` (+ `.test.ts`) counts in-flight table writes with a 100 ms quiet window; `FinanceSession.tsx` waits on it. Live: `grow basis-60` and `ml-auto ... flex-wrap` in the TransactionsTab chunk, the `finance_` write wait in the entry chunk, the write tracker in the client chunk. Browser-emulated at 320 and 375 (touch), 768, 1024, 1280, 1440 on the local stack.
- **Touch checkbox and switch size** (`d8f5600c`). Checkbox and Switch keep their drawn size under the coarse-pointer and Larger-mode grow rules; an invisible `::after` (`ui-hit-area`) takes the 2.75rem target, and a table row holding one grows to it. Transactions' "Select all on page" is a label. Live: rules in `index-B_5oCd6l.css`, class in `checkbox-IdPcNMmF.js`, label in `TransactionsTab-Bh4i3vdS.js`.
- **Finance error screen** (`fb52e71f`). FinanceHostBoundary renders the shared `ErrorScreen`, not AppShell, so a second throw cannot blank the site; load and render failures are told apart there and in FinanceSectionBoundary; the error title takes focus. Live: copy in `index-McXLNhnT.js` and `FinancePage-ClGVZOXy.js`.
- **Per-episode IMDb & TMDB ratings** (`4a44c99a`, another session). Migrations `20261124204936_watchlist_episode_scores` and `20261124211553_watchlist_season_omdb_rpc` applied on hosted; `watchlist-cron-sync` v34 deployed. TMDB (`1,080/1,082` regular seasons) and OMDb (`1,079/1,079` eligible seasons) backfills finished after the `2026-11-25 06:00–06:20Z` cron (`sync_log` `455–457`, all `success`).
- **Watchlist Finished tab** (`8d5c32f1`, another session). `/watchlist/finished` with `LibraryFiltersPopover.tsx` and the `/watchlist` shelf cleanup.
- **Rate what you've watched queue** (`e05e3049`), **Transaction details sheet** (`d5bc2ac2`), **Diary plan correction** (`5dccda52`). Live since `379caacc`.
- **Wikidata nightly cache**, verified live: the `2026-11-24 06:20:38Z` cron filled `tv-spinoffs` (58 links from 434 seeds) and `film-universes` (45 films). The `tv-spinoffs` row is replaced only when the Discover franchise work above ships.

## Last checks (2026-11-25, uncommitted tree)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` (3 targeted files: `trakt-import`, `import-match`, `rls-admin-check`) | 3 files / 34 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `npm run ship-check` | not run (2026-11-24: 90/100; its launch blocker is an airport-code string matching the AWS-key pattern, checked and harmless) |

Maps refreshed in the main checkout at `3c43a5fe`: `graphify update .`, floorplan refresh, recent-work entry, floorplan build.

## Still open / not verified
- **Discover franchises, not shipped.** Not seen in a browser: "None of these" and Undo (Likely seen reads the hosted `tmdb-proxy`, which allows CORS only from the live origin). Menu-item focus return is not browser-checked (owner-only menus). The reset dialog is checked on localhost only (Escape returns focus to the trigger; confirm clears and focuses the footer). Known limits: browser-to-proxy ids still travel in a GET URL; about 900 seeds is the practical ceiling; anchors from spin-off links stay order-dependent (grouping unaffected).
- **Try-again gap (narrow, open, unverified).** A Finance write still reading its supabase-js session before it reaches fetch, pressed at that instant, is not counted, so Try again does not wait for it. The gap between the two steps of a two-step save (e.g. a debt reading then its balance) is also not counted. Window: a few milliseconds.
- **Overflow and Try-again fixes: not on real phone hardware.** Verified in browser emulation only (320–1440px, coarse pointer at phone widths).
- **Touch fixes, not on hardware.** Verified on the local stack at 375px with touch emulation and on desktop. The investment import table's targets were checked on a synthetic table, not the real dialog with a file.
- **Browser checks of new UI, signed in on live Pages:** episode score chips, season `avg` headers, Finished tab, rating queue, Transactions sheet. Hardware: Transactions on iPhone/iPad (soft keyboard over the sheet), Travel map touch preview on iPad, dot-matrix numbers on a phone.
- **Rate queue owner choices:** series rule, hidden titles excluded, skips per browser (`REHAUL_PLAN.md` Discover item 2). Hosted `watchlist_ratings` had 0 rows on 2026-11-24.
- **Owner-signed-in Watchlist checks:** Favourites `Refresh favourite details` and `Language unknown`; Discover steps 1–3, dislikes, taste line, order since `48bdbdcf`; Seen it's rating offer; Wildcards. Reviewer fixes on these not re-reviewed.
- **Transactions sheet leftovers:** Select typeahead guard not exercised in a browser; no hook tests for the shortcut guards; three InspectorSheet copies (WorkspaceInspector, CashFlowSurface, TransactionsTab).
- **Platform checks:** route error screen and stale-chunk reload not seen on live Pages.
- **Local Supabase stack** at `20261124211553` (all migrations applied, including `20261124204936` and `20261124211553`).
- **Smaller unverified items:** hosted `finance_settings` payday schedule (`monthly_date`, day `29`); Revolut TrueLayer consent renewal when convenient.
- **Flaky test:** one earlier vitest run had 2 failures that did not reproduce; names not captured.
- **Floorplan:** 4 warnings, 1 file outside every node; `architecture.json` globs and `describe.mjs` not done.

## Next
1. Owner's go-ahead to ship the Discover franchise work, in this order: deploy `tmdb-proxy` and `watchlist-cron-sync`; re-run the cron's Wikidata pass or delete the `tv-spinoffs` row in `watchlist_wikidata_cache`; commit and push to `main`. Pushing first would let browsers keep the old cached answer under the `v3` key.
2. Owner's signed-in checks on live Pages: the new Watchlist UI, the rating queue, the Transactions sheet, Discover (`REHAUL_PLAN.md` items 1–2), Favourites.
3. Owner's call on the rating queue's three choices.
4. Device checks: Transactions and touch checkboxes on iPhone and iPad, Travel map on iPad, dot-matrix numbers on a phone.

## Blockers
- Owner-specific checks require the owner's signed-in browser session.
- The Discover franchise work is not shipped until the cron has re-run after deploy (Next 1).
