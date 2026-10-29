# State

**Updated:** 2026-10-29 · **Branch:** `main` · **Deployed code:** `0c9da548` (pushed, Pages deploy in flight)
**Hosted/local schema last recorded:** `20261027220000` · **Hosted Postgres:** 17.11.0.003 · **Local:** 15

## Committed and pushed to main

- `0c9da548`: Take-home pay by tax band and reconciliation updates. Slices view (`TakeHomeSlices.tsx`) with threshold partitioning in `uk-tax-calculator.ts` (`ukTakeHomeBySlice`), shared `formatWholeGBP`, `taxInput` from `calculateFinance`, mounted on Tax & Income and Tax Calculator surfaces.
- Integrated concurrent session work: employer logo precedence (`employer-logo.ts`/test, `PayslipsSection.tsx`), debt dialog/movements (`DebtFormDialog.tsx`, `LoanMovements.tsx`, `useDebtMutations.ts`), student loans (`student-loan.ts`/test, `StudentLoanSurface.tsx`), holiday counts and maximiser improvements (`holidays.ts`/test, `TaxIncomeSurface.tsx`), `useResume.ts`, `deno.lock`.
- `90a0fcb5`: Closed out STATE.md recording landed commits.

## Leave maximiser & accessibility polish

- Pruned dead code: removed positional `planOptimalHolidays` overload, `OptimalLeavePlan` type alias, and `calculateBirthdayBenefitValue` (+ redundant tests). Cleaned up unused `_taxConfigs` and `_asOfDate` parameters from `calculateFinance`.
- Settings dialog accessibility: added `htmlFor` and matching `id` attributes for `ukRegion`, `taxYear`, `pensionType`, and `studentLoanPlan` form controls. Converted labels to sentence case.
- Maximiser UX and copy: replaced unicode calendar emoji with SVG icon, formatted strategy bias switch and booking buttons to sentence case, added screen-reader text for birthday emojis.
- Documentation: cleaned up `FEATURES.md` holiday tracker entry with matched tier names and paragraphs; deleted finished items from `REHAUL_PLAN.md`.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Lint / typecheck / tests on current tree | 2026-10-29 | Pass; lint 0/0, 1,737 tests / 61 files |
| typecheck:functions / build / ship-check | 2026-10-29 | Pass; ship-check 98/100 Beta, 0 blockers |
| Graph | 2026-10-29 | graphify update: 2,928 nodes / 6,704 edges |
| Reviewer (Opus) | 2026-10-29 | Pass: 0 findings |

## Next

1. Verify deployed take-home by tax band card in browser (light/dark themes, 375px mobile viewport).
2. Verify deployed birthday-count behaviour after sign-in; signed-in live verification remains open.
3. Option 2 / Plan 8.H: categorisation review queue, category rules ("Merchant X is always Y"), and subscription audit.
4. Tax engine follow-ups: additional tax years, student-loan threshold source, Settings band fields.
5. Owner enrols authenticator; verify hosted auth and post-upgrade cron/edge/pg_net execution.
6. Books: 45 covers, 97 descriptions, 14 ambiguous entries; progress/series/ISBN/statistics remain planned.
7. Local Postgres 15→17 reset; continue plan security items, schema rebuild from empty, and Node 24 CI.

## Blockers and open risks

- Take-home by tax band not yet verified live in browser (visual/responsive layout).
- Signed-in live writes (leave, Paid/untick/early payment, uploads/CV/links), Safari/Firefox/phones, 375px/200% zoom, real HEIC and non-UK dates unchecked.
- Local settings/holiday rows hold prior fixtures; local thresholds differ from hosted.
- Authenticator flows local-only; post-upgrade cron/edge, signed-in TrueLayer/logo-cache, IPv6 /64, finance races and hosted read measurements open.
- Per-row saves retained by decision; external-image privacy, Watchlist cron CPU and sync-race verification open.
- Unmerged admin assistant remains outside this release; remaining work is in REHAUL_PLAN.md.
