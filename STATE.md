# State

**Updated:** 2026-10-09 · **Branch:** `claude/affectionate-lamarr-f2d2cb`, six commits past `main`: `7ffeba5b`, `14dd8237`, `69574a3a`, `e6c271ac`, `fe51d0da`, then this handoff · working tree clean · **Not merged, not deployed**

## Deployed (main)

- `main` is `8a4a4cff`, a docs-only commit on `55269ec5`, the code live since 2026-10-08 (Pages run 37739685661; live `assets/index-DiJpx0Of.js` matches the local build).
- Live DB: migration `20261008090000_finance_recurring_paid_period.sql` applied (nullable `finance_recurring_bills.paid_for_due_date`, no backfill, anon grants 0). All 11 live bills lack `last_paid_date`, so none lost early credit. `watchlist-cron-sync` is v13 (verify_jwt true); read errors reach sync_log.
- Live since 2026-10-07 (`056afb97`, `e9a72a7a`, `531561f0`, `48e70a23`; Pages run 37683893291; migrations `20261006090000`, `20261006220926`): finance loading recovery, recurring review, payslip reconciliation, ledger pagination (3,770 rows), watchlist sync in three parts, watchlist pagination.

## Site assistant (7.6): built on the branch, not shipped

- `7ffeba5b` adds the admin-only site chat: header ASK control (from 768px) and menu button, read-only finance, inventory and watchlist tools, and the `assistant` Edge Function. `14dd8237` rebuilds echoed OpenAI tool calls and publishes the finance context only after every table read cleanly (new read-only `financeDataReady`).
- Not merged. `assistant` is not deployed and no model secret is set, so no control shows anywhere. A build carrying the launcher with the function undeployed logs one failed CORS preflight per admin page load. Stays open in REHAUL_PLAN Part 2; no REHAUL_HISTORY entry until it closes.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint; typecheck | 2026-10-09 | Lint 0 errors / 0 warnings and typecheck pass, both run on 2026-10-09 at `fe51d0da` |
| Vitest; build | 2026-10-09 | 55 files / 1076 tests pass; build pass; both reported green at `fe51d0da` by the session that landed it, not rerun here. AssistantPanel lazy chunk ~7 kB gzip (2026-10-08) |
| typecheck:functions; Deno tests | 2026-10-08 | 30 pass at `14dd8237`; `supabase/functions` unchanged since, so unaffected |
| Reviewer (Opus) | 2026-10-09 | `e6c271ac` reviewed: 1 bug and 2 code risks, all fixed in `fe51d0da`; `fe51d0da` not re-reviewed. Earlier: `7ffeba5b` pass 1 (4 bugs, 12 risks, 5 nits; bugs and nits fixed, risks fixed or open as item 4 and item 3's wire names); pass 2 found the OpenAI tool-call echo and finance-readiness gap, fixed in `14dd8237`, not re-reviewed |
| graphify update | 2026-10-09 | rerun 2026-10-09 by the main thread (1785 nodes at the 2026-10-08 run) |
| ship-check | 2026-10-07 | 90/100, Beta only; 19 findings, 0 critical / 7 high. On main; not rerun |

## In progress / next

1. Owner: `npx supabase functions deploy assistant`, before any site build that carries the launcher.
2. Owner: `npx supabase secrets set ANTHROPIC_API_KEY=...`, or another provider row's key (`supabase/README.md`).
3. Owner, signed in: ask "What is in my PC?", "What comes out this year?", "How much did I make last month?" on the live model. The first call also settles the unverified wire names: `fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01` (if refused, every call fails as a generic 502) and the `fallback` block type the function lets back in (if wrong, the question after a fallback fails; the function log names the refused type).
4. Owner: decide whether goal and spending-category names may be sent (REHAUL_PLAN 7.6, "Open").
5. Owner: decide the Cash Flow page's average: adopt `completeRecordedMonths`, labelling its span and empty months, or keep the wider divisor with a stated reason (REHAUL_PLAN 7.6, "Open").
6. Owner: the phone header is 184–226px tall at 320px (129–185px from 360px up); drop the role line below 360px, or accept it. Optional: rename /auth's title (REHAUL_PLAN 7.6, "Open").

**Carried from main, still open:**

7. Owner: on 2026-10-09 at 06:00, 06:10 and 06:20 UTC, sync_log shows success for shards 0/1/2 with no 'Unknown error' (v13).
8. Owner, signed in: recurring load, save, reload, review, dismissal, restore and manual entries; tick and untick, with Paid moving by period; authenticated profile load and retry; full ledger, Confirm all 13, finance saves, charts, row-save.
9. REHAUL_PLAN Part 2 remainder: upcoming bills calendar and subscription audit (8.H); pinned-title countdown (8.D, unbuilt); backdrop count not checked.

## Blockers / open risks

- **Assistant:** no key and no deploy yet. Goal and spending-category names are sent to the model (item 4). Cash-flow averages cover complete recorded months only (`e6c271ac`, `fe51d0da`), naming any averaged month with no rows; `ledgerStartsMonth` says where records begin. The Cash Flow page still divides by every started month, including the current one and months before the ledger (item 5).
- **Recurring Paid:**
  - (a) An early payment for the next period can't be recorded from the UI: a tick covers the current period, so a bill paid early for October shows Unpaid from its due date until re-ticked. A schedule edit also drops early credit (the covered period is recomputed from the payment date).
  - (b) 5 live monthly bills have `is_paid` true with no `last_paid_date`, so they show Paid each month until re-ticked. Predates the change; unchanged.
  - (c) The src and Deno pagers are duplicated and must change together: `src/integrations/supabase/select-all-pages.ts`, `supabase/functions/_shared/select-all-pages.ts`.
- **Watchlist cron:** reads are paged, but each part still reads the whole library before the in-memory `id % shards` filter (PostgREST has no modulo filter). CPU per part unmeasured; read `cpu_time_used` on the 2026-10-09 parts.
- **Carried finance risks:** four reference tables delete-then-insert; addDebtObservation not queued; logout race; load deadline; timed-out delete in grace window; sync mid-set category race; unlimited token refresh; failed profile-switch load. Ship-check findings unresolved.
- **Pagination:** other finance collections under 300 rows are unpaged; truncated transfers would silently miscount. `watchlist_up_next` is single (268 rows). Cold-load failure toast is misleading.

## Unverified (not passed)

- **Assistant:** the launcher in a real signed-in header and menu (needs an admin session and a provider); a live model round trip; real phones; `get_cash_flow` averages in a live answer (unit-tested only). Checked: anonymous pages make no assistant request and show no control (dev server, 2026-10-08); header gaps unchanged at 768px; panel rendered in isolation at desktop and 375px (no horizontal overflow, 44px controls); clean notice when the function is unreachable.
- **Header, phone width (`e6c271ac`, `fe51d0da`):** Chrome emulation 2026-10-09 at 320, 360, 375, 390, 414 and 640px, links open and closed: nothing past the gutter, no overlap, no mid-word split. Real phones unverified. Height is an owner call (item 6).
- **Recurring Paid:** signed-in tick, untick, schedule edit and persistence. The reviewer's blocker (a schedule edit overwrote the Paid tick) was fixed; the fix is not re-reviewed. The cron v13 run (first night 2026-10-09) is not yet observed.
- **Loading recovery:** isolated checks passed (15 s slow fallback, simulated render error, reload restart). Auto-retry is unit-tested, not browser-tested signed in. Probes: DB gateway 146 ms, permission response 42501 in 471 ms, dashboard module 5 ms; no sustained timeout reproduced.
- **Finance:** 3,770-row signed-in load, Confirm all, 12 px charts, row-save. Goals, debts, holidays, scores, memberships, emergency toggle and course-end saves unverified. Capgemini/UCL December early-pay matching verified locally; live rows existed at 21:55 UTC. OceanInfinity 2026-06-30 unmatched, not investigated.
- **Watchlist:** anonymous browser showed 889 movies and 296 TV shows; no news request errors. Multi-page (>1,000 rows) proven by curl only. The 7 Oct three-part night is in sync_log (shards 0/1/2 success, 393/397/394 items, 17–22 s each). Mid-July marks: 10 of ~400; sync-race fix `91e98584` unconfirmed in production.
