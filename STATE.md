# State

**Updated:** 2026-10-22 · **Branch:** `codex/readiness-followup` · **Deployed code:** `1395077f`

## Deployed maintenance

Dependency maintenance merged through
[PR #3](https://github.com/DShyam3/DShyam3.github.io/pull/3) on 2026-10-22:
code `34a1609c`, merge `1395077f`. This checkout is fast-forwarded to the merge.
Updates include brace-expansion 1.1.21 / 2.1.7, source-map-js 1.2.2,
Vite 8.2.4 and Vitest 5.0.3. Local checks and CI runs `39765507979` /
`39765514277` pass.
[Pages run 39765814791](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39765814791)
succeeded on 2026-10-22; merge `1395077f` is deployed.
Review found only stale handoff status, corrected here. The original checkout
is owned by another session; unrelated changes are excluded.

## Prior EDC release

EDC, compact collection controls and detail dialogs shipped at `799d8358`
through [PR #2](https://github.com/DShyam3/DShyam3.github.io/pull/2).
[Pages run 39380259371](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39380259371)
succeeded on 2026-10-20. Live Inventory shows 13 EDC items, brands and no wishlist item.
Migration `20261013100000_inventory_wishlist_not_edc` is applied locally and LIVE;
verification found zero conflicts and a validated constraint. Local rollback tests pass.

## Checks

| Check | Date | Result |
|---|---|---|
| Local maintenance lint | 2026-10-22 | Pass; 0 errors / 0 warnings |
| Local typecheck / typecheck:functions | 2026-10-22 | Pass |
| Local tests / build | 2026-10-22 | 51 files / 1,001 tests pass; build passes |
| ship-check | 2026-10-22 | 95/100 Beta; 12 findings: 2 high, 6 medium, 2 low, 2 info |
| Larger-mode browser | 2026-10-20 | Wallet detail fits 640×400 and 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded from picker and rejected by edit form |
| Deployment | 2026-10-22 | Dependency maintenance Pages run succeeds; prior EDC live browser verification remains dated 2026-10-20 |

## Next

1. Recheck the residual braces advisory: no upstream patch was available as of 2026-10-20.
2. Review scanner N+1 findings and the selector-parser medium finding. Locator found mostly
   batched/paged finance queries; Watchlist per-season/per-favourite reads remain. None is fixed here.
3. Verify live authenticated EDC writes, physical devices and true 200% zoom; continue dialog audit.
4. Resume REHAUL_PLAN separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- Remaining scanner findings are unresolved; passing build gates does not close them.
- npm audit aggregation differs from ship-check; no fresh post-update audit result is recorded.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete
  races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open; no unrelated finance fixes ship with this patch.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
