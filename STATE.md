# State

**Updated:** 2026-10-24 · **Branch:** `claude/compassionate-faraday-6b9xwn` (from main `55c2341`) · **Head:** grants commit on `55c2341` · **Deployed code:** `9f13ce77`

## In progress

Least-privilege table grants: verified LOCAL only. Committed and pushed on this branch, no PR yet; NOT applied to hosted.
Migration `supabase/migrations/20261024150000_authenticated_grants_least_privilege.sql` plus matching
edits to 14 `supabase/schemas/*.sql` files. `authenticated` drops from ALL to SELECT, INSERT, UPDATE,
DELETE on 49 public tables (TRUNCATE, REFERENCES, TRIGGER revoked). `postgres` defaults give new tables
the same four verbs for `authenticated`, and SELECT only for `anon`.
Local stack (Supabase CLI 2.120.0, 2026-10-24): only the 49 changed; TRUNCATE refused on all 49 as
`authenticated` (allowed before); 196/196 CRUD privilege probes, PostgREST admin reads/writes and
full `db reset` pass; post-check raises on 6 injected bad states. Read-only dry run of the post-check
against hosted: no offenders, no global default-ACL row.

## Deployed

- Parser override 7.1.7: [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5) at `9f13ce77`; [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded, verified 2026-10-24. Earlier: `8f6078e8`, `1395077f`, EDC `799d8358`.
- Paged-read benchmark: [PR #6](https://github.com/DShyam3/DShyam3.github.io/pull/6) merged at `55c2341`; reads only, no app query change. Pages/CI result UNVERIFIED. Results: `performance/README.md`.
- Migration `20261013100000_inventory_wishlist_not_edc` is LIVE (zero conflicts, validated constraint). Live Inventory 2026-10-20: 13 EDC items, brands, no wishlist item.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint / typecheck (`src`) | 2026-10-24 | 0 errors, 0 warnings; typecheck passes |
| Tests / build | 2026-10-24 | 51 files / 1,001 tests pass; build passes; graph NOT refreshed (graphify not installed here) |
| Typecheck (`typecheck:functions`) | 2026-10-24 | NOT RUN: esm.sh and deno.land blocked by container network policy; no functions changed |
| Local grants, `20261024150000` | 2026-10-24 | Pass on local stack only; hosted untouched |
| Review (Opus) | 2026-10-24 | No bugs; open items below |
| ship-check | 2026-10-24 | 98/100 Beta; 9 findings (1 high potential N+1, 4 medium, 2 low, 2 info). Zod advisory not in scan; still open, not fixed |
| Browser (larger mode, EDC) | 2026-10-19–20 | Wallet fits 640×400 / 375×844; EDC selection persists, wishlist excluded |

## Next

1. Owner: apply `20261024150000` to hosted. `supabase db push` refuses until `20261024120000` and `20261024130000` (on `claude/friendly-feynman-phs5om`, unmerged) are in the tree. `20261024140000` (merchant logos, `claude/wonderful-shannon-azbdhi`, not found in this clone) should land first, or the push needs `--include-all`.
2. Owner: decide on `finance_truelayer_connection` and `finance_truelayer_oauth_states`. Both hold bank access and refresh tokens and keep SELECT, INSERT, UPDATE, DELETE for `authenticated`; RLS is `is_admin()` only. Only `truelayer-sync` queries them (`src/` has generated types only). Reviewer: REVOKE ALL with no re-grant, as for `finance_truelayer_source_sync`.
3. Open a PR for this branch when wanted and verify CI (the commit is pushed; no PR exists yet).
4. S-10 (REHAUL_PLAN.md ~line 234): schema-file anon grants differ from live; scope is now the real list.
5. Diagnose local finance query plans/RLS cost; benchmark alone does not identify the bottleneck.
6. Migrate Zod 3.25.76 for GHSA-mrhx-c7xc-m3w5; reported patched version is >=4.6.6.
7. Measure excluded Watchlist/finance paths and production; verify live writes, devices and true 200% zoom.
8. Run `npm run typecheck:functions` and `graphify update .` where network and tooling allow.
9. Resume REHAUL_PLAN separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- Hosted `authenticated` still holds TRUNCATE on the 49 tables until `20261024150000` is applied; the grant work is verified locally only.
- Admin sessions can select bank tokens through the `finance_truelayer_*` grants and `is_admin()` RLS (Next 2).
- Declarative grants reconciliation remains open: five of the 49 targets have no CREATE TABLE under `supabase/schemas/` (`finance_debt_observations`, `finance_investment_activities`, `finance_investment_holdings`, `finance_payslip_transaction_reconciliations`, `finance_payslips`), so only the migration sets their grants. No unrelated finance fixes ship here.
- New Zod advisory GHSA-mrhx-c7xc-m3w5 remains open; the October 23 audit result is not current assurance.
- Remaining scanner findings and Watchlist per-season/per-favourite reads remain unresolved.
- Parser major-version override is validated for this project's install/tests/CSS, not future changes.
- Unverified live or on devices: physical devices, true 200% zoom, live authenticated writes, finance load/save/reload, full ledger, recurring Paid/tick/untick.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
