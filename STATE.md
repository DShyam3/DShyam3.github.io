# State

Updated 2026-11-21. Branch `claude/beautiful-hawking-f6254a`, head `1f63bea1` (local, not pushed), on origin/main `2d414851`. The Discover ordering work is on main as `36324d8d`.

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`): not committed, not deployed. Was `git stash@{0}`; on 2026-11-21 no stash entry is labelled for it (the list shows `autostash` and older), so re-find it before use. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.

## Local, not pushed

- `1f63bea1` `fix(watchlist-cron-sync): never delete a season or episode the owner watched or rated`, and the docs commit on top of it. Not pushed, not deployed. The owner approved the fix and its trade-off; the push and the deploy still need the owner's OK.

## Live since 2026-11-21

- Discover ordering by last activity (`31819643`, on main as `36324d8d`, Pages run `44899327331`). Migration `20261120230000_watchlist_last_activity.sql` applied to `yvtiybyuifkiwyrnjebe` with `supabase db push`; recorded in `schema_migrations`. Read-only check: both `last_activity_at` columns, the three triggers, touch functions SECURITY INVOKER with EXECUTE revoked from anon and authenticated. 0 of 1,227 films and 0 of 423 series stamped (no backfill, by design). Advisors: nothing new.
- `watchlist-cron-sync` v27 live, with the episode upsert fix (no `watched`) and the season re-read before delete. Not the watched-or-rated guard (`1f63bea1`, undeployed). Whether a scheduled run has used v27 is not checked.
- Visitor check: library read requests `last_activity_at` and returns 200/206, no fallback. Discover copy reads "Most recent first, by the last time you added, watched, unwatched or re-dated a title in it, or changed its Library visibility." No cards rendered on either attempt. Attempt A stalled at 185 of 219 with tmdb-proxy 429s. Attempt B (the owner's data, 18 of 218) stalled with all 66 calls 200 and no 429s. Cause not diagnosed. Unverified.

## Pushed, awaiting live browser check

- Watchlist: `tvFranchisesFromLinks` respects explicit custom `franchise` overrides and `customFranchisesFromLibrary` strips duplicate trailing `(YYYY)` years (`src/features/watchlist/franchise.ts`); not browser-verified on live.
- Watchlist (`419e3340`): `tv-spinoffs` cache key bumped to `v2`; library items whose custom `franchise` tag matches a TV franchise or film universe merge into that card; not browser-verified on live.
- Watchlist (`747dd7e5`, `354995c2`): Discover poster order, Franchises film universes, merged TV cards, `Largest` | `A–Z` sort, Favourites tab and search, Coming soon priority and `watchlist_collection_upcoming` cache (`20261121130500_watchlist_collection_upcoming.sql` applied); not browser-verified on live.
- Watchlist (`9452aeb3`): Franchises dims titles marked Not interested. Signed-in owner path not verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard and telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).
- Discover paced (`3bde0ecf`): one pacer for Discover's TMDB calls (40/min shared: section pages ≤20, collection walk ≤28); the walk stalling at "18 of 218" behind section pages is fixed in `48bdbdcf`. Also walk-stall and failed-batch fixes, 404 collections make no card, Likely seen order fixed once suggestions settle, YOU MIGHT LIKE stops after two empty rounds, Franchises search across every collection. Timing, a cached revisit and the signed-in owner path are not browser-verified.
- On origin/main: Discover loading line (`989989d9`), Travel hovered-hex outline and two-minute globe lock (`1046d14b`), GeoNames town names with "near" towns (`b0e93952`), docs(plan) Discover activity-stamp closure (`5ab1f560`).

## Still open

- YOU MIGHT LIKE stays empty for the owner: all 1,120 suggestions from the first 28 seeds are already in the library, favourited or among 1,655 dismissals. Needs a decision on digging deeper per seed.
- Discover order on the signed-in owner's data (`REHAUL_PLAN.md` item 11): not run. Both visitor attempts above stalled before the cards; the walk needs looking at.
- Cron sync (`REHAUL_PLAN.md` item 10): (a) deploy `watchlist-cron-sync` from `1f63bea1` and push it, owner's OK needed; (b) the season delete is not atomic, so a watch or rating made between the read and the delete can still cascade away. A SQL-function fix would be a migration (`migration` agent), optional.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate). Hovered-hex outline, two-minute globe lock, GeoNames town names, "near" fallback, and the sea and land colours not yet checked on the live site. Regenerating hex data needs GeoNames' cities1000.zip unzipped into `.cache/geonames/`.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks

| Check | Result |
|---|---|
| `npm run lint` | pass 2026-11-21 on `1f63bea1`, run this session: 0 errors, 0 warnings |
| `npm run typecheck`, `npm run typecheck:functions` | pass 2026-11-21, reported by the cron session; not re-run here |
| `npm run test:functions` (`deno test supabase/functions/_shared/`) | 34 pass 2026-11-21, reported (5 new in `owner-data.test.ts`); first time in CI and deploy |
| `npm test` | 2,926 pass 2026-11-21, reported. One earlier run on a rebased tree failed 1 unidentified test (flaky, unverified) |
| `npm run build` | pass 2026-11-21, reported |
| Local-stack run of `owner-data` against the real module | pass 2026-11-21, reported; temporary `watchlist_ratings` table removed afterwards |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Owner: approve pushing `1f63bea1` and deploying `watchlist-cron-sync`.
2. Diagnose the Discover walk stall on live, then check the owner's order (item 11).
3. Browser-verify live after Pages deploys: custom `franchise` override and year-dedupe, `tv-spinoffs` v2, Franchises universes and merged cards, Favourites, Coming soon priority.
4. The `/dev` stash: re-find it, run `reviewer`, commit by path.

## Blockers

- Uncommitted `/dev` files and `DotMatrixGlobe.tsx` from other sessions must stay separate. Revolut bank access renewal.
- The flaky `npm test` failure above is unidentified.
