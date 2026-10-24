# State

**Updated:** 2026-10-24 · **Branch:** `codex/selector-parser-patch` · **Deployed code:** `9f13ce77`

## Deployed parser update

The selector-parser override merged through [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5):
code `1ffeb8ac`, merge `9f13ce77`. Tailwind/postcss-nested resolve parser 7.1.7.
Clean installation and project checks pass; both CSS outputs are byte-identical
to the 6.1.4 baseline. SECURITY.md records the validation caveat. CI runs
`39995777542` / `39995786799` pass on 2026-10-23.
[Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348)
succeeded, verified 2026-10-24; `9f13ce77` is deployed. No query runtime or user-facing feature changes.

## Previous releases

Readiness cleanup shipped through [PR #4](https://github.com/DShyam3/DShyam3.github.io/pull/4)
at `8f6078e8`, removing unused typography and parser 6.0.10.
[Pages run 39995094919](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995094919)
succeeded on 2026-10-23; that cleanup precedes the deployed parser update.
Earlier dependency updates shipped at `1395077f`; EDC controls/dialogs at `799d8358`.
Live Inventory verification on 2026-10-20 found 13 EDC items, brands and no wishlist item.
Migration `20261013100000_inventory_wishlist_not_edc` is applied locally and LIVE:
zero conflicts, validated constraint; local rollback tests pass.

## Checks

| Check | Date | Result |
|---|---|---|
| Clean installation / lint | 2026-10-23 | Pass; lint 0 errors / 0 warnings |
| Typecheck / typecheck:functions | 2026-10-23 | Pass |
| Tests / build | 2026-10-23 | 51 files / 1,001 tests pass; build passes; both CSS outputs byte-identical to 6.1.4 baseline |
| ship-check | 2026-10-23 | 98/100 Beta; 9 findings: 1 high, 4 medium, 2 low, 2 info |
| npm audit | 2026-10-23 | 0 vulnerabilities |
| Larger-mode browser | 2026-10-20 | Wallet detail fits 640×400 and 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded from picker and rejected by edit form |

## Next

1. Measure Watchlist and finance workloads before changing queries. Source-only triage finds
   mostly batched/paged finance queries; Watchlist per-season/per-favourite reads remain.
2. Verify live authenticated EDC writes, physical devices and true 200% zoom; continue dialog audit.
3. Resume REHAUL_PLAN separately; Library contained scrolling remains unbuilt.

## Blockers / open risks

- Remaining scanner findings are unresolved; zero npm audit vulnerabilities does not close them.
- The parser override crosses a dependency major version; validation covers this project's install,
  tests and generated CSS, not every upstream consumer or future CSS change.
- Upstream withdrew braces GHSA-vfj7-8cjw-p6xm on 2026-10-23 as not practically exploitable;
  that earlier high-count reduction came from advisory withdrawal, not a package change.
- Physical devices, true 200% zoom and live authenticated writes remain unverified.
- Finance load/save/reload, full ledger and recurring Paid/tick/untick remain unverified live.
- Finance risks: four reference tables delete-then-insert, debt observation queueing, logout/load/delete
  races, category changes during sync, unlimited token refresh and failed profile-switch load.
- Recurring early-payment credit and old paid flags without last-paid dates remain open.
- Watchlist cron CPU is unmeasured; production sync-race fix remains unconfirmed.
- Other finance collections remain unpaged; duplicated src/Deno pagers must change together.
- Declarative grants reconciliation remains open; no unrelated finance fixes ship with this patch.
- CI maintenance: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
