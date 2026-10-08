# State

**Updated:** 2026-10-08 · **Branch:** `feat/watchlist-news-finance-transfers` · **HEAD:** `55269ec5` (= `origin/main`, deployed 2026-10-08) · working tree clean

## Deployed

Deployed 2026-10-08: commits `c081b08a` (recurring Paid decided by the period a payment covers; recurring payment evidence memoised) and `55269ec5` (nightly watchlist sync pages its library reads), on top of `0d04bd24`. Pages run 37739685661 succeeded; the live site serves `assets/index-DiJpx0Of.js`, identical to the local build.

Live DB: migration `20261008090000_finance_recurring_paid_period.sql` applied with `supabase db push` (version matches the local file). It adds nullable `finance_recurring_bills.paid_for_due_date` (date), no backfill, anon grants still 0. All 11 live bills have no `last_paid_date`, so no row lost early credit. Edge function `watchlist-cron-sync` is v13 (verify_jwt true); read errors now reach sync_log.

Still live from 2026-10-07 (commits `056afb97`, `e9a72a7a`, `531561f0`, `48e70a23`; Pages run 37683893291; migrations `20261006090000` and `20261006220926`): finance loading recovery, recurring review, payslip reconciliation, ledger pagination (3,770 rows; P-6 closed), watchlist nightly sync in three parts, watchlist pagination. The 7 Oct incident was a client-side network stall in Chrome: edge logs show the profile request never reached Supabase.

**Recurring review:** merchant/account detection, payment evidence, active/inactive/dismissed review, confirmed last-paid dates, manual add/edit/restore. Inactive entries leave totals. Paid is now per covered period: `paid_for_due_date` records which period's due date a tick covers.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint | 2026-10-08 | Pass, 0 errors / 0 warnings |
| Typecheck | 2026-10-08 | Pass |
| typecheck:functions | 2026-10-08 | Pass; Deno tests 19 pass |
| Vitest | 2026-10-08 | 50 files / 995 tests pass |
| Build | 2026-10-08 | Pass |
| Reviewer (Opus) | 2026-10-08 | Paid-period and cron-paging diff. One blocker, fixed as proposed: editing only a bill's schedule overwrote the owner's Paid tick. Fix not re-reviewed |
| ship-check | 2026-10-07 | 90/100, Beta only; 19 findings, 0 critical / 7 high. Not rerun since 2026-10-08 |
| graphify update | 2026-10-07 | Not rerun since 2026-10-08 |

## In progress / next

1. Owner: verify the 2026-10-09 watchlist parts on v13 at 06:00, 06:10 and 06:20 UTC: sync_log success for shards 0/1/2, no 'Unknown error'.
2. Owner: verify signed-in recurring load/save/reload, review, dismissal, restore and manual entries against the live DB.
3. Owner: tick and untick a recurring bill signed in; confirm Paid moves with the period.
4. Owner: verify authenticated profile load/retry, full ledger load, Confirm all 13, finance saves, charts and row-save signed in.
5. Remaining REHAUL_PLAN Part 2, including upcoming bills calendar and subscription price-rise/unused audit. Pinned-title countdown unbuilt (8.D); backdrop count not yet checked.

## Blockers / open risks

**Recurring Paid and pagers:**
- (a) An early payment for the next period can't be recorded from the UI. A tick always covers the current period when it is unpaid, and the checkbox shows Paid when it is paid, so a bill paid early for October shows Unpaid from its due date until re-ticked. A schedule edit also drops early credit: the covered period is recomputed from the payment date.
- (b) 5 live monthly bills have `is_paid` true with no `last_paid_date`. The older display rule (`!lastPaidDate` means trust the tick) shows them Paid every month until re-ticked. This predates the change and is unchanged.
- (c) The src and Deno pagers are duplicated and must change together: `src/integrations/supabase/select-all-pages.ts`, `supabase/functions/_shared/select-all-pages.ts`.

**Watchlist cron:** reads are paged, so there is no silent stop at 1,000 rows. Each part still reads the whole library before the in-memory `id % shards` filter, because PostgREST has no modulo filter. CPU per part is unmeasured; read `cpu_time_used` on the 2026-10-09 parts.

**Carried finance risks:** four reference tables delete-then-insert; addDebtObservation not queued; logout race; load deadline; timed-out delete in grace window; sync mid-set category race; unlimited token refresh; failed profile-switch load. Ship-check findings remain unresolved.

**Pagination:** other finance collections under 300 rows remain unpaged; truncated transfers would silently miscount. `watchlist_up_next` is single (268 rows). Cold-load failure toast remains misleading.

## Unverified

**Signed-in browser checks:** all still unverified: recurring Paid, tick/untick and schedule edit; recurring persistence; the cron v13 run (first night 2026-10-09, not yet observed).

**Loading recovery:** isolated browser checks passed (15-second slow fallback, simulated render error, reload restart). Auto-retry is unit-tested, not browser-tested signed in; real authenticated profile load/retry remains unverified. Probes: configured DB gateway 146ms, permission response 42501 in 471ms, local dashboard module 5ms; no reproduction of sustained timeout.

**Finance:** 3,770-row signed-in load, Confirm all, 12px charts and row-save. Goals/debts/holidays/scores/memberships/emergency-toggle/course-end saves remain unverified. Capgemini/UCL December early-pay matching verified locally; live rows existed at 21:55 UTC. OceanInfinity 2026-06-30 unmatched, not investigated.

**Watchlist:** anonymous local/live-DB browser showed 889 movies and 296 TV shows; news offset/limit requests had no errors. Multi-page (>1,000 rows) proven by curl only. The 7 Oct three-part night is verified in sync_log (shards 0/1/2 success, 393/397/394 items, 17–22 s each). Mid-July marks: 10 of ~400; deployed sync-race fix `91e98584` unconfirmed in production.
