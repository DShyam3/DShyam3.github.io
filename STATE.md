# State

**Updated:** 2026-10-24 · **Branch:** `claude/friendly-feynman-phs5om` (pushed, no PR, not merged) · **Last code commit:** `9534bfa` · **Deployed code:** `55c2341` (main)

## In progress

Nothing in flight.

- Closed, live on hosted: admin check once per statement (`7eb053d`, hosted record `41ee3ff`). Migrations `20261024120000` and `20261024130000` are applied to hosted at the repo versions; no admin policy there is bare. Decision: REHAUL_HISTORY.md, "Admin check once per statement". The 1,051 → 276 ms benchmark is local only; no hosted benchmark has run.
- Closed, committed, not deployed: schema repair (`9534bfa`). The six migration-only finance tables are in `supabase/schemas/40_finance.sql`; hosted and local catalogs match.
- Not merged: `main` and Pages carry neither change; the live database carries the admin-check change.

## Deployed

- `55c2341` (main, PR #6): [Pages run 40083861946](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40083861946) succeeded, checked 2026-10-24 with `gh run list`. Live site not checked.
- Hosted database: admin-check migrations above, applied 2026-10-24. `20261013100000_inventory_wishlist_not_edc` live since 2026-10-20 (zero conflicts, validated constraint).
- Parser override 7.1.7 at `9f13ce77` via [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5): [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded; both CSS outputs matched the 6.1.4 baseline.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint (`npm run lint`) | 2026-10-24 | 0 errors, 0 warnings, on `9534bfa` |
| Typecheck (`npm run typecheck`) | 2026-10-24 | Pass |
| Tests / build | 2026-10-24 | 52 files / 1,006 tests pass; build passes |
| Review | 2026-10-24 | `reviewer` ran on both diffs; findings addressed; no re-run after fixes recorded |
| Hosted database | 2026-10-24 | Per-role access simulated in rolled-back transactions; EXPLAIN shows the InitPlan; no new advisor findings |
| `typecheck:functions` | — | NOT run: Deno 2.7.5 is installed, but esm.sh and deno.land are blocked (403) |
| ship-check | 2026-10-24 | 98/100, 9 findings (1 high potential N+1, 4 medium, 2 low, 2 info). Ran without the OSV engine, so the Zod advisory is not cleared |
| graphify | — | NOT run; `graphify-out/` is gitignored |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-23 | 0 findings then; not current assurance (Zod advisory below) |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded/rejected |

## Next

1. Owner decision, live now: anon can read `finance_merchant_logos` (21 rows) and list the `merchant-logos` bucket, which shows which directory brands the owner pays. Fix proposed in REHAUL_PLAN.md ("Database follow-ups found in the 2026-10-24 schema repair"); not applied.
2. Owner's call: open a PR for `claude/friendly-feynman-phs5om` when ready to merge, then deploy.
3. The other REHAUL_PLAN database follow-ups: `authenticated` holds ALL, including TRUNCATE, on most `finance_*` tables; `finance_debt_observations.debt_id` FK can cross profiles and has no index; `supabase/schemas/` cannot rebuild from empty.
4. `typecheck:functions`: allow esm.sh and deno.land in the environment's network settings, then run it.
5. Still open, unverified: Zod 3.25.76 advisory GHSA-mrhx-c7xc-m3w5 (patched >=4.6.6); finance benchmark on hosted; measure excluded Watchlist/finance paths and production; verify live writes, devices and true 200% zoom; resume REHAUL_PLAN (Library contained scrolling unbuilt).

## Blockers / open risks

- LIVE disclosure: anon reads `finance_merchant_logos` and lists the bucket (Next 1).
- Finance read unmeasured on hosted; locally it still grows faster than row count (276 ms at 5,000 rows vs 5 × 22 ms at 1,000).
- Zod advisory open. The ship-check run had no OSV engine, so it is not evidence of a fix; the 2026-10-23 audit is not current assurance.
- Nine scanner findings and Watchlist per-season/per-favourite reads remain unresolved.
- Parser major-version override is validated for this project's install/tests/CSS, not future changes.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert; debt observation queueing; logout/load/delete races; category changes during sync; unlimited token refresh; failed profile-switch load. Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
- Full list and reasoning: REHAUL_PLAN.md.
