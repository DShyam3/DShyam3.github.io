# State

Updated 2026-11-21. Branch `claude/beautiful-hawking-f6254a`, rebased on `origin/main` (`7deea8d8`). Head is `261065c4` plus the docs commit that records it. Not merged to `main`, not pushed, nothing deployed. Local `main` is at `61ba81de`.

## Discover ordering by last activity (on this branch only)

Closed in code: `eddd5532`. Discover's `HAVE YOU ALREADY WATCHED?` now orders collections by an owner-activity stamp (`last_activity_at` on `movies` and `tv_shows`, set by triggers), not by row id. Decision in `REHAUL_HISTORY.md` ("Discover orders collections by an owner-activity stamp", 2026-11-20).

## Cron sync revert of a mid-run watch (on this branch only)

Fixed in code: `261065c4`. The `watchlist-cron-sync` episode upsert no longer sends `watched`, so a watch made during a sync run is no longer reverted, its `watched_at` is no longer cleared, and the show's `last_activity_at` is no longer stamped by the sync. New episodes still arrive unwatched (column default). NOT deployed. Unverified against a real run.

## Still open

1. Migration `20261120230000_watchlist_last_activity.sql` is NOT applied to the live project `yvtiybyuifkiwyrnjebe`. It needs the owner's explicit OK. Order: apply the migration, then merge and push. The frontend falls back without the column, so either order is safe, but until the migration is live every collection is untouched and the order is row id.
2. Not merged to `main`, not pushed.
3. Design questions (`REHAUL_PLAN.md` item 9): (a) hiding or Stopped-watching a title stamps it and raises its collection; (b) a history import stamps every imported title with one `now()`.
4. Cron sync (`REHAUL_PLAN.md` item 10):
   - (a) `watchlist-cron-sync` is not deployed. `supabase functions deploy watchlist-cron-sync` needs the owner's OK. It is independent of the migration. Until it is deployed the mid-run revert stays live.
   - (b) Season-deletion guard, found in review, NOT fixed. `watchedEpisodes` is a start-of-run snapshot, so an episode watched mid-run does not protect its season from the `tv_show_seasons` delete (~`index.ts:1129`), which cascades to the episode.
5. Browser check of Discover order on the owner's data: not run (`REHAUL_PLAN.md` item 11).

## Checks

Read from the session on 2026-11-21, on the tree at `261065c4`:

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm test` | pass, 2,895 tests |
| `npm run build` | pass |
| `supabase/tests/watchlist_last_activity.sql` | pass, 18 assertions, LOCAL stack only, via a scratch copy (the local stack stops at `20261111223000`; the copy adds the score columns and swaps `paused` for `stopped`). The race assertion was shown to fail with the old payload. Unverified against a fully migrated database |
| `graphify update .` | not run |
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
2. Owner's OK to deploy `watchlist-cron-sync` (independent of step 1).
3. Decide plan item 9 (a) and (b). Fix plan item 10(b), the season-deletion guard, in its own commit.
4. Browser-check Discover order on the owner's data once the migration is live (plan item 11).

## Blockers

- The migration and the function deploy each need the owner's explicit OK before they touch the live project.
- Revolut bank access renewal.
