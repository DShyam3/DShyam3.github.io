# State

**Updated:** 2026-09-30 · **Branch:** `feat/watchlist-news-finance-transfers` · **HEAD:** `e4ebf8ec` (= `origin/main`, deployed) · working tree clean

## Deployed 2026-09-30

- **Site:** main@e4ebf8ec, Pages run 36748852458 (earlier today 687bdb3c, run 36680428360). Contains the watchlist review fixes, auth, finance REST timeout and row-save hardening, payslips, EDC, 12px text, responsive dialogs, rounded-lg corners, and:
  - 91e98584 `fix(sync)`: the sync keeps review marks and set categories; the refresh follows a profile switch.
  - 10acd9ff `fix(finance)`: goals, contributions, memberships, debts, scores and holidays save row by row; shared defaults are copied per profile.
  - 8c8973e8 `chore(db)` and 12d37df0 `feat(watchlist)` (backdrops).
- **Edge functions:** truelayer-sync v45 (verify_jwt stays false) and watchlist-cron-sync v11.
- **Migrations applied live:** 20260930070325 (drop finance_seed_backup), 070326 (backdrop column), 072505 (keep_scope triggers, 10 tables in total).
- **Live check, signed out, /watchlist:** 18 `/rest/v1` requests, all 200, including the pinned selects that ask for `backdrop`.
- **Backdrops:** 0 of 1,178 rows filled so far. They fill from the `watchlist-daily-sync` cron (06:00 UTC), first run 2026-10-01; there is a 100 s cap per run, so it may take several runs.
- **Countdown:** no title is `pinned`, so the countdown (and its backdrop) is hidden. The pin UI is not built (8.D).

**Decisions closed today (owner approved 2026-09-30):**
- Corners: unify on rounded-lg (14px, token-based, not 12px Tailwind)
- Public direction: self-host template; demo stays private
- Shared defaults: copy per profile + DB trigger; transactions/bank accounts stay read-only
- Whole-collection saves → row-level saves for six tables

**Also done 2026-09-30:** Supabase secret OTHER_SECRET unset (no references). No blank payslip row exists live (only September payslip is 2026-09-30, complete); nothing deleted.

**NOT verified:** Opus reviewer's blocker and four risks on 10acd9ff fixed with tests but NOT re-reviewed. Finance saves (goals, debts, holidays, scores, memberships, emergency fund toggle, course end date); 12px charts; row-save screen. Signed in. Mid-July transaction marks: 10 of ~400 marked (sync race fixed in 91e98584, deployed).

## Last green checks — 2026-09-30

| Check | Date | Result |
|---|---|---|
| Lint / typecheck / typecheck:functions / build | 2026-09-30 | 0e/0w, all pass |
| Vitest 47 files 906 tests | 2026-09-30 | pass |
| ship-check | 2026-09-30 | 92/100 Beta; zero critical |

## Next

1. Owner checks signed in: Finance saves, 12px charts, row-save screen, marks
2. Confirm mid-July marks in production
3. After 2026-10-01 06:00 UTC: backdrop count climbing; pin a title to see the countdown.
4. Remaining plan items from REHAUL_PLAN.md Part 2

**Still open:** Four reference tables (delete-then-insert), addDebtObservation not queued, logout race, load deadline blocking, timed-out delete in grace window, sync overwrites mid-set category, token refresh not limited, failed profile-switch load.
