# State

**Updated:** 2026-10-23 · **Branch:** `codex/readiness-triage` · **Deployed code:** `1395077f`

## In progress

Readiness cleanup is LOCAL, UNCOMMITTED and NOT SHIPPED. It removes unused
`@tailwindcss/typography` and its selector parser 6.0.10 from the package and both locks.
`SECURITY.md` records residual dependency exposure and N+1 source triage without
suppressions. Query runtime is unchanged. Source review is complete; workload
measurement remains. The reviewer’s finance-pagination correction is in SECURITY.md.
The original checkout is owned by another session; unrelated changes are excluded.

## Deployed

Dependency updates shipped through [PR #3](https://github.com/DShyam3/DShyam3.github.io/pull/3)
at `1395077f`: brace-expansion 1.1.21 / 2.1.7, source-map-js 1.2.2,
Vite 8.2.4 and Vitest 5.0.3. [Pages run 39765814791](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39765814791)
succeeded on 2026-10-22. The new cleanup is not included in that deployment.
EDC controls/dialogs shipped through PR #2 at `799d8358`; live Inventory was verified
on 2026-10-20 with 13 EDC items, brands and no wishlist item.
Migration `20261013100000_inventory_wishlist_not_edc` is applied locally and LIVE;
verification found zero conflicts and a validated constraint. Local rollback tests pass.

## Checks

| Check | Date | Result |
|---|---|---|
| Local cleanup lint | 2026-10-22 | Pass; 0 errors / 0 warnings |
| Local typecheck / typecheck:functions | 2026-10-22 | Pass |
| Local tests / build | 2026-10-22 | 51 files / 1,001 tests pass; build passes; CSS hashes unchanged |
| ship-check | 2026-10-23 | 97/100 Beta; 10 findings: 1 high, 5 medium, 2 low, 2 info |
| npm audit | 2026-10-23 | 4 moderate, 0 high, 0 critical |
| Larger-mode browser | 2026-10-20 | Wallet detail fits 640×400 and 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded from picker and rejected by edit form |

## Next

1. Commit cleanup, open PR, verify CI and deploy.
2. Measure Watchlist and finance workloads before changing query behaviour. Source triage finds
   mostly batched/paged finance queries; Watchlist per-season/per-favourite reads remain.
3. Follow up selector-parser 6.1.4. Upstream withdrew braces GHSA-vfj7-8cjw-p6xm on
   2026-10-23 as not practically exploitable; its high finding disappeared without a package change.
4. Verify live authenticated EDC writes, physical devices and true 200% zoom; continue dialog audit.
5. Resume REHAUL_PLAN separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- Remaining scanner findings are unresolved; passing build gates does not close them.
- npm audit aggregates packages differently from ship-check. Cleanup removes one medium parser copy;
  the high-count reduction comes from the upstream advisory withdrawal, not this code change.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete
  races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open; no unrelated finance fixes ship with this cleanup.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
