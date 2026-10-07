# State

**Updated:** 2026-10-07 · **Branch:** `feat/watchlist-news-finance-transfers` · **HEAD:** `5d216580` (= `origin/main`, deployed 2026-09-30) · **UNCOMMITTED changes**

## In the tree, uncommitted

**Finance loading recovery:** profile reads have a 15-second deadline including token wait, abort/late-response guards and auth cleanup; empty/error results show persistent Try again. Quick failures now auto-retry twice (1 s, 3 s); deadline misses do not. Slow/failed page sections offer Reload page. Auto-retry not reviewed by reviewer. The 7 Oct incident was a client-side network stall in Chrome (edge logs: the profile request never reached Supabase; DB answered every request that arrived, max 1.6 s).

**Recurring review:** deterministic merchant/account detection, payment evidence, active/inactive/dismissed review, confirmed last-paid dates, manual add/edit/restore. Inactive entries leave totals; recurring edits and paid checks do not change bank balances. Migration `20261006220926_finance_recurring_review.sql` adds review fields and revokes anon grants; applied live 2026-10-07 via `supabase db push` (version matches local file); 11 existing bills active; admin select of the new columns verified by SQL; frontend still uncommitted and undeployed, and the deployed site ignores `status` until it ships. Reviewer completed; save-overlap, annual due-month, busy-button and early-payment findings fixed. Final fixes are checked but not re-reviewed; monthly/quarterly/annual paid status allows payments up to seven days early.

**Payslip reconciliation:** matches exact payments within the pay month or five days either side. Confirm all handles unambiguous exact pay-date matches; live SQL finds all 13 Keysight payslips eligible. Reviewer-found offset drift, max_rows, retry, upsert race and date issues fixed, not re-reviewed.

**Finance ledger pagination:** `select-all-pages.ts` pages transactions (3,770 rows) by date/id with exact count; P-6 closed. `supabase/config.toml` commented.

**Watchlist nightly sync:** three calls at 06:00/06:10/06:20 UTC each sync one third. Function v12 deployed; migration `20261006090000` applied live, cron jobs and shard columns verified. Frontend, shared types and schema changes remain uncommitted; part labels await deployment.

**Watchlist pagination:** library-sized movie/TV/favourite and news/season/episode reads use the shared pager (history 7.P2). Windowed/capped reads and `watchlist_up_next` remain single. WatchlistContext carries both sync and pagination hunks: commit together or split by hunk.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint | 2026-10-07 | Pass, 0 errors / 0 warnings |
| Typecheck / typecheck:functions / build | 2026-10-07 | Pass |
| Full Vitest suite | 2026-10-07 | 50 files / 971 tests pass; focused recurring suite 33 pass |
| graphify update | 2026-10-07 | Rerun after profile-load retry |
| ship-check | 2026-10-07 | 90/100, Beta only; 19 findings, 0 critical / 7 high; rerun completed |

## In progress / next

1. Owner: verify signed-in recurring load/save/reload, review, dismissal, restore and manual entries against the live DB (migration applied 2026-10-07).
2. Re-review remaining finance/watchlist changes before commit; preserve overlapping hunks. Commit, push and deploy remain outstanding.
3. Owner: verify authenticated profile load/retry, full ledger load, Confirm all 13, finance saves, charts and row-save signed in.
4. Verify first three-part watchlist night (7 Oct): sync_log shards 0/1/2 and cpu_time_used. Check backdrop count rising; pinned-title countdown remains unbuilt (8.D).
5. Remaining REHAUL_PLAN Part 2, including upcoming bills calendar and subscription price-rise/unused audit.

## Blockers / open risks

**Recurring deployment:** Live save/browser QA not performed. The schema is now live ahead of the code; the deployed site shows inactive/dismissed bills as ordinary bills until the code is deployed, so ship the code soon. Payslip/ledger files share recurring types: splitting them alone fails typecheck; coordinate schema and code deployment.

**Carried finance risks:** four reference tables delete-then-insert; addDebtObservation not queued; logout race; load deadline; timed-out delete in grace window; sync mid-set category race; unlimited token refresh; failed profile-switch load. Ship-check rerun completed; findings remain unresolved.

**Pagination:** other finance collections under 300 rows remain unpaged; truncated transfers would silently miscount. `watchlist_up_next` is single (268 rows). Cold-load failure toast remains misleading.

## Unverified

**Loading recovery:** isolated browser component checks passed: 15-second slow fallback, simulated render error and reload restart. Auto-retry unit-tested; not browser-tested signed in. Real authenticated profile load/retry remains unverified. Probes: configured DB gateway 146ms, permission response 42501 in 471ms, local dashboard module 5ms; no reproduction of sustained timeout.

**Finance:** 3,770-row signed-in load, Confirm all, recurring persistence, 12px charts and row-save. Goals/debts/holidays/scores/memberships/emergency-toggle/course-end saves remain unverified. Capgemini/UCL December early-pay matching verified locally; live rows existed at 21:55 UTC. OceanInfinity 2026-06-30 unmatched, not investigated.

**Watchlist:** anonymous local/live-DB browser showed 889 movies and 296 TV shows; news offset/limit requests had no errors. Multi-page (>1,000 rows) proven by curl only. Diff not reviewed. Each cron part still parses the full library before filtering; CPU remains unmeasured. Mid-July marks: 10 of ~400; deployed sync-race fix `91e98584` unconfirmed in production.
