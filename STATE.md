# State

**Updated:** 2026-09-30 · **Branch:** `feat/watchlist-news-finance-transfers` · **HEAD:** `12d37df0` · **origin/main:** `687bdb3c` (deployed)

## Deployed — main@687bdb3c, Pages run 36680428360

Watchlist 2026-09-14 review fixes (1e4e2628), auth (7e0a6e66), finance REST timeout + row-save hardening (1cfccbd5), payslips (880aa082), EDC (f9842df8), 12px text (50d41ae6), responsive dialogs and focus rings (45f854f5), corners unified on rounded-lg (687bdb3c). Checked signed out on /watchlist.

## Locally committed, NOT deployed — 4 commits ahead, awaiting approval

- 91e98584 `fix(sync)`: truelayer-sync no longer writes is_reviewed or overwrites existing category; useTrueLayer refreshes profile
- 10acd9ff `fix(finance)`: goals, contributions, memberships, debts, scores, holidays save row by row; shared defaults copy per profile
- 8c8973e8 `chore(db)`: migrations 20260930070325 (drop finance_seed_backup) and 072505 (keep_scope triggers on 7 more tables). APPLIED LIVE 2026-09-30, verified.
- 12d37df0 `feat(watchlist)`: backdrop column (migration 20260930070326, APPLIED LIVE), cron-sync and add-flow store TMDB backdrops, countdown shows backdrop ?? poster. Cron and truelayer-sync edge functions NOT DEPLOYED.

**Decisions closed today (owner approved 2026-09-30):**
- Corners: unify on rounded-lg (14px, token-based, not 12px Tailwind)
- Public direction: self-host template; demo stays private
- Shared defaults: copy per profile + DB trigger; transactions/bank accounts stay read-only
- Whole-collection saves → row-level saves for six tables

**Also done 2026-09-30:** Supabase secret OTHER_SECRET unset (no references). No blank payslip row exists live (only September payslip is 2026-09-30, complete); nothing deleted.

**NOT verified:** Opus reviewer's blocker and four risks on 10acd9ff fixed with tests but NOT re-reviewed. Finance saves (goals, debts, holidays, scores, memberships, emergency fund toggle, course end date); 12px charts; row-save screen. Signed in. Mid-July transaction marks: 10 of ~400 marked (sync race fixed in 91e98584, not deployed).

## Last green checks — 2026-09-30

| Check | Date | Result |
|---|---|---|
| Lint / typecheck / typecheck:functions / build | 2026-09-30 | 0e/0w, all pass |
| Vitest 47 files 906 tests | 2026-09-30 | pass |
| ship-check | 2026-09-30 | 92/100 Beta; zero critical |

## Next

1. Owner approval: push to main; deploy both edge functions (cron any time, TrueLayer after)
2. Owner checks signed in: Finance saves, 12px charts, row-save screen, marks
3. Confirm mid-July marks in production
4. Remaining plan items from REHAUL_PLAN.md Part 2

**Still open:** Four reference tables (delete-then-insert), addDebtObservation not queued, logout race, load deadline blocking, timed-out delete in grace window, sync overwrites mid-set category, token refresh not limited, failed profile-switch load, landscape backdrops edge function deploy pending.
