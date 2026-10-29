# State

**Updated:** 2026-10-29 · **Branch:** `main` at `0c9da548` (= origin/main) · **Deployed code:** `0c9da548` (pushed, Pages deploy in flight)
**Hosted/local schema last recorded:** `20261027220000` · **Hosted Postgres:** 17.11.0.003 · **Local:** 15

## Committed and pushed to main

- `0c9da548`: Take-home pay by tax band and reconciliation updates. Slices view (`TakeHomeSlices.tsx`) with threshold partitioning in `uk-tax-calculator.ts` (`ukTakeHomeBySlice`), shared `formatWholeGBP`, `taxInput` from `calculateFinance`, mounted on Tax & Income and Tax Calculator surfaces.
- Integrated concurrent session work: employer logo precedence (`employer-logo.ts`/test, `PayslipsSection.tsx`), debt dialog/movements (`DebtFormDialog.tsx`, `LoanMovements.tsx`, `useDebtMutations.ts`), student loans (`student-loan.ts`/test, `StudentLoanSurface.tsx`), holiday counts and maximiser improvements (`holidays.ts`/test, `TaxIncomeSurface.tsx`), `useResume.ts`, `deno.lock`.
- Verification green: lint (0/0), typecheck, typecheck:functions, 1,738 tests / 61 files passing, Vite build green.

## Deployed and live evidence

- Deployed birthday fix: PR #12 merged and Pages 40834582020 succeeded October 29. Attach/detach and inline toggle adjust custom counts.
- Shared tax engine/typed benefits 038bfe80 deployed. Birthday guards 27ca4669 and schema 20261027220000 recorded hosted/local.
- Take-home by tax band (0c9da548) pushed to main; GitHub Pages build in-flight. Light/dark themes and 375px phone layout NOT checked in live browser.
- Finance verification blocked: Chrome session expired and redirects home; password field is empty. User sign-in required for live writes.
- Books PR #10 deployed; admin unchanged-field Save and Open Library lookup verified Oct 27.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Lint / typecheck / tests on current tree | 2026-10-29 | Pass; lint 0/0, 1,738 tests / 61 files |
| typecheck:functions / build | 2026-10-29 | Pass |
| Graph | 2026-10-28 | graphify update: 2,925 nodes / 6,697 edges |
| Review | 2026-10-29 | Pass for take-home slices and reconciliation diff |

## Next

1. Verify deployed take-home by tax band card in browser (light/dark themes, 375px mobile viewport).
2. Verify deployed birthday-count behaviour after sign-in; signed-in live verification remains open.
3. Plan 8.H: sick-day handling/dedupe, standalone birthday maximiser recommendation, Settings labels, copy accessibility.
4. Tax engine follow-ups: additional tax years, student-loan threshold source, Settings band fields; clean up unused calculateFinance parameters.
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
