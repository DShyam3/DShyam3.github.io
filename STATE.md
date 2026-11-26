# State

Updated 2026-11-26. `main` tracks `origin/main` with the portable App Suite architecture, dot-matrix polish, Watchlist Franchises/Cool facts revamp, daily dead-link check (`1467d995`–`c85eca7f`), overlapping custom franchises (`e3619d09`), and Likely seen paging fix (`fb9fac0a`) all committed and pushed.

## Closed
- **Payslip modal figure reveal, duplicate detection, and benefit deductions (local, uncommitted):** Added an in-card **Show figures / Hide figures** toggle (`useHiddenFigures.ts`, `index.css`, `PayslipsSection.tsx`, `PayslipImportDialog.tsx`) so imported figures can be inspected while the background page stays hidden; added `findDuplicatePayslip` (`payslip.ts`) to warn and disable saving in Add Payslip and default duplicates unticked in bulk import; and extended `payslip-parse.ts` to sum named employee benefit/sacrifice deductions into `otherDeductions` and `lines` (excluding notional P11D/BIK, employer-paid benefits, and cash allowances). Lint, typecheck, 138 payslip/hidden-figures tests, build, and `impeccable detect src/` pass.
- **Discover section dropdown:** Added a persisted `Discover section` dropdown (`All sections`, `Coming soon`, `Have you already watched?`, `You might like`) in `WatchlistNews.tsx` and `DiscoverySection.tsx`, paired with the `All` / `Films` / `Series` filter so each section can be focused and browsed by media type. Lint, typecheck, build, and `impeccable detect src/` pass.
- **Portable App Suite architecture & dot-matrix polish:** Canonical registry in `src/apps/` (`manifests.ts`, `portable.tsx`, `routes.tsx`, `useActiveApp.ts`, `_template/`) drives routing, sidebar/mobile App Switcher (unified list, Watchlist last), `CommandDock`, `Header` (owner identity + `+` social links on left, active app coloured badge + title on right, desktop sidebar toggle), `?standalone=1|0` query support, and restored dot-matrix digits (`DotMatrixText`, `DotMatrixClock`) and 9×9 sun/moon `ThemeToggle` (`DotMatrixIcon`).
- **Watchlist Franchises & Cool facts revamp:** Revamped `/watchlist/franchises` and `/watchlist/facts` alongside `tmdb-proxy` v28 (`120`/min general + `60`/min `:details` bucket, deployed to hosted Supabase) and `dev/api-status.ts` updates; added `placeholderData: keepPreviousData` to `tvSpinoffs` in `useDiscovery.ts` and `WatchlistFranchises.tsx`, an in-card **Stopped watching / Resume watching** toggle (`EntryList`, `useAddToLibrary`, `franchise.ts`), and a **Stopped watching** status filter on `/watchlist/franchises`.
- **Daily dead-link check** (`1467d995`, `7c35d266`, `274e3bef`, `6b16f6a6`): `link_checks` table + daily `links-check` pg_cron (`40 4 * * *`) + owner Links UI. Hosted migration (`20261126123059`), RLS, and manual run (HTTP 200, 7 checked, 0 failed) verified.
- **Overlapping Library Franchises (`e3619d09`) & hosted Supabase (`yvtiybyuifkiwyrnjebe`):** Both migrations (`watchlist_additional_franchises`, `watchlist_franchise_membership_rpc`) applied on local and hosted. `tv-spinoffs` cache refreshed by the `2026-11-26 06:20 UTC` cron (`118` links, Star Wars `23`); `watchlist-cron-sync` v36 deployed from `main`.
- **Discover TV franchises, Likely seen (`83c6bf9e`, `fb9fac0a`), manual TV series status & rating timestamps:** Live on Pages (`Star Wars Universe` verified signed-out; `None of these` + `Undo` verified). See `FEATURES.md`.
- **Likely seen reads deeper and in the library's language (`ce2d689b` draft, reviewed fixes `a3710a80`, Pages `45899898989` success):** the pool walks TMDB's top 1,000 (top pages taking turns with pages 16–50) and, for its first 3 pages, the most-voted titles (100-vote floor) in the library's strongest non-English language (films `hi`, series `ja`). Languages are fixed at the first page; the pool waits for ratings; walk share 26. Checked signed out on live Pages, All tab: calls carry `vote_count.gte=100`, pool walks p15→p45→p1→p46; 12 tiles once deep pages land, but only after ~75s, because the owner's 21:35–21:40 UTC answers (Not interested on 45 `ja` series, 27 `hi` films, 54 English Likely seen titles) emptied the first page. Meanwhile the section reads "No incomplete series, spin-offs or likely seen titles found". Franchise cards were also gone on these loads, consistent with 35 franchise TV Not interested answers (21:17–21:37); not traced further.

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
1. Likely seen follow-up (owner's call): let Not interested answers turn a language pool off (the language pick reads the library only, so `ja`/`hi` pages still load after they were turned down), and don't show the empty message while pool pages are still coming.
2. Check the first scheduled `links-check` run after 2026-11-27 04:40 UTC.
3. Run owner-signed-in checks across the live deployed site (App Suite chrome, Watchlist Franchises/Cool facts, manual TV status picker, Discover, rating queue, Transactions).
4. Decide rating-queue choices, then complete real-device hardware checks.

## Blockers
- Owner-specific browser and real-device checks require the owner's signed-in session and hardware.
