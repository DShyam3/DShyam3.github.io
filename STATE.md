# State

**Updated:** 2026-10-24 · **Branch:** `codex/paged-read-benchmark` · **Deployed code:** `9f13ce77`

## In progress

Paged-read benchmark is LOCAL and UNCOMMITTED. `scripts/benchmark-paged-reads.mjs`,
`performance/README.md` and raw JSON record local synthetic movie/finance reads;
SECURITY.md links the findings. Review and credential-environment rerun pass; cleanup
is verified. This measures reads; it changes no application query runtime.

The local benchmark uses anonymous movies and seeded-admin private finance at
100 / 1,000 / 5,000 rows, five measured warm reads each through real `selectAllPages`.
At 5,000 rows, each uses five requests: median movies 44.04ms, finance 702.78ms.
Fixtures were removed and original counts verified: 0 movies, 20 transactions.
Scope excludes saves, provider rendering, nested TV data, TMDB and production.

## Deployed

Parser override 7.1.7 shipped through [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5)
at `9f13ce77`; [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348)
succeeded, verified 2026-10-24. Both CSS outputs matched the 6.1.4 baseline.
Earlier cleanup/dependency releases: `8f6078e8` / `1395077f`; EDC: `799d8358`.
Live Inventory on 2026-10-20 showed 13 EDC items, brands and no wishlist item.
Migration `20261013100000_inventory_wishlist_not_edc` is local and LIVE: zero conflicts, validated constraint; local rollback tests pass.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint / both typechecks | 2026-10-24 | Pass; lint 0 errors / 0 warnings |
| Tests / build / graph | 2026-10-24 | 51 files / 1,001 tests pass; build passes; graph refreshed |
| Review | 2026-10-24 | Pass |
| ship-check | 2026-10-24 | 96/100 Beta; 10 findings: 2 high (potential N+1, Zod), 4 medium, 2 low, 2 info; password-literal finding cleared |
| Previous ship-check / audit | 2026-10-23 | 98/100 Beta, 9 findings; audit 0 then, superseded by new advisory |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded/rejected |

## Next

1. Commit the validated benchmark tooling, open PR and verify CI.
2. Diagnose local finance query plans/RLS cost; benchmark alone does not identify the bottleneck.
3. Migrate Zod 3.25.76 for GHSA-mrhx-c7xc-m3w5; reported patched version is >=4.6.6.
4. Measure excluded Watchlist/finance paths and production; verify live writes, devices and true 200% zoom.
5. Resume REHAUL_PLAN separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- New Zod advisory remains open; the October 23 audit result is not current assurance.
- Remaining scanner findings and Watchlist per-season/per-favourite reads remain unresolved.
- Parser major-version override is validated for this project's install/tests/CSS, not future changes.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete
  races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open; no unrelated finance fixes ship here.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
