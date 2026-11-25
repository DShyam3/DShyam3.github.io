# State

Updated 2026-11-25. Branch `discover-dislikes` at `5dccda52`, equal to `origin/main` (pushed; Pages run `45521434245` succeeded). The main checkout holds another session's uncommitted work (Watchlist, Supabase, Dev, launch-config, FEATURES.md, REHAUL_HISTORY.md, STATE.md, public/sitemap.xml, src/App.tsx); none of it is claimed as shipped here.

## Closed (pushed)
- **Rate what you've watched queue** (`e05e3049`). Deployed; live entry bundle `/assets/index-BeCvStVW.js` has the title and the skips key. Unit tests and local stack only.
- **Transaction details sheet** (`d5bc2ac2`). Deployed; live `TransactionsTab-L37w0g3K.js` has "Close transaction details" and `(min-width: 1024px)`.
- **Diary plan correction** (`5dccda52`). Deploy order, Public ratings and OMDb key removed as done; hosted state checked 2026-11-24.
- **Readable numbers in dot-matrix UI** (`df5a4cfb`). Numeric runs use Space Mono in shared `DotMatrixText` labels, command-menu counts, travel headings, footer clock, Home fact counts.
- **Discover dislikes count** (`8d8ca5fc`, migration `20261123135113` on hosted). Decision in `REHAUL_HISTORY.md` (2026-11-23).
- **Discover steps 1–3** (`ec6881fa`, `fc16742f`, `fbe288dd`; via `00527d91`). Migrations `20261122192738`, `20261122201711` on hosted.
- **Travel map touch preview** (`666dd03a`, another session). First tap previews, second tap or `Open` opens the drawer.
- **Wildcards** (`12e24973`, Pages run `45474511099`) and **Seen it offers the rating** (`e030d81d`, run `45482255622`). Deployed; see open notes.

## Checks
| Check | Result (2026-11-25, rebased tree, before push) |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 133 files / 3,077 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns (run before the rebase) |
| `npm run typecheck:functions` | not run on this push (passed 2026-11-24 on the dot-matrix tree) |
| `npm run ship-check` | not run on this push (2026-11-24: 90/100, launch blocker, see open notes) |

## Still open / not verified
- **Rate queue, not seen live as owner.** Verified on the local stack only; reviewer fixes not re-reviewed. Series path not exercised in a browser (unit tests only).
- **Rate queue, owner's three choices** await the owner (REHAUL_PLAN Discover item 2): series rule, hidden titles excluded, skips per browser. Hosted: 0 rows in `watchlist_ratings` (382 watched films, 434 series) as of 2026-11-24.
- **Transactions sheet, not seen live or checked as owner.** Verified on the local stack only; reviewer fixes not re-reviewed. Not on iPhone or iPad hardware (soft keyboard over the sheet's inputs). Select typeahead guard not exercised in a browser. No hook tests for the shortcut guards (no DOM test environment). One shared InspectorSheet not built (three copies: WorkspaceInspector, CashFlowSurface, TransactionsTab).
- **Transactions, noticed, not from this change:** at 375px under coarse pointer each row's checkbox renders as a large empty square.
- **Seen it offers the rating:** not seen live as the owner; reviewer fixes not re-reviewed.
- **Wildcards:** live bundle checked; not seen in an owner-signed-in browser; reviewer fixes not re-reviewed.
- **Discover, owner's signed-in check** of steps 1–3, dislikes and taste line is outstanding. Discover order on the owner's data not checked since `48bdbdcf`.
- **Travel map touch preview:** needs an iPad check (first/second tap, `Open` target, ocean tap clears, trackpad hover).
- **Dot-matrix numbers:** not seen on the live site or a real phone or tablet. Other direct Doto labels may still hold numbers; the final command-menu and itinerary edits passed static checks only.
- **Route error screen on Pages:** live, not seen triggered there.
- **Stale-chunk reload on Pages:** checked locally only; needs an old tab observed across a deploy.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) renders AppShell in its fallback; can throw again if Finance fails while a Watchlist detail is docked. Pre-existing, not fixed.
- **impeccable on running `/watchlist`:** 3 reported on the signed-out Following panel (header blinking cursor, 2 nested cards). Not from these changes.
- **ship-check (2026-11-24):** launch blocker for a generated airport-code string matching the AWS-key pattern; the line was checked and holds airport codes. Other findings not reviewed.
- **Local Supabase stack** at `20261123135113`; other stacks may still carry `20261122221500`. Fix with `supabase db reset` or `supabase migration repair --local --status reverted 20261122221500`. Current uncommitted migration not applied or verified here.
- **Hosted `finance_settings` payday schedule** (`monthly_date`, day `29`) not verified here.
- **Flaky test:** one earlier vitest run had 2 failures that did not reproduce; names not captured; cause unexplained.
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`) not verified.
- **Revolut bank consent** in TrueLayer needs renewal when convenient.
- **Separate Watchlist, Supabase, Dev, launch-config edits** remain uncommitted in the main checkout; in progress, not shipped or verified.
- **graphify and floorplan** not run after this push: the main checkout's uncommitted changes block fast-forward. (The 2026-11-24 graphify and floorplan pass retains warnings and unmapped files from other work.)

## Next
1. Owner's signed-in checks on the live site: REHAUL_PLAN Discover item 1, including the Seen it rating offer, the rating queue, and the Transactions pass.
2. Owner's call on the rating queue's three choices (REHAUL_PLAN Discover item 2).
3. Run `graphify update .` and the floorplan refresh once the main checkout can fast-forward.
4. Finish and verify the separate Watchlist and Supabase edits before shipping them.
5. Check dot-matrix numbers on a real device and after deploy; Travel map on iPad; Transactions on iPhone and iPad.

## Blockers
- Owner-specific checks need the owner's signed-in session; no agent can perform them.
- The main checkout's uncommitted work blocks fast-forward and the graphify and floorplan refresh.
