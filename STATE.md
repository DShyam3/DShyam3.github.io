# State

**Updated:** 2026-10-24 · **Branch:** `claude/wonderful-shannon-azbdhi` · **Head:** `b2ac0a4` (on main `55c2341`), pushed, no PR opened · **Deployed code:** `55c2341`

## In progress

Merchant-logo grants least privilege is **closed on branch, NOT applied to hosted**.

- Migration `20261024140000_merchant_logo_grants_least_privilege` narrows `finance_merchant_logos`: anon SELECT; authenticated SELECT/INSERT/UPDATE/DELETE; service_role ALL. A `has_table_privilege` post-check rolls back on any other ACL.
- `supabase/schemas/40_finance.sql` declares the table now, so it has left the drift list. SECURITY.md updated.
- Hosted before-state (read-only check): anon `rDxt` (SELECT, TRUNCATE, REFERENCES, TRIGGER); authenticated `arwdDxt`.
- Local stack: `supabase db reset`, and an apply over hosted's exact ACL, both give anon `r`, authenticated `arwd`. Anon REST read 200; anon insert 42501; anon and authenticated TRUNCATE refused; admin and service_role REST writes 201/204. Post-check rejects stray anon/PUBLIC TRUNCATE, missing authenticated DELETE and missing service_role TRUNCATE.
- Local caveat: run from a scratch copy of `supabase/` with realtime disabled, because the realtime image could not be pulled in the sandbox. Repo `config.toml` unchanged.

## Deployed

- Paged-read benchmark tooling (`scripts/benchmark-paged-reads.mjs`, `performance/README.md`) shipped through [PR #6](https://github.com/DShyam3/DShyam3.github.io/pull/6) at `55c2341`; [Pages run 40083861946](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40083861946) succeeded, checked with `gh run list` on 2026-10-24. Live site not checked. It measures reads only; no application query runtime changed.
- Parser override 7.1.7 shipped through [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5) at `9f13ce77`; [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded, verified 2026-10-24. Both CSS outputs matched the 6.1.4 baseline.
- Earlier cleanup/dependency releases: `8f6078e8` / `1395077f`; EDC: `799d8358`.
- Live Inventory on 2026-10-20 showed 13 EDC items, brands and no wishlist item.
- Migration `20261013100000_inventory_wishlist_not_edc` is local and LIVE: zero conflicts, validated constraint; local rollback tests pass.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint / typecheck (src) | 2026-10-24 | Pass on this branch: lint 0 errors / 0 warnings |
| Tests / build | 2026-10-24 | 51 files / 1,001 tests pass; build passes, run before the final comment-only SQL and SECURITY.md edits |
| Review | 2026-10-24 | `reviewer` ran; findings addressed (post-check rewritten, false comments fixed); NOT re-run after fixes |
| typecheck:functions | — | NOT run: no functions changed; Deno not installed |
| ship-check | — | NOT run this session; last run 2026-10-24: 96/100 Beta, 10 findings (2 high: potential N+1, Zod) |
| graphify | — | NOT refreshed: not installed; no `graphify-out/` in tree |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded/rejected |

## Next

1. Owner's call: apply `20261024140000` to hosted. Hosted history already holds `20261024120000` and `20261024130000`, which exist only on unmerged branch `claude/friendly-feynman-phs5om`, so `supabase db push` from this branch will refuse until that branch is merged here or into main. Do not use `migration repair` to get round it. Afterwards re-run the hosted grant query; expect anon SELECT only.
2. Owner decision: should anon keep reading the logo index? The resolver caches only directory brands found in `finance_transactions`, so the index (slugs plus `resolved_at`) and the public bucket listing (storage policy "Public reads merchant logos") show which brands the owner pays. Nothing in the app reads it as anon. Dropping it is one REVOKE plus a storage policy change.
3. Separate session, started to revoke TRUNCATE/REFERENCES/TRIGGER from authenticated on ~49 tables (hosted, read-only check). Its brief wrongly says signup is disabled; hosted signup is ON.
4. Carry forward, still open: Zod 3.25.76 GHSA-mrhx-c7xc-m3w5 (patched >=4.6.6); diagnose local finance query plans/RLS cost (benchmark alone does not identify the bottleneck); measure excluded Watchlist/finance paths and production; verify live writes, devices and true 200% zoom; resume REHAUL_PLAN (Library contained scrolling unbuilt).

## Blockers / open risks

- Migration `20261024140000` is unapplied on hosted; hosted anon still holds TRUNCATE on `finance_merchant_logos` until it is.
- Hosted authenticated holds TRUNCATE on ~49 tables while hosted signup is ON; separate session in progress, unverified.
- Logo index and bucket listing readable by anon (Next 2), unresolved.
- Schema drift: five finance tables exist only in migrations: `finance_debt_observations`, `finance_investment_activities`, `finance_investment_holdings`, `finance_payslips`, `finance_payslip_transaction_reconciliations`.
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
