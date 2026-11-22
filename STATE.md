# State

Updated 2026-11-22. Branch `claude/beautiful-hawking-f6254a`, pushed to origin/main in the same step as the docs commit on top of `4230bbab` (origin/main `48bdbdcf`, then `837670f8` cron owner-data guard, `4230bbab` its docs). Once that push lands the branch is on main. The Discover ordering work is on main as `36324d8d`.

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`): not committed, not deployed. Was `git stash@{0}`; no stash entry is labelled for it now, so re-find it before use. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.

## Live since 2026-11-22

- `watchlist-cron-sync` v28 live on `yvtiybyuifkiwyrnjebe` (verify_jwt true), deployed from this branch (`837670f8` rebased on `48bdbdcf`). Replaces v27. The watched-or-rated guard on every season and episode delete is in it, plus the v27 fixes (no `watched` in the episode upsert; season re-read before delete). Live source downloaded after deploy and matches the branch for `watchlist-cron-sync/index.ts`, `_shared/owner-data.ts`, `_shared/select-all-pages.ts`.
- Not yet seen: a scheduled sync run against v28 (none observed); the guard is unverified against a real run.
- Deploy run `45030694222` (dispatched on `7d2225fd`) passed, including its new `npm run test:functions` step.
- Discover ordering by last activity (`31819643`, on main as `36324d8d`, Pages run `44899327331`). Migration `20261120230000_watchlist_last_activity.sql` applied to `yvtiybyuifkiwyrnjebe`; recorded in `schema_migrations`. 0 of 1,227 films and 0 of 423 series stamped (no backfill, by design). Advisors: nothing new.
- Visitor check (2026-11-21): library read requests `last_activity_at` and returns 200/206. Attempt A stalled at 185 of 219 with tmdb-proxy 429s; attempt B (owner's data, 18 of 218, all 66 calls 200) stalled. The walk stall was fixed in `48bdbdcf`; not re-checked on live.

## Pushed, awaiting live browser check

- Watchlist: `tvFranchisesFromLinks` respects explicit custom `franchise` overrides and `customFranchisesFromLibrary` strips duplicate trailing `(YYYY)` years (`src/features/watchlist/franchise.ts`); not browser-verified on live.
- Watchlist (`419e3340`): `tv-spinoffs` cache key bumped to `v2`; library items whose custom `franchise` tag matches a TV franchise or film universe merge into that card; not browser-verified on live.
- Watchlist (`747dd7e5`, `354995c2`): Discover poster order, Franchises film universes, merged TV cards, `Largest` | `A–Z` sort, Favourites tab and search, Coming soon priority and `watchlist_collection_upcoming` cache (`20261121130500_watchlist_collection_upcoming.sql` applied); not browser-verified on live.
- Watchlist (`9452aeb3`): Franchises dims titles marked Not interested. Signed-in owner path not verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard and telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).
- Discover paced (`3bde0ecf`): one pacer for Discover's TMDB calls (40/min shared: section pages ≤20, collection walk ≤28); the walk stall is fixed in `48bdbdcf`. Also walk-stall and failed-batch fixes, 404 collections make no card, Likely seen order fixed once suggestions settle, YOU MIGHT LIKE stops after two empty rounds, Franchises search across every collection. Timing, a cached revisit and the signed-in owner path are not browser-verified.
- On origin/main: Discover loading line (`989989d9`), Travel hovered-hex outline and two-minute globe lock (`1046d14b`), GeoNames town names with "near" towns (`b0e93952`), docs(plan) Discover activity-stamp closure (`5ab1f560`).

## Still open

- YOU MIGHT LIKE stays empty for the owner: all 1,120 suggestions from the first 28 seeds are already in the library, favourited or among 1,655 dismissals. Needs a decision on digging deeper per seed.
- Discover order on the signed-in owner's data (`REHAUL_PLAN.md` item 11): the stall was fixed in `48bdbdcf`; the order check has not been re-run.
- Cron sync (`REHAUL_PLAN.md` item 10): (b) the season delete is not atomic, so a watch or rating made between the read and the delete can still cascade away; a SQL-function fix would be a migration (`migration` agent), optional. (c) Only the `_shared/owner-data.ts` helpers are unit-tested; the function is not.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate). Hovered-hex outline, two-minute globe lock, GeoNames town names, "near" fallback, and the sea and land colours not yet checked on the live site. Regenerating hex data needs GeoNames' cities1000.zip unzipped into `.cache/geonames/`.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings, reported 2026-11-22 on this tree (deploy session) |
| `npm run typecheck`, `npm run typecheck:functions` | pass, reported 2026-11-22 (deploy session) |
| `npm run test:functions` (`deno test supabase/functions/_shared/`) | 34 pass, 2026-11-22; green in CI (deploy run `45030694222`) |
| `npm test` | 2,929 pass, reported 2026-11-22. An earlier run on a rebased tree failed 1 unidentified test (flaky, unverified) |
| `npm run build` | pass, reported 2026-11-22 |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Watch the scheduled `watchlist-cron-sync` run against v28; confirm the guard keeps a watched or rated episode.
2. Discover order check on the owner's data (item 11).
3. Browser-verify live after Pages deploys: custom `franchise` override and year-dedupe, `tv-spinoffs` v2, Franchises universes and merged cards, Favourites, Coming soon priority.
4. The `/dev` stash: re-find it, run `reviewer`, commit by path.

## Blockers

- Uncommitted `/dev` files and `DotMatrixGlobe.tsx` from other sessions must stay separate. Revolut bank access renewal.
