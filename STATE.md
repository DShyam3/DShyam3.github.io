# State

Updated 2026-11-21. Branch `claude/beautiful-hawking-f6254a`, code head `989989d9` (local, not pushed). origin/main is `73fb6c14`, which includes the Discover ordering work (`36324d8d`).

## Uncommitted in the tree (other sessions)

- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `src/features/dev/api-status.test.ts`; held in `git stash@{0}`): not committed, not deployed. Browser-verified locally (`npm run dev:test`, port 8085). Not verified: live data, light theme, phone width; `reviewer` not yet run.

## Local, not pushed

- `989989d9`: Discover loading line now reads "most recent first" (`src/features/watchlist/components/DiscoverySection.tsx`). Committed, not pushed to origin.

## Live since 2026-11-21

- Discover ordering by last activity (`31819643`, on main as `36324d8d`, Pages run `44899327331`). Migration `20261120230000_watchlist_last_activity.sql` applied to `yvtiybyuifkiwyrnjebe` with `supabase db push`; recorded in `schema_migrations`. Read-only check: both `last_activity_at` columns, the three triggers, touch functions SECURITY INVOKER with EXECUTE revoked from anon and authenticated. 0 of 1,227 films and 0 of 423 series stamped (no backfill, by design). Advisors: nothing new.
- `watchlist-cron-sync` v27 live, both fixes in it: no `watched` in the episode upsert; season re-read before delete. v25 was deployed from this branch; v27 (another session) was downloaded and read. Whether a scheduled run has used it is not checked.
- Visitor check: library read requests `last_activity_at` and returns 200/206, no fallback. Discover copy reads "Most recent first, by the last time you added, watched, unwatched or re-dated a title in it, or changed its Library visibility." No cards rendered: the collection scan stalled at 185 of 219 with tmdb-proxy 429s. Cause unconfirmed (likely the 60/min per-visitor limit used by the checks). Unverified.

## Pushed, awaiting live browser check

- Watchlist: `tvFranchisesFromLinks` respects explicit custom `franchise` overrides (excluding reassigned shows from Wikidata's group) and `customFranchisesFromLibrary` strips duplicate trailing `(YYYY)` years (`src/features/watchlist/franchise.ts`, `franchise.test.ts`); not yet browser-verified on live.
- Watchlist (`419e3340`): bumped `tv-spinoffs` query cache key to `v2` (`useTMDB.ts`, `WatchlistFranchises.tsx`, `useDiscovery.ts`) and merged library items whose custom `franchise` tag matches an existing TV franchise or film universe name into that card; not yet browser-verified on live.
- Watchlist (`747dd7e5`): Discover poster-order fix (`useDiscovery.ts`, `DiscoverySection.tsx`), Franchises shared film universes / merged TV franchise cards / `Largest` | `A–Z` sort, and `tmdb-proxy` Pass 2 sibling TV franchise expansion (deployed `--no-verify-jwt`); not yet browser-verified on live.
- Watchlist (`354995c2`): Favourites tab & search, Franchises search clear pills and padding, franchise undated-filtering, Coming soon priority & `watchlist_collection_upcoming` cache (`20261121130500_watchlist_collection_upcoming.sql` applied); not yet browser-verified on live.
- Watchlist: Franchises dims titles marked Not interested (`9452aeb3`). Signed-in owner path not browser-verified; open: a dismissed title can still be named "Next up" on a collapsed card, and the poster strip does not dim it.
- MCU card (`30e0a877`), Travel hex size control (`3220ab6b`), `/dev` dashboard & telemetry (`5296949c`, `a9e161c1`, `ec1fd147`).

## Still open

- Discover order on the signed-in owner's data (`REHAUL_PLAN.md` item 11): not run. The visitor scan above did not reach the cards.
- Cron sync, `REHAUL_PLAN.md` item 10 (b)–(d): episode-level delete drops watched episodes and their ratings; rated-then-unwatched seasons deleted with ratings; Season 0 specials deleted unchecked. Owner to decide.
- Design questions (`REHAUL_PLAN.md` item 9): hiding/Stopped-watching stamping `last_activity_at`; history import stamping all imported titles with one `now()`.
- `989989d9` to push to origin/main: not pushed.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, high-refresh frame rate). Travel hovered-hex outline, two-minute globe lock, GeoNames town names and "near" fallback not yet checked on the live site. Regenerating hex data needs GeoNames' cities1000.zip unzipped into `.cache/geonames/`.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Checks (2026-11-21, on `989989d9`)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 2,920 pass. One earlier run on a rebased tree failed 1 test, then passed 4 runs in a row; the test was not identified (flaky, unverified) |
| `npm run build` | pass |
| `npm run typecheck:functions` | earlier pass 2026-11-21; not re-run |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Browser-verify live after Pages deploys: custom `franchise` override & year-dedupe, `tv-spinoffs` v2 cache & tag merge, Discover poster order and order on the owner's data, Franchises universes / merged TV cards / `Largest` sort, Favourites tab/search, clear-search pill, padding & undated filtering, Coming soon priority.
2. Push `989989d9` once the owner agrees.
3. Pop `git stash@{0}` for `/dev` (3 files), run `reviewer`, then commit by path.

## Blockers

- Uncommitted `/dev` (`git stash@{0}`) and `DotMatrixGlobe.tsx` files from other sessions must stay separate. Revolut bank access renewal.
- The flaky `npm test` failure above is unidentified.
