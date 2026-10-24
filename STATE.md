# State

**Updated:** 2026-10-24 · **Branch:** `claude/friendly-feynman-phs5om` · **Head:** `55c2341` (main, PR #6 merged) · **Deployed code:** `55c2341`

## In progress

Admin check once per statement. LOCAL ONLY, UNCOMMITTED, NOT PUSHED; awaiting owner OK to commit. Policies called `public.is_admin()` bare, so it ran per row. They now use `(SELECT public.is_admin())`, which runs once per statement.

- Migrations `20261024120000_rls_admin_check_once_per_query` (88 public policies) and `20261024130000_storage_rls_admin_check_once_per_query` (14 `storage.objects` policies). Each refuses to run unless every targeted policy reads exactly as expected, and post-checks the result.
- Also uncommitted: 83 policies in `supabase/schemas/`, `src/integrations/supabase/rls-admin-check.test.ts`, SECURITY.md, `performance/README.md`, two raw JSON files in `performance/`.
- Applied to the LOCAL stack only; verified from empty with `supabase db reset`. HOSTED IS UNCHANGED: its migrations end at `20261013100000`; the read-only check on 2026-10-24 found 88 public and 14 storage bare policies.
- Local evidence: finance 5,000-row read median 1,051 → 276 ms (control drifted up to ~20% between runs). Storage: anon and non-admin denied all six operations on `finance-documents`; admin allowed all six.
- The trade-off feared beforehand (a call paid when no row reaches the policy) did not reproduce: EXPLAIN ANALYZE shows the InitPlan never executed.
- Prerequisite `fix/readiness-followups` was never pushed; its public-schema part was rebuilt here with owner OK.

## Deployed

- `55c2341` (PR #6, paged-read benchmark): [Pages run 40083861946](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40083861946) succeeded, checked 2026-10-24 with `gh run list`. Live site not checked.
- Parser override 7.1.7 at `9f13ce77` via [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5): [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded, verified 2026-10-24; both CSS outputs matched the 6.1.4 baseline.
- Earlier: `8f6078e8` / `1395077f` cleanup and dependency releases; `799d8358` EDC toolbar.
- Migration `20261013100000_inventory_wishlist_not_edc` is LIVE on hosted: zero conflicts, validated constraint; local rollback tests pass. Live Inventory on 2026-10-20 showed 13 EDC items, brands and no wishlist item.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint / typecheck (`src`) | 2026-10-24 | Pass on this branch, local: lint 0 errors / 0 warnings; typecheck passes |
| Tests / build | 2026-10-24 | Pass on this branch, local: 52 files / 1,006 tests; build passes |
| Review | 2026-10-24 | `reviewer` ran over the diff; findings addressed; not re-run after fixes |
| `typecheck:functions` | — | NOT run: no functions changed; Deno not installed here |
| ship-check (before this branch) | 2026-10-24 | 96/100 Beta; 10 findings, 2 high (potential N+1, Zod); password-literal finding cleared. NOT run this session |
| graphify | — | NOT refreshed: not installed; no `graphify-out/` in tree |
| Audit / ship-check (before this branch) | 2026-10-23 | 98/100 Beta, 9 findings; audit 0 then, superseded by new Zod advisory |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded/rejected |

## Next

1. Owner OK: commit on `claude/friendly-feynman-phs5om`, open PR, verify CI.
2. Owner's call: push both migrations to hosted together. Re-run the read-only count first (expect public 93 admin-gated / 88 bare, storage 14 bare); the guards refuse otherwise. Push with no admin session open; lock contention fails closed and rolls back. `ALTER POLICY` on `storage.objects` is untested on hosted. Afterwards, re-run the access check and benchmark there, and drop the "local only" wording from SECURITY.md and `performance/README.md`.
3. Still open, unverified: Zod 3.25.76 advisory GHSA-mrhx-c7xc-m3w5 (patched >=4.6.6); measure excluded Watchlist/finance paths and production; verify live writes, devices and true 200% zoom; resume REHAUL_PLAN (Library contained scrolling unbuilt).

## Blockers / open risks

- Admin-check migrations are unpushed and unapplied to hosted; hosted behaviour is unverified.
- The finance read still grows faster than row count after the change (276 ms at 5,000 rows vs 5 × 22 ms at 1,000, local); the benchmark does not isolate the rest.
- Schema drift, not fixed: six finance tables have `CREATE TABLE` only in migrations, not `supabase/schemas/` (two are referenced there in a query and a comment): finance_debt_observations, finance_investment_activities, finance_investment_holdings, finance_merchant_logos, finance_payslips, finance_payslip_transaction_reconciliations.
- New Zod advisory remains open; the October 23 audit result is not current assurance.
- Remaining scanner findings and Watchlist per-season/per-favourite reads remain unresolved.
- Parser major-version override is validated for this project's install/tests/CSS, not future changes.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open; no unrelated finance fixes ship here.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
