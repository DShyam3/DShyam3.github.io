# State

Updated 2026-11-22. Branch `claude/xenodochial-elgamal-c40ce2`, rebased on `709a56f4` and pushed to origin/main as `5299a8c7` (Discover's collection walk reads a nightly parts cache). Pages run `45059621340` succeeded; the live site serves it.

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`): not committed, not deployed. Was `git stash@{0}`; no stash entry is labelled for it now, so re-find it before use. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.

## Live

- Collection parts cache (`5299a8c7`): migration `20261122170000_watchlist_collection_parts.sql` applied to `yvtiybyuifkiwyrnjebe` via MCP, recorded version set to 20261122170000 to match the file. Advisors: nothing new. Table holds 218 of 218 collections, 672 parts.
- `watchlist-cron-sync` v29 deployed (CLI, verify_jwt true). It replaces v28 and keeps the watched-or-rated guard. Shards 0-2 run by hand ~16:58-17:00Z: all success, 0 failed titles, 0 changes. Shard 1 reported 615 of 616 items synced (not investigated).
- Discover ordering by last activity (`31819643`, main `36324d8d`): migration `20261120230000_watchlist_last_activity.sql` applied; 0 of 1,227 films and 0 of 423 series stamped (no backfill, by design). Advisors: nothing new.
- Local check against live (dev server :8082, signed out, IndexedDB deleted then navigated in the same tick): 0 collection calls through tmdb-proxy on every fresh load. Films view under 6s. All with a cold Wikidata spin-off lookup 19.8s, of which ~17.5s waited on `wikidata/tv-spinoffs` (collections took 0.25s). All with that lookup in the HTTP cache under 6.4s. End state unchanged.
- Live check (dshyam3.github.io, signed out, fresh, ~19:27Z): 0 collection calls through tmdb-proxy, one parts read (193ms), walk done 5.1s after the HTML arrived. `wikidata/tv-spinoffs` returned 502 (Wikidata upstream, per function logs), so the section showed its "couldn't load" line; Retry got 200 in 9.5s and the end state matched (no cards). The 17.5s local wait at 19:01Z was a Wikidata sibling-lookup timeout (logs). Signed-in owner path not checked.
- Dev ports on tmdb-proxy's origin allowlist: 8080, 8081, 8082, 5173 (8086 fails CORS).

## Pushed, awaiting live browser check

- Discover paced (`3bde0ecf`): one pacer for Discover's TMDB calls (40/min shared: section pages ≤20, collection walk ≤28). Walk-stall fix `48bdbdcf`. The collection walk no longer waits on tmdb-proxy for cached collections, so timing is seconds, not minutes (see Live). Signed-in owner path not browser-verified.
- Visitor check (2026-11-21), superseded for collections: library read returned `last_activity_at` (200/206); the tmdb-proxy 429 stalls were before the parts cache. Not re-checked on live.
- Watchlist: `tvFranchisesFromLinks` respects custom `franchise` overrides and `customFranchisesFromLibrary` strips duplicate trailing `(YYYY)` years (`src/features/watchlist/franchise.ts`); not browser-verified on live.
- Watchlist (`419e3340`): `tv-spinoffs` cache key bumped to `v2`; library items whose custom `franchise` tag matches a TV franchise or film universe merge into that card; not browser-verified on live.
- Watchlist (`747dd7e5`, `354995c2`): Discover poster order, Franchises film universes, merged TV cards, `Largest` | `A–Z` sort, Favourites tab and search, Coming soon priority and `watchlist_collection_upcoming` cache (`20261121130500_watchlist_collection_upcoming.sql` applied); not browser-verified on live.
- Watchlist (`9452aeb3`): Franchises dims titles marked Not interested. Signed-in owner path not verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- Launch checklist fixes (Checks 3, 4, 7, 9, `709a56f4`): per-route metadata, sitemap, JSON-LD, one `<h1>` per page, 404 copy, modal focus and reduced-motion. Manual live checks open: phone pass (Check 1), mobile PageSpeed (Check 5), `umami.disabled` in owner browsers (Check 6), private-window walkthrough (Check 10).
- MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard and telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).

## Still open

- Fresh visitor in All still waits for the Wikidata TV spin-off lookup: a 17.5s timeout in one sample, a 502 in another, 9.5s on retry. A follow-up to cache spin-off links server-side is proposed, not started.
- YOU MIGHT LIKE stays empty for the owner: all 1,120 suggestions from the first 28 seeds are already in the library, favourited or among 1,655 dismissals. Needs a decision on digging deeper per seed.
- Discover order on the signed-in owner's data (`REHAUL_PLAN.md` item 11): the stall was fixed in `48bdbdcf`; the order check has not been re-run.
- Cron sync (`REHAUL_PLAN.md` item 10): (b) the season delete is not atomic, so a watch or rating made between the read and the delete can still cascade away; a SQL-function fix would be a migration (`migration` agent), optional. (c) Only the `_shared/owner-data.ts` helpers are unit-tested; the function is not.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate). Hovered-hex outline, two-minute globe lock, GeoNames town names, "near" fallback, sea and land colours not yet checked on the live site. Regenerating hex data needs GeoNames' cities1000.zip unzipped into `.cache/geonames/`.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings, 2026-11-22, tree at `5299a8c7` |
| `npm run typecheck`, `npm run typecheck:functions` | pass, 2026-11-22, tree at `5299a8c7` |
| `npm test` | 2,940 pass, 2026-11-22 |
| `npm run test:functions` | 39 pass, 2026-11-22 |
| `npm run build` | pass, 2026-11-22 |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Watch the scheduled 06:00-06:20Z `watchlist-cron-sync` run: `watchlist_collection_parts` `synced_at` advances, and the v29 guard keeps a watched or rated episode (unverified until a run deletes something).
2. Discover order check on the owner's data (item 11).
3. Browser-verify live after Pages deploys: custom `franchise` override and year-dedupe, `tv-spinoffs` v2, Franchises universes and merged cards, Favourites, Coming soon priority.
4. The `/dev` stash: re-find it, run `reviewer`, commit by path.

## Blockers

- Uncommitted `/dev` files and `DotMatrixGlobe.tsx` from other sessions must stay separate. Revolut bank access renewal.
