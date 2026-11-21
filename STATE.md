# State

Updated 2026-11-21. Branch `claude/beautiful-hawking-f6254a`, rebased on `origin/main` (`7deea8d8`). Head is `f99bbc8a` plus the docs commit that records it. Not merged to `main`, not pushed, nothing deployed. Local `main` is at `61ba81de`.

## Discover ordering by last activity (on this branch only)

Closed in code: `eddd5532`. Discover orders collections by an owner-activity stamp, not row id. Decision in `REHAUL_HISTORY.md` (2026-11-20).

## Cron sync (on this branch only)

Both fixes in code, NOT deployed, unverified against a real run.

- `261065c4`: episode upsert no longer sends `watched`, so a mid-run watch is not reverted.
- `f99bbc8a`: season delete re-reads watched episodes first and keeps any season with one. Checked on the LOCAL stack only, via fixture rows. No automated test covers the function.
- Open, not fixed (`REHAUL_PLAN.md` item 10 b to d): watched episodes and ratings deleted; rated-then-unwatched seasons deleted; Season 0 specials deleted unchecked.

## Still open

1. Migration `20261120230000_watchlist_last_activity.sql` is NOT applied to the live project `yvtiybyuifkiwyrnjebe`. It needs the owner's explicit OK. Order: apply the migration, then merge and push. The frontend falls back without the column, so either order is safe, but until the migration is live every collection is untouched and the order is row id.
2. Design questions (`REHAUL_PLAN.md` item 9): (a) hiding or Stopped-watching a title stamps it and raises its collection; (b) a history import stamps every imported title with one `now()`.
3. Cron sync not deployed (`REHAUL_PLAN.md` item 10 a); the open items above are item 10 b to d.
4. Browser check of Discover order on the owner's data: not run (`REHAUL_PLAN.md` item 11).

## Checks

Read from the session on 2026-11-21. Rows 1 to 4 at `f99bbc8a`; row 5 at `261065c4`.

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck:functions` | pass |
| `deno test supabase/functions/_shared` | pass, 29 |
| `npm test` | pass, 2,895 (run before the last small function edit) |
| `npm run typecheck`, `npm run build` | pass (`261065c4`) |
| `supabase/tests/watchlist_last_activity.sql` | pass, 18 assertions, LOCAL stack only, via a scratch copy (the local stack stops at `20261111223000`). Unverified against a fully migrated database |
| `graphify update .` | not run |
| `npm run ship-check` | not run |

## On main, not verified here

- Pushed earlier, awaiting a live browser check after the Pages deploy: `/dev` dashboard, API/cron telemetry, Discover franchise retry fixes, Franchises expansion, Watchlist News layout (`5296949c`, `a9e161c1`, `ec1fd147`).
- Hex review fixes (`7deea8d8`): phone pinch to 32x, phone GPU memory and high-refresh frame rate not verified. No `reviewer` pass recorded.
- Not Interested dimming on Franchises committed in `61ba81de`. The signed-in owner path is covered by lint, typecheck and tests only.
- Edge functions deployed and `20261120201500_api_usage_metrics.sql` applied remotely (`yvtiybyuifkiwyrnjebe`), per an earlier note.

## Open, not started

- Marvel as one group (needs a new `tmdb-proxy` universe lookup). Verify the OMDb weekly refresh (~2026-11-25).

## Next

1. Owner's OK, then apply `20261120230000` to the live project; then merge and push this branch.
2. Owner's OK to deploy `watchlist-cron-sync` (both fixes; independent of step 1).
3. Decide plan item 9 (a) and (b), and plan item 10 (b) to (d), before more code changes there.
4. Browser-check Discover order on the owner's data once the migration is live (plan item 11).

## Blockers

- The migration and the function deploy each need the owner's explicit OK before they touch the live project.
- Revolut bank access renewal.
