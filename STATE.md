# State

Updated 2026-11-19 · `main` at `0763a04b` + uncommitted local H3 hex map and dot-matrix UI chrome work. Travel double-flash (`37bae8a9`, `0763a04b`) and Finance tab/Home latency (`194093c2`, `22998cc7`) fixes are pushed and user-verified live. Payslip code `d5120557` and row-logo change `234eeba2` were pushed; migration `20261119150000_payslip_reimbursement_links.sql` is recorded as applied on `yvtiybyuifkiwyrnjebe`. Signed-in browser verification of payslip/reimbursement UI, live Pages deployment of About layout fix (`76a56f9a`), and browser check of the dot-matrix UI chrome remain open.

## Dot-matrix UI chrome (uncommitted, local)

- Added `size="ui"` (`15px` desktop / `14px` mobile, weight `600`, `"RNDM" 0`) to `DotMatrixText` (`DotMatrixText.tsx`, `DotMatrixText.css`, `src/index.css`) and switched `.readout-label` to `Doto` across the app.
- Applied `DotMatrixText size="ui"` to stationary chrome: `WorkspaceRail.tsx` (section numbers/labels, `Display`, `Layout`, `Search`), `Header.tsx` (`Search`), `CommandDock.tsx` (dock trigger + palette section rows), `NavMenu.tsx` (`Display size`), `TravelPage.tsx` (view/import/backup buttons), `CollectionPage.tsx` (section badge), `WatchlistNav.tsx`, and `FinancePage.tsx` (`Show/Hide figures`). Keycaps (`⌘K`), currency/figures, and record/body text remain `Space Mono`.
- `npm run lint` (0 errors, 0 warnings), `npm run build`, and `graphify update .` pass; `npm run typecheck` passed on all modified files, failing only on 4 pre-existing errors in `DotMatrixGlobe.tsx:690-711`. Browser verification remains open.

## Travel H3 hexagon map (uncommitted, local)

- Replaced the 360×180 dot grid in `DotMatrixGlobe.tsx` with a single-tier H3 res-3 hexagon map (`hexMapData.ts` + `h3-js@4.5.0` + `scripts/generate-hex-map.py`):
  - **`public/data/hex-world-map-r3.json` (303 KB):** 12,390 H3 res-3 cells across 234 countries/territories, with small-island centroid seeding and overseas territories (`YT`, `RE`, `GF`, `GP`, `MQ`, `SJ`, `BQ`) split out from parent Natural Earth polygons so they show their own names and visited status.
  - Uses 16×8 spatial-bucket viewport culling in 2D, color-batched `Path2D` fills, inlined zero-allocation 3D rotation math, and city `(lat, lon)` hex snapping in `TravelPage.tsx` / `hexMapData.ts`.
- `npm run lint` (0 errors, 0 warnings), `npm run typecheck`, `npm run build`, and `graphify update .` passed; browser check of the single-tier res-3 build and `npm run test` (Vitest) remain open.

## About wide-screen layout fix

- Pushed: decoupled `.home-constellation-canvas` from layout height (`position: absolute; inset: 0` inside `.home-constellation-stage` with `flex: 1 0 clamp(13.5rem, 30vh, 22rem)`) and added a `ResizeObserver` in `SemanticConstellation.tsx`, stopping the canvas's 2:1 intrinsic ratio from inflating the hero row on wide screens while keeping the hero generously proportioned.
- Pushed: kept `.about-workspace` full-width inside `.app-frame` to match the rest of the site, changed `.home-hero-card` to `justify-content: center`, capped `.home-hero-lead` at `max-width: 60ch`, and added an `@container (min-width: 115rem)` rule on `.home-overview-scroll` so `.fact-grid` lays out 6 cards in one row on ultrawide displays and drops back to 3×2 when the right inspector opens.
- Browser-verified locally at `2560×1080` (full-width `2222px` workspace, hero `431.6px` tall, all 6 fact cards in one row above the fold; drops cleanly to 3×2 with inspector open) and `1440×900` (signed-out; pre-existing minor mobile truncation/clipping in the constellation header/label, footer clock, and horizontal tab bar noted earlier). Live Pages deployment unverified.

## Payslip work

- Pushed: payslip history uses a full-width ledger within each group. The group heading shows totals; rows show the complete employer and gross with take-home and labelled status. The clicked detail dialog remains as before.
- Pushed: a matched employer logo appears beside the employer in tax-year and calendar-year rows. Employer groups continue showing the logo in the heading.
- The reimbursement table migration is recorded on the linked site project. When its table fetch succeeds, a payslip can record a reimbursement payment line manually; matching suggests penny-exact prior spending within 120 days, with explicit confirmation. Confirmed expenses appear in the transaction ledger; stale links need review. Browser behavior remains unverified.
- Future leave years explain that bank holidays follow ordinary UK rules and can change for exceptional holidays or new rules.
- Other edits and untracked drafts may be present in the shared checkout; do not attribute them to this work without checking their diff.

## Checks (2026-11-19, local tree)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | 4 pre-existing errors in `DotMatrixGlobe.tsx:690-711` |
| `npm run typecheck:functions` | pass (prior run) |
| `npm run test` (Vitest) | 109 files, 2,818 tests pass (prior run) |
| `npm run build` | pass |
| `graphify update .` | pass after dot-matrix UI chrome edits |
| `npm run ship-check` | command passed; scan verdict **Do not launch yet** (93/100, one reported critical finding later inspected as a false positive; Semgrep skipped) |
| Browser and database migration | browser not verified; linked remote migration history shows `20261119150000` applied (table access/RLS not yet checked) |

## Earlier landed work

- `feat/watching-mid-season` narrowed Watching to series mid-season or current as episodes air; signed-out live-data preview was checked. Signed-in shelves remain unverified.
- Travel double-flash (`37bae8a9`, `0763a04b`: module-cached globe projections & country list, removed delayed `animate-in`) and Finance re-entry/tab/Home latency (`194093c2`, `22998cc7`: `FinanceTargetContext` decoupling `FinanceDataProvider`, memoized derived ledger/totals, paginated Home review queue without Framer Motion `layout` thrashing) are landed on `main` and user-verified live. Watchlist News cards were aligned and Pages build/deploy artifact race was addressed.
- Discover “Seen it” now asks when; the affected ~54 films were set to “date unknown” on 2026-11-18.
- Watchlist Discover, News, Franchises, Library, Diary and Import changes, TitleScores/TMDB score, staged warmup, public IndexedDB cache and deduplicated Supabase calls were recorded as landed previously. Browser checks remain open.
- OMDb first pass completed on 2026-11-19: films 1,064/1,070 checked (1,008 IMDb ratings); series 393/395 checked (354 IMDb ratings; 3 RT ratings).

## Next

1. Verify reimbursement table access and RLS on the linked site project, then browser-check payslip layout and logos at desktop and phone widths, manual reimbursement entry, suggestion/confirmation/unlink, stale links, and the ledger marker. Test a future leave year such as 2049.
2. Browser-verify Discover “Seen it” dating; signed-in Watching/To watch shelves; Watchlist ↔ Finance switching and internal tabs; IndexedDB cache hydration and privacy boundary; TitleScores/TMDB badges; Discover, News, Franchises, Library; Travel signed URLs; countdown pill; light mode and phone viewport.
3. Check the first weekly OMDb refresh around 2026-11-25 in `sync_log` (roughly 900 titles at up to 300 per part).
4. Carry forward the other ship-check findings rather than treating an exit code of zero as launch approval. The reported AWS key in `airport-countries.data.ts:226` was inspected and is a false positive inside a static encoded airport-country lookup string.

## Still unverified and blockers

- No browser verification of the pushed payslip/reimbursement/holiday or row-logo work. New PDF imports still capture summary figures, not reimbursement line items; enter those lines manually for matching.
- The linked site project’s migration history shows `20261119150000` applied; table access/RLS and signed-in UI behavior remain unverified. An unrelated Supabase connector project reported `INACTIVE`, which caused the earlier mistaken blocker.
- The 2026-11-19 finance sync reported “Revolut: bank access needs renewing; reconnect this bank”. Not yet reconnected.
- Prior browser work remains open for staged warmup, Watchlist flows, signed-in admin flows, show creator/cast dialog and the items in Next.
- Carried forward without re-checking: untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`), `.claude/launch.json` with stale `caught-up-worktree` entry, and `.claude/worktrees/affectionate-lamarr-f2d2cb` (owner unknown).
