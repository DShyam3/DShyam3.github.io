# State

Updated 2026-11-18 · `main` at `3ceece66` (with uncommitted local UK bank holidays changes, ready to commit/push).

## Landed in local tree (uncommitted, ready to commit/push)

- **UK bank holidays Supabase storage & monthly refresh:**
  - Schema & migration: `supabase/schemas/40_finance.sql`, `supabase/migrations/20261118223000_uk_bank_holidays.sql` (`uk_bank_holidays` table, RLS, grants, monthly `pg_cron` job `0 5 1 * *` at 05:00 UTC on the 1st). **Not yet applied to hosted Supabase.**
  - Edge function: `supabase/functions/sync-bank-holidays/index.ts` (fetches `gov.uk/bank-holidays.json` server-side for `england-and-wales`, `scotland`, `northern-ireland`). **Pending deploy to hosted Supabase.**
  - Client: `src/integrations/supabase/types.ts`, `src/features/finance/FinanceDataContext.tsx` (reads `uk_bank_holidays` from Supabase instead of fetching `gov.uk` in the browser, keeping `resolveBankHolidaysForYear` as fallback).

## Landed on `main` (pushed, DB/edge functions still pending)

- `3ceece66` — Watchlist TMDB score persistence (`tmdb_rating`, `tmdb_votes`) and `watchlist-cron-sync` updates (`20261118221500_watchlist_tmdb_scores.sql` still unapplied; `watchlist-cron-sync` still pending deploy).
- `9ed97370` — TMDB score and colour-coded badges in `TitleScores`.
- `6044e543` — Watchlist loading, caching, update/resync, and `tmdb-proxy` / `watchlist-cron-sync` performance pass (`tmdb-proxy` and `watchlist-cron-sync` still pending deploy).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| Vitest (`14` files / `210` tests) | pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| Migrations `20261118221500_watchlist_tmdb_scores.sql`, `20261118223000_uk_bank_holidays.sql` | **not yet applied** to hosted Supabase |
| Edge functions (`watchlist-cron-sync`, `tmdb-proxy`, `sync-bank-holidays`) | **not yet deployed** to hosted Supabase |
| Browser | not run against production for recent Watchlist commits or local Finance changes |

## Next

1. Commit and push the local UK bank holidays changes (and docs) on `main`.
2. Apply `supabase/migrations/20261118221500_watchlist_tmdb_scores.sql` and `supabase/migrations/20261118223000_uk_bank_holidays.sql` to hosted Supabase (both unapplied).
3. Deploy `watchlist-cron-sync`, `tmdb-proxy`, and `sync-bank-holidays` to hosted Supabase (`npx supabase functions deploy tmdb-proxy watchlist-cron-sync sync-bank-holidays --remote=yvtiybyuifkiwyrnjebe`), and trigger an initial `sync-bank-holidays` run so `uk_bank_holidays` is populated before the 1st-of-month cron.
4. Verify GitHub Pages deploy and browser-verify Finance Holiday Tracker bank holidays plus Watchlist Discover, Franchises, Library, and stored TMDB scores.
5. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`), `tmdb_rating`/`tmdb_votes` backfill, and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unapplied / pending deploy:** `20261118221500_watchlist_tmdb_scores.sql` and `20261118223000_uk_bank_holidays.sql` (unapplied to hosted Supabase); `watchlist-cron-sync`, `tmdb-proxy`, and `sync-bank-holidays` (pending deploy to hosted Supabase); local UK bank holidays edits (uncommitted).
- **Unverified:** Production browser checks for Watchlist performance/TMDB score persistence and Finance Supabase bank holidays; signed-in admin flows; light mode; phone viewport.
- **Blockers:** Hosted Supabase migrations + function deploys require confirmation (`--yes`); untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`) in local checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
