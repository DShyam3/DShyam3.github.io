# State

Updated: 2026-11-04 · Branch: `main` · HEAD `3394e2e9`, pushed and deployed (Pages run `41800729607`, success); `merchant-logo-cache` edge function deployed as v16.
Working tree: uncommitted, including other sessions' edits (see Blockers). Production check so far: anonymous home only. Everything else is verified locally only.

## In progress (uncommitted, this tree)

- **Finance data kept for the admin's session.** Closed as a decision (REHAUL_HISTORY.md, 2026-11-03). `FinanceSession.tsx` mounts `FinanceDataProvider` on idle from any page, or at once on /finance, and drops it on sign-out. `refreshIfStale(60s)` runs on Finance mount. Error boundary with retry. FEATURES.md updated. Reviewed by `reviewer` (Opus): 1 bug and 4 risks, all fixed; save safety and sign-out found clean. Committed on `main` 2026-11-04, **not pushed or deployed**.
- **Owner reports it tested signed in as admin (2026-11-04).** Not exercised by automation: the failure boundary (needs a failed chunk load) and the Watchlist edit write-back as admin.
- Verified anonymous on production preview: /finance deep link and client-side nav redirect to /; no finance chunks or finance reads; no console errors.

## Completed locally (uncommitted; not shipped)

- **Money hub planning:** [MONEY_HUB_BLUEPRINT.md](MONEY_HUB_BLUEPRINT.md) and its `REHAUL_PLAN.md` pointer are written. No implementation; all phases, sources/licensing and maintenance decisions remain open. FEATURES/history unchanged by this planning task.

- Payslips student loan line compares the year's deductions with what each payslip's own pay owes (was a false −£594.90 shortfall; now £777.00 against £781.00). Code: `studentLoanExpectedInTaxYear` in `payslip.ts`, `studentLoanPayslipDeduction` in `student-loan.ts`. Checked on the local stack with real payslips, then removed.

## Pushed 2026-11-03 (`a7c892c7..a420bc81`, rebased onto #13)

- Prior handoff reports Tax Calculator (`c12d8751`, `a420bc81`; 322 tax tests), Student Loan (`579b7866`), Holiday (`a4af67fd`, `29ed4d85`), Recurring (`a6b16406`), Home avatars (`f16e7a7f`), warm-up/cache (`f93d13e2`), dev ports (`dec67110`), Cash Flow restyle (`3fc1180d`) pushed. Signed-in production verification remains open.
- Keep `backup/pre-rebase-2026-11-03` until production is checked.
- `3394e2e9` (pushed 2026-11-04) merchant logos: a cached row whose domain disagrees with its hint is purged and re-resolved (hosted cache had `co-op` from co-opbank.co.ke, `costa` from costa.pl, `b-q` from bebitalia.com, `lidl` from lidl.cz); 25 UK chains added to the directory and the function's copy; leading `www` dropped by both normalisers. Clean-worktree checks: lint 0/0, typecheck, 2,146 tests, typecheck:functions, build. Function v16 deployed with `verify_jwt` on. **Not yet run:** the cache refreshes only on an admin bank sync; until then the four wrong logos and the new brands are unchanged.
- Demo-profile Cash Flow reads backwards (Rent and ISA feeding "Spending" into "Income"): labels come from `lib/finance/cash-flow`, likely the Demo rows' signs. Not investigated.

## Checks (prior evidence carried forward; not rerun for this docs task)

| Check | Date | Tree / result |
|---|---|---|
| Prior finance-session tree | 2026-11-03 | lint 0/0; build pass; 2,153 tests across 63 files pass; typecheck:functions pass; typecheck FAILS (other session's Tax Calculator work) |
| Previously checked `dec67110` | 2026-11-03 | Clean worktree: lint 0/0; typecheck passes on each of the 7 commits; 2,127 tests pass; typecheck:functions pass; build pass |
| Payslip student loan line (local, uncommitted) | 2026-11-03 | lint 0/0; vitest over `src/lib` and `src/features`: 2,130 pass. `npm run typecheck`: 2 errors, both in other sessions' files (`TakeHomeShareChart.tsx`, `TaxCalculatorSurface.tsx`); none in this item's files. Not recorded as green. Browser: local stack only |
| Ship-check | 2026-11-03 | Pre-rebase tree, not run on this tree: 96/100, Beta only, 0 blockers, 1 high (possible N+1 in `FinanceDataContext.tsx`, present since 2026-10-30) |
| Browser, local `dev:test` | 2026-11-03 | Home monograms and logos render; sign-in then sign-out, no new console errors. Watched-episode fix NOT browser-tested (no shows locally) |
| Production | 2026-11-03 | Anonymous home: no console errors, 30 REST reads. Nothing signed-in checked |
| Money hub docs | 2026-11-03 | Main thread reports blueprint/plan diff whitespace, local links, fences and backlink checks pass. STATE diff whitespace passes. No npm checks or graphify run: documentation only. |

## Next

1. Push the finance-session commit, then confirm Pages deploys it. Owner, signed in as admin: Watchlist edits across leave-and-return. Press Sync Banks once on production so `merchant-logo-cache` v16 replaces the wrong-brand logos and fetches the new chains; then check `finance_merchant_logos` (expect `co-op=coop.co.uk`, `costa=costa.co.uk`, `b-q=diy.com`, `lidl=lidl.co.uk`).
2. Signed-in checks: Tax Calculator (light theme too), Student Loan figures, holiday booking, recurring undismiss, Home logos with real Brandfetch icons, watched-episode toggle across leave-and-return, sign-out, Cash Flow Sankey.
3. Owner: other branches are unmerged and untouched: `claude/affectionate-lamarr-f2d2cb` (12 commits), `codex/assistant-integration-2026-11-02` (13), `origin/claude/net-take-home-tax-f2n71j` (3, possibly superseded by #13).
4. Owner: switch the hosted pension type from net pay to salary sacrifice in Tax & Income, then record SLC's next balance and use "Checking SLC's figures" on the pending top-up. Holiday LEFT charges a cross-year booking's whole count to its start year (split rule needed).
5. Owner, unverified: payroll takes about £64.13 a month more income tax than a 1257L code gives, which behaves like ~1064L (about £1,925 a year less allowance). Likely a split allowance from the June job change, a benefit, or an underpayment being collected. Check the code on the payslip or in the HMRC app.
6. Finish signed-in live flows, cross-theme/device checks, save/reload races and schema reproducibility; feature work stays in `REHAUL_PLAN.md`.
7. Money hub: review blueprint Phase 0 — audience/placement, comparison basket, sources/licensing, maintenance ownership and tax years. Implementation is not authorised by this planning task.

## Blockers

- **Parallel sessions, one tree.** The owner runs several sessions on this checkout. Agree one committer before any commit. The tree holds other sessions' uncommitted Tax Calculator, payslip, student-loan, DebtFormDialog, TakeHomeSlices and finance-calcs edits. Prior typecheck is red in Tax Calculator files; whether another session has fixed it is not reverified.

## Open risks

- Warm-up: every anonymous view sends about 30 reads, including the full watchlist library (about 7,600 episodes); payload unmeasured; Save-Data exists only in Chromium.
- Watchlist: an edit made during a background re-read of a stale library is overwritten when the read lands; a failed first read is cached as an empty library.
- Recurring: "Show as suggestion again" deletes the row without confirming, losing edits on a once-active bill; the toast can be wrong if detection no longer qualifies it.
- `MerchantAvatar` uses an arbitrary `rounded-[0.5rem]`; the resolver lookup is duplicated in `DashboardSurface` and `TransactionsTab`.
- Carried: four reference tables delete then insert; category edits during sync; stalled token refresh; schemas-only rebuild lacks composite-key objects; hosted sync, JWT config, `SITE_ORIGIN`, headers, cron/Edge/pg_net and HEIC uploads unverified; advisor warnings (`is_admin` callable by anon/authenticated, leaked-password protection off).
- Student Loan approximation: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay.
- Local only: `supabase/seed.sql` (~line 127) has the 2026/27 Plan 2 threshold at 28,470 vs 29,385 hosted; a local test profile's `personal_pension_percent` was set to 5.
- Keep stash `finance-reconciliation-backup-2026-10-29` until its backup is no longer needed.
