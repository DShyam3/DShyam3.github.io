# State

Updated 2026-11-26. `main` tracks `origin/main` with the portable App Suite architecture, dot-matrix polish, Watchlist Franchises/Cool facts revamp, daily dead-link check (`1467d995`–`c85eca7f`), overlapping custom franchises (`e3619d09`), and Likely seen paging fix (`fb9fac0a`) all committed and pushed.

## Closed
- **Portable App Suite architecture & dot-matrix polish:** Canonical registry in `src/apps/` (`manifests.ts`, `portable.tsx`, `routes.tsx`, `useActiveApp.ts`, `_template/`) drives routing, sidebar/mobile App Switcher (unified list, Watchlist last), `CommandDock`, `Header` (owner identity + `+` social links on left, active app coloured badge + title on right, desktop sidebar toggle), `?standalone=1|0` query support, and restored dot-matrix digits (`DotMatrixText`, `DotMatrixClock`) and 9×9 sun/moon `ThemeToggle` (`DotMatrixIcon`).
- **Watchlist Franchises & Cool facts revamp:** Revamped `/watchlist/franchises` and `/watchlist/facts` alongside `tmdb-proxy` v28 (`120`/min general + `60`/min `:details` bucket, deployed to hosted Supabase) and `dev/api-status.ts` updates; added `placeholderData: keepPreviousData` to `tvSpinoffs` in `useDiscovery.ts` and `WatchlistFranchises.tsx`, an in-card **Stopped watching / Resume watching** toggle (`EntryList`, `useAddToLibrary`, `franchise.ts`), and a **Stopped watching** status filter on `/watchlist/franchises`.
- **Daily dead-link check** (`1467d995`, `7c35d266`, `274e3bef`, `6b16f6a6`): `link_checks` table + daily `links-check` pg_cron (`40 4 * * *`) + owner Links UI. Hosted migration (`20261126123059`), RLS, and manual run (HTTP 200, 7 checked, 0 failed) verified.
- **Overlapping Library Franchises (`e3619d09`) & hosted Supabase (`yvtiybyuifkiwyrnjebe`):** Both migrations (`watchlist_additional_franchises`, `watchlist_franchise_membership_rpc`) applied on local and hosted. `tv-spinoffs` cache refreshed by the `2026-11-26 06:20 UTC` cron (`118` links, Star Wars `23`); `watchlist-cron-sync` v36 deployed from `main`.
- **Discover TV franchises, Likely seen (`83c6bf9e`, `fb9fac0a`), manual TV series status & rating timestamps:** Live on Pages (`Star Wars Universe` verified signed-out; `None of these` + `Undo` verified). See `FEATURES.md`.
- **Likely seen reads deeper and in the library's language:** the widely watched pool now walks TMDB's top 1,000 (top pages taking turns with pages 16–50) and, for its first 3 pages, the most-voted titles in the library's strongest non-English language (films `hi`, series `ja` today). A first draft went live inside `ce2d689b` (Pages `45898494030` success); checked signed out on live Pages, All tab: 12 tiles (was 5), 7 of them language picks. The reviewed fixes are **local and uncommitted** (`discovery.ts`, `discovery.test.ts`, `useDiscovery.ts`, excluding another session's `keepPreviousData` hunks): languages fixed at the first page instead of keyed, pool waits for ratings, 100-vote floor on language titles, walk share 28→26 so the 16-call first page in All goes at once. Lint, typecheck, 3,136 tests, build, impeccable pass.

## Last checks (2026-11-26)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass |
| App Suite Vitest (`manifests`, `DisplayModeContext`, `route-meta`, `RouteErrorBoundary`) | 4 files, 15/15 pass |
| Prior rebased suite (`6b16f6a6`): `npx vitest run` / `npm run test:functions` | 136 files, 3,115 pass / 87 pass |
| `impeccable detect src/` / `npm run ship-check` | 0 anti-patterns (1 pre-existing advisory) / 90/100 (airport-code false positive) |

## Still open / not verified
- **Dead-link check:** First scheduled run (after 2026-11-27 04:40 UTC) and live owner-signed-in view when failing/stalled links exist; hardware drawer check.
- **App Suite & Watchlist Franchises/Cool facts:** Owner-signed-in checks of `/watchlist/franchises`, `/watchlist/facts`, franchise membership edits, and real-device iPhone/iPad checks of the App Suite chrome.
- **Manual TV status & Discover:** Owner-signed-in picker, status-change News event, live sync override/takeover, and signed-in Discover checks (`watchlist_not_seen` sync, reset dialog, menu focus return, Wildcards).
- **Ratings & Finance:** Owner call pending on rating queue choices (`REHAUL_PLAN.md` Discover #2); Finance Try-again narrow gap, hosted payday schedule (`monthly_date`, day 29), and Revolut TrueLayer consent renewal unverified.
- **Hardware & tooling:** iPhone/iPad checks (Transactions sheet + soft keyboard, checkbox/switch targets, Travel touch preview, dot-matrix numbers, Links drawer); refresh `graphify` and `floorplan` after pushing the rebased tree.

## Next
1. Push the reviewed Likely seen fixes (commit only those hunks), then re-check Likely seen live; decide whether language picks should take fewer than every other tile.
2. Check the first scheduled `links-check` run after 2026-11-27 04:40 UTC.
3. Run owner-signed-in checks across the live deployed site (App Suite chrome, Watchlist Franchises/Cool facts, manual TV status picker, Discover, rating queue, Transactions).
4. Decide rating-queue choices, then complete real-device hardware checks.

## Blockers
- Owner-specific browser and real-device checks require the owner's signed-in session and hardware.
