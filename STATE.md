# State

**Updated:** 2026-10-20 · **Branch:** `codex/edc-toolbar-release` · **HEAD:** `9ae9dfeb`

## In progress

Isolated EDC, collection toolbar and detail-dialog release is in the working tree,
uncommitted, unpushed and not deployed. It starts from `origin/main` at `9ae9dfeb`;
unrelated finance, Travel and About work from the original checkout is excluded.
The latest original review fixes are included. Final release review and fresh checks pass. The original checkout is owned by another session.

Migration `20261013100000_inventory_wishlist_not_edc` is applied locally and LIVE.
Live verification found zero wishlist/EDC conflicts and a validated constraint.
Local rollback tests cover nullable flag combinations and forbidden inserts/updates.
The UI excludes wishlist items from EDC and rejects adding them through item edit.

## Checks

| Check | Date | Result |
|---|---|---|
| Release lint | 2026-10-20 | Pass; 0 errors / 0 warnings |
| Release typecheck / typecheck:functions | 2026-10-20 | Pass |
| Release tests / build | 2026-10-20 | 51 files / 1,001 tests pass; build passes with configured local environment |
| Release ship-check | 2026-10-20 | 90/100 Beta; 19 findings, including 7 unresolved high findings |
| Graphify | 2026-10-20 | Refreshed |
| Database | 2026-10-19 | Migration local/live; live constraint validated, zero conflicts; local rollback tests pass |
| Browser, original checkout | 2026-10-19 | 390×844: no horizontal overflow, 13 EDC items, brand visible; 768×600 dark/light detail: 552px max, keyboard scroll, stationary image |
| Browser, isolated release | 2026-10-19–20 | Signed-in local fixture: owned EDC persists overnight; wishlist excluded from picker and refused by edit form; Tech default Filters has no active count |
| Review | 2026-10-20 | Isolated diff rereview: no blockers |

## Next

1. Commit the verified isolated batch, open PR and deploy.
2. Verify live authenticated EDC writes and persistence after deployment.
3. Verify physical devices, Larger mode and 200% zoom; continue the remaining dialog audit.
4. Resume REHAUL_PLAN priorities separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- Seven high ship-check findings remain unresolved; passing build gates does not close them.
- Physical devices, 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger, recurring Paid and tick/untick remain unverified live.
- Finance risks remain: four reference tables delete-then-insert, debt observation queueing,
  logout/load/delete races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU remains unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open. No unrelated finance fixes are shipped by this release.
- Main ancestry discrepancy is resolved: local main was stale; `ea9dc192` and `9ae9dfeb` are in `origin/main`.
