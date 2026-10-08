# State

**Updated:** 2026-10-08 · **Branch:** `claude/affectionate-lamarr-f2d2cb`, three commits past `main`: `7ffeba5b` (assistant), `14dd8237` (re-review fixes), then this handoff · **Not merged, not deployed** · working tree clean

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
| Lint | 2026-10-08 | Pass, 0 errors / 0 warnings, at `14dd8237` |
| Typecheck; typecheck:functions | 2026-10-08 | Pass; Deno tests 30 pass, at `14dd8237` |
| Vitest | 2026-10-08 | 55 files / 1066 tests pass, at `14dd8237` |
| Build | 2026-10-08 | Pass; AssistantPanel lazy chunk ~7 kB gzip |
| Reviewer (Opus) | 2026-10-08 | Pass 1: 4 bugs, 12 risks, 5 nits; all bugs and nits fixed in `7ffeba5b`, risks fixed or recorded open (item 4, item 3's wire names). Pass 2 over the fixes: 1 new risk (OpenAI tool-call echo) and the finance-readiness gap, fixed in `14dd8237`; that commit is not re-reviewed |
| graphify update | 2026-10-08 | Run; 1785 nodes |
| ship-check | 2026-10-07 | 90/100, Beta only; 19 findings, 0 critical / 7 high. On main; not rerun |

## In progress / next

Assistant, in order. Item 1 must precede any site build that carries the launcher.

1. Owner: `npx supabase functions deploy assistant`.
2. Owner: `npx supabase secrets set ANTHROPIC_API_KEY=...`, or another provider row's key (`supabase/README.md`).
3. Owner, signed in: ask "What is in my PC?", "What comes out this year?", "How much did I make last month?" on the live model. The first call also settles the unverified wire names: `fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01` (if refused, every call fails as a generic 502) and the `fallback` block type the function lets back in (if wrong, the question after a fallback fails; the function log names the refused type).
4. Owner: decide whether goal and spending-category names may be sent (REHAUL_PLAN 7.6, "Open").

Carried from main, still open:

5. Owner: on 2026-10-09 at 06:00, 06:10 and 06:20 UTC, sync_log shows success for shards 0/1/2 with no 'Unknown error' (v13).
6. Owner, signed in: recurring load, save, reload, review, dismissal, restore and manual entries; tick and untick, with Paid moving by period; authenticated profile load and retry; full ledger, Confirm all 13, finance saves, charts, row-save.
7. REHAUL_PLAN Part 2 remainder: upcoming bills calendar and subscription audit (8.H); pinned-title countdown (8.D, unbuilt); backdrop count not checked.

## Blockers / open risks

- **Assistant:** no key and no deploy yet. Goal and spending-category names are sent to the model (item 4). Cash-flow averages divide by every started month in the range, before the ledger's first month included, as Cash Flow does; the tool returns `ledgerStartsMonth`.
- **Recurring Paid:**
  - (a) An early payment for the next period can't be recorded from the UI: a tick covers the current period, so a bill paid early for October shows Unpaid from its due date until re-ticked. A schedule edit also drops early credit (the covered period is recomputed from the payment date).
  - (b) 5 live monthly bills have `is_paid` true with no `last_paid_date`, so they show Paid each month until re-ticked. Predates the change; unchanged.
  - (c) The src and Deno pagers are duplicated and must change together: `src/integrations/supabase/select-all-pages.ts`, `supabase/functions/_shared/select-all-pages.ts`.
- **Watchlist cron:** reads are paged, but each part still reads the whole library before the in-memory `id % shards` filter (PostgREST has no modulo filter). CPU per part unmeasured; read `cpu_time_used` on the 2026-10-09 parts.
- **Carried finance risks:** four reference tables delete-then-insert; addDebtObservation not queued; logout race; load deadline; timed-out delete in grace window; sync mid-set category race; unlimited token refresh; failed profile-switch load. Ship-check findings unresolved.
- **Pagination:** other finance collections under 300 rows are unpaged; truncated transfers would silently miscount. `watchlist_up_next` is single (268 rows). Cold-load failure toast is misleading.

## Unverified (not passed)

- **Assistant:** the launcher in a real signed-in header and menu (needs an admin session and a provider); a live model round trip; real phones. Checked: anonymous pages make no assistant request and show no control (dev server, 2026-10-08); header gaps unchanged at 768px; panel rendered in isolation at desktop and 375px (no horizontal overflow, 44px controls); clean notice when the function is unreachable.
- **Recurring Paid:** signed-in tick, untick, schedule edit and persistence. The reviewer's blocker (a schedule edit overwrote the Paid tick) was fixed; the fix is not re-reviewed. The cron v13 run (first night 2026-10-09) is not yet observed.
- **Loading recovery:** isolated checks passed (15 s slow fallback, simulated render error, reload restart). Auto-retry is unit-tested, not browser-tested signed in. Probes: DB gateway 146 ms, permission response 42501 in 471 ms, dashboard module 5 ms; no sustained timeout reproduced.
- **Finance:** 3,770-row signed-in load, Confirm all, 12 px charts, row-save. Goals, debts, holidays, scores, memberships, emergency toggle and course-end saves unverified. Capgemini/UCL December early-pay matching verified locally; live rows existed at 21:55 UTC. OceanInfinity 2026-06-30 unmatched, not investigated.
- **Watchlist:** anonymous browser showed 889 movies and 296 TV shows; no news request errors. Multi-page (>1,000 rows) proven by curl only. The 7 Oct three-part night is in sync_log (shards 0/1/2 success, 393/397/394 items, 17–22 s each). Mid-July marks: 10 of ~400; sync-race fix `91e98584` unconfirmed in production.
