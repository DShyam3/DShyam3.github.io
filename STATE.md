# State

Updated 2026-11-20. Branch `claude/beautiful-hawking-f6254a`, one commit (`eddd5532`) ahead of `main`, plus this docs commit. Not merged to `main`, not pushed. `main` is at `61ba81de`.

## Discover ordering by last activity (on this branch only)

Closed in code: `eddd5532`. Discover's `HAVE YOU ALREADY WATCHED?` now orders collections by an owner-activity stamp (`last_activity_at` on `movies` and `tv_shows`, set by triggers), not by row id. Decision in `REHAUL_HISTORY.md` ("Discover orders collections by an owner-activity stamp", 2026-11-20).

Still open, not promoted:
1. Migration `20261120230000_watchlist_last_activity.sql` is NOT applied to the live project `yvtiybyuifkiwyrnjebe`. It needs the owner's explicit OK. Order: apply the migration, then merge and push. The frontend falls back without the column, so either order is safe, but until the migration is live every collection is untouched and the order is the old row-id order.
2. Not merged to `main`, not pushed.
3. Open design questions (`REHAUL_PLAN.md` item 9): (a) hiding or Stopped-watching a title stamps it and raises its collection; (b) a history import stamps every imported title with one `now()`, so imported collections rise together.
4. Pre-existing bug (`REHAUL_PLAN.md` item 10), unverified against a real run: `watchlist-cron-sync` episode upsert can revert an owner's watch made during a run, and the revert stamps `last_activity_at`. Fix: stop sending `watched` for existing episodes.
5. Browser check of Discover order not done.

Checks for `eddd5532`, read from the session on 2026-11-20:

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm test` | pass, 2,891 tests |
| `npm run build` | pass |
| `supabase/tests/watchlist_last_activity.sql` | pass, 15 assertions, LOCAL stack only. The local stack stops at `20261111223000`, so the run used a scratch copy that added the missing score columns and swapped `paused` for `stopped`. Unverified against a fully migrated database |
| `graphify update .` | not run (no graph in this worktree) |
| `npm run ship-check` | not run |

## On main, not verified here

- Pushed earlier, awaiting a live browser check after the Pages deploy: `/dev` dashboard, API/cron telemetry, Discover franchise retry fixes, Franchises expansion, Watchlist News layout (`5296949c`, `a9e161c1`, `ec1fd147`).
- Hex review fixes committed in `7deea8d8`. Phone or touch pinch to 32x, GPU memory on phones, and frame rate on a high-refresh screen are not verified. The `reviewer` pass on that diff is not recorded as done.
- Not Interested dimming on Franchises committed in `61ba81de`. The signed-in owner path is covered by lint, typecheck and tests only.
- Edge functions deployed and `20261120201500_api_usage_metrics.sql` applied remotely (`yvtiybyuifkiwyrnjebe`), per an earlier note.

## Open, not started

- Marvel as one group (needs a new `tmdb-proxy` universe lookup).
- Verify the OMDb weekly refresh (~2026-11-25).

## Next

1. Owner's OK, then apply `20261120230000` to the live project; then merge and push this branch.
2. Decide plan item 9 (a) and (b). Fix plan item 10 in its own commit.
3. Browser-check Discover order on the owner's data once the migration is live (plan item 11).

## Blockers

- The migration needs the owner's explicit OK before it touches the live project.
- Revolut bank access renewal.
