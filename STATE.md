# State

**Updated:** 2026-10-29 · **Branch:** `codex/finish-finance-work` at `fb3013c6` (= origin/main), uncommitted · **Deployed code:** `7baaed66`
**Hosted/local schema last recorded:** `20261027220000` · **Hosted Postgres:** 17.11.0.003 · **Local:** 15

## Deployed birthday fix

[PR #12](https://github.com/DShyam3/DShyam3.github.io/pull/12) merged and [Pages 40834582020](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40834582020) succeeded October 29. Attach/detach and the inline toggle adjust custom counts by the actual 0.5/1 birthday day, refusing invalid/insufficient counts.
Birthday deletion restores the first regular covering holiday; half-day badges use count. Review passes after the inline half-day correction; no schema change.

## Uncommitted on codex/finish-finance-work

- Take-home by tax band — LOCAL ONLY, NOT COMMITTED, NOT DEPLOYED. `ukTakeHomeBySlice` in `src/lib/finance/uk-tax-calculator.ts` (+ tests),
  `taxInput` returned from `calculateFinance`, shared `formatWholeGBP`, new `src/features/finance/components/TakeHomeSlices.tsx` mounted on
  Tax & Income and Tax Calculator. Reviewer (Opus): 0 blockers, 0 warnings. A Codex session then changed slice `kept`/`keptRate` to the signed
  change in cash take-home (negative on pension/BIK rows; slices now sum to `rawTakeHome`) and updated the card; not separately reviewed.
- Same tree holds other sessions' unreviewed work: employer logos (`employer-logo.ts`/test, `PayslipsSection.tsx`), debt (`DebtFormDialog.tsx`,
  `LoanMovements.tsx`, `useDebtMutations.ts`), student loan (`student-loan.ts`/test, `StudentLoanSurface.tsx`), holidays (`holidays.ts`/test, parts of
  `TaxIncomeSurface.tsx`), `useResume.ts`, `deno.lock`. Backup stash `finance-reconciliation-backup-2026-10-29` exists. Four files left unmerged by
  the stash re-apply were marked resolved (no conflict markers present). Preserve all of it.

## Deployed and live evidence

- Shared tax engine/typed benefits `038bfe80` deployed (Pages `40589284379` succeeds). Birthday guards `27ca4669` and schema `20261027220000`
  are recorded hosted/local, with all four constraints validated. Newer shared-engine/holiday behaviour is not verified live.
- Calculator PR #11 merged `2fe8ff56`; Pages `40542898572` succeeded Oct 27. Live synthetic England £110k: tax £33,432, NI £4,210.60,
  take-home £72,357.40, marginal 62%; Scotland £70k tax £17,382.05. Hero screenshot verified at 720px. 375px phone layout NOT checked.
- Current Finance verification is blocked: Chrome session expired and redirects home; password field is empty.
  User was asked to sign in; no response yet. No new live write verified.
- Books PR #10 deployed; admin unchanged-field Save and Open Library lookup verified Oct 27.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Lint / typecheck / tests on current tree | 2026-10-29 | Pass; lint 0/0, 1,738 tests / 61 files |
| typecheck:functions / build / ship-check (before Codex's kept change) | 2026-10-28 | Pass; ship-check 98/100 Beta, 0 blockers |
| Graph | 2026-10-28 | graphify update: 2,925 nodes / 6,697 edges |
| Review | 2026-10-28 | Pass after inline half-day correction |
| Earlier local shared-engine browser | 2026-10-27 | Scotland £60k gives £39,112 take-home on both pages; benefits and year browsing pass locally |

## Next

1. Decide how to split and commit the uncommitted tree (take-home by tax band vs the other sessions' work); review Codex's signed `kept` change; check the card in a browser (light/dark, 375px). Nothing here is live.
2. Verify deployed birthday-count behaviour after sign-in; signed-in live verification remains open.
3. Verify deployed shared engine, typed benefits and holiday controls; local checks are not live checks.
4. Plan 8.H: sick-day handling/dedupe, standalone birthday maximiser recommendation, Settings labels, copy accessibility, dead code and outdated long holiday-tracker description remain.
5. Tax engine follow-ups: additional tax years, student-loan threshold source and Settings band fields; unused calculateFinance parameters remain a review nit. Borrowed/Edit consolidation remains open.
6. Owner enrols authenticator; verify hosted auth and post-upgrade cron/edge/pg_net execution.
7. Books: 45 covers, 97 descriptions, 14 ambiguous entries; progress/series/ISBN/statistics remain planned.
8. Owner decides local Postgres 15→17 reset and deletes unused VITE_TMDB_BASE_URL Actions secret. Continue plan security items, schema rebuild from empty and Node 24 CI.

## Blockers and open risks

- Take-home by tax band not checked in a browser; not committed or deployed.
- Signed-in live writes (leave, Paid/untick/early payment, uploads/CV/links), Safari/Firefox/phones, 375px/200% zoom, real HEIC and non-UK dates unchecked.
- Local settings/holiday rows hold prior fixtures; local thresholds differ from hosted.
- Authenticator flows local-only; post-upgrade cron/edge, signed-in TrueLayer/logo-cache, IPv6 /64, finance races and hosted read measurements open.
- Per-row saves retained by decision; external-image privacy, Watchlist cron CPU and sync-race verification open.
- Parser override validated for this install/tests/CSS only; CI Node 20/Ubuntu transition unchecked.
- Unmerged admin assistant remains outside this release; remaining work is in REHAUL_PLAN.md.
