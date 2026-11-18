# State

Updated 2026-11-18 · `main` at `9ed97370` (with uncommitted local TMDB score persistence changes).

## Landed in local tree (uncommitted, not yet pushed/deployed)

- **Watchlist TMDB score persistence (`tmdb_rating`, `tmdb_votes`):**
  - Schema & migration: `supabase/schemas/20_watchlist.sql`, `supabase/migrations/20261118221500_watchlist_tmdb_scores.sql` (adds `tmdb_rating` `numeric(3,1)` and `tmdb_votes` `integer` with check constraints on `movies` and `tv_shows`). **Not yet applied to hosted Supabase.**
  - Client types, queries, and writes: `src/integrations/supabase/types.ts`, `src/features/watchlist/library-query.ts`, `src/features/watchlist/WatchlistContext.tsx`, `src/features/watchlist/new-item.ts`, `src/features/watchlist/discovery-add.ts`, `src/features/watchlist/components/WatchlistDetailDialog.tsx`.
  - Nightly sync: `supabase/functions/watchlist-cron-sync/index.ts` reads/dirty-checks/updates `tmdb_rating` and `tmdb_votes`. **Pending deploy to hosted Supabase.**

## Landed on `main` (pushed, edge functions still pending deploy)

- `9ed97370` — TMDB score and colour-coded badges in `TitleScores`.
- `6044e543` — Watchlist loading, caching, update/resync, and `tmdb-proxy` / `watchlist-cron-sync` performance pass (`tmdb-proxy` and `watchlist-cron-sync` still pending deploy to hosted Supabase).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| Vitest (`32` files / `474` tests) | pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| Migration `20261118221500_watchlist_tmdb_scores.sql` | **not yet applied** to hosted Supabase |
| Edge functions deploy (`watchlist-cron-sync`, `tmdb-proxy`) | **not yet deployed** to hosted Supabase |
| Browser | not run against production for the new commit / local changes |

## Next

1. Apply `supabase/migrations/20261118221500_watchlist_tmdb_scores.sql` to hosted Supabase (unapplied).
2. Commit and push the local TMDB score persistence changes on `main`.
3. Deploy `watchlist-cron-sync` and `tmdb-proxy` to hosted Supabase (`npx supabase functions deploy tmdb-proxy watchlist-cron-sync --remote=yvtiybyuifkiwyrnjebe`).
4. Verify GitHub Pages deploy and browser-verify Discover, Franchises, Library adds/favourites/resyncs, and stored TMDB scores.
5. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`), `tmdb_rating`/`tmdb_votes` backfill, and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unapplied / pending deploy:** `supabase/migrations/20261118221500_watchlist_tmdb_scores.sql` (unapplied to hosted Supabase); `watchlist-cron-sync` and `tmdb-proxy` (pending deploy to hosted Supabase); local TMDB score persistence edits (uncommitted).
- **Unverified:** Production browser checks for the Watchlist performance pass and TMDB score persistence; signed-in admin flows; light mode; phone viewport.
- **Blockers:** Hosted Supabase migration + function deploys require confirmation (`--yes`); untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`) in local checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
