# State

Updated 2026-11-21. Worktree branch `claude/sleepy-solomon-a6e0fc`; head is `main` at `ec4a3578` plus this docs commit (local, not pushed; the main session pushes).

## Closed 2026-11-21

- Marvel Cinematic Universe as one Discover card: `30e0a877` (feature), `bb4a079a` (docs). On `main` and live on GitHub Pages. A universe lists its films in release order; a collection it lists in full is folded in; a collection with films outside it (Deadpool) keeps its own card. Visitors' franchise cards read only visible library rows.
- `tmdb-proxy` deployed to Supabase project `yvtiybyuifkiwyrnjebe`, now version 22, `verify_jwt` false (`--no-verify-jwt`). Live v21 was diffed against `origin/main` first: identical except `_shared/api-usage.ts`; v22 ships main's version.
- Live smoke test: `wikidata/film-universes` 200 in ~4.2 s, 45 MCU films, 42 with poster and date. The 3 undated (Armor Wars, untitled Shang-Chi sequel, Blade) are left off the client unless owned. `movie/1726` 200, `wikidata/tv-spinoffs?ids=1418` 200, `account/1` 403 (disallowed).
- Live browser check as a visitor, `https://dshyam3.github.io/watchlist` → Discover: the MCU card renders "29 of 41 watched · 6 not in library · Gap in series", "Next up: The Incredible Hulk", posters in release order (Iron Man, The Incredible Hulk, Iron Man 2, Thor, ...). New section intro copy is live. `wikidata/film-universes` 200 from the page.
- Travel hex review fixes: `7deea8d8`, on `main`, deployed. Phone checks still open (below).
- Travel hex size control (−/+, size readout, Auto/120/45/17 km held at any zoom) and city-view hover names (largest town with its own state, else state and country; own-country towns only; `hex-regions-v1-r{3,4,5}.json`, fetched only in the city view): `3220ab6b`, on `main`. Checks on the combined tree: typecheck pass, eslint 0/0 on the touched dirs, vitest 47 files / 582 tests (dot-matrix, travel, watchlist); full suite 121 files / 2,914 tests and build passed on the main checkout before the rebase. Reviewer (Opus) findings fixed. Known costs: 45 km held over the whole globe ~4.5 ms/frame vs ~0.4 ms at 120 km; level-5 region file (3.3 MB raw, ~540 KB gzipped) parses ~50 ms once; overseas territories split from their sovereign get no state names.

## Live, not verified

- Collection folding on the live page: other collection lookups were rate-limited during the check, so whether The Avengers / Iron Man collection cards stay hidden beside the MCU card was not seen.
- The 6-per-10-min universe limiter in `tmdb-proxy`: not exercised.
- Owner (signed-in) view of Discover: not checked.
- Phone or touch pinch to 32x, GPU memory with level-5 patches, frame rate on a high-refresh screen: not checked. Hex size menu and city-view names not yet checked on the live site.

## Observed during the live check (note)

- "Some collections couldn't load" banner. The proxy's 60/min limit is per address block, and the owner's signed-in session on the same network was active (`api_usage_events`: set_watched and search at 11:11 UTC; tmdb-proxy limiter key ~96–102 calls/min for 11:10–11:12). Two Discover pages behind one IP exceed the budget. Not a request loop: the checking page made no calls for 100 s between bursts.

## Checks

Code checks dated 2026-11-20, on `claude/sleepy-solomon-a6e0fc`; code unchanged since.

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass |
| `npx vitest run` | pass, 119 files / 2,893 tests |
| `graphify update .` | pass |
| `npm run ship-check` | not run |
| GitHub Pages deploy (run 44897619687) | pass, 2026-11-21 |

## Still open (other sessions and owner)

- `/dev` dashboard, API/cron telemetry, Discover franchise retry, Franchises expansion, Watchlist News layout (`5296949c`, `a9e161c1`, `ec1fd147`, on `main`): awaiting a live browser check after the Pages deploy.
- Discover: visitor view of the MCU card done (above). Collection folding, universe limiter and owner view still open.
- Edge functions and `20261120201500_api_usage_metrics.sql`: applied remotely (`yvtiybyuifkiwyrnjebe`).
- Real-device Travel checks (above).
- OMDb weekly refresh, ~2026-11-25: verify the scores refresh.
- Uncommitted edits in the main checkout from another session: `src/pages/Dev.tsx`, `STATE.md`, `FEATURES.md`, `REHAUL_HISTORY.md` (plus Travel hex files). They will conflict with what is now on `main` when that session rebases. Confirm them there before committing, and keep them out of this branch's commits.

## Follow-ups, not done

- Franchises page (`src/pages/WatchlistFranchises.tsx`) still groups by collection only. Universes appear on Discover, not there.
- `wikidata/tv-spinoffs` has the same fan-out (up to 40 TMDB calls per call) and no limiter of its own.
- More universes are a registry row each in `tmdb-proxy`.

## Blockers

- Revolut bank access renewal (owner).
