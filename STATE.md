# State

Updated 2026-11-21. Branch `claude/sleepy-solomon-a6e0fc`, head is the docs commit on top of `30e0a877`. Local only: not pushed, not merged to `main`, not on GitHub Pages. `origin/main` includes `7deea8d8` (Travel hex fixes), which sits under this branch.

## Closed 2026-11-21

- `tmdb-proxy` deployed to Supabase project `yvtiybyuifkiwyrnjebe` from this branch (code of `30e0a877`), now version 22. `verify_jwt` is false, deployed with `--no-verify-jwt` as before. Before deploying, live v21 was diffed against `origin/main`: identical except `_shared/api-usage.ts` (live had the older version without `createUsageBatcher`); v22 ships main's version.
- Live smoke test passed: `wikidata/film-universes` 200 in ~4.2 s, 45 MCU films, all titled, 42 with poster and date. The 3 undated (Armor Wars, untitled Shang-Chi sequel, Blade) are left off the client unless owned. Existing endpoints still fine: `movie/1726` 200, `wikidata/tv-spinoffs?ids=1418` 200, disallowed `account/1` 403.
- Marvel Cinematic Universe as one Discover card, committed as `30e0a877`, docs `bb4a079a`. A universe lists its films in release order; a collection it lists in full is folded in; a collection with films outside it (Deadpool) keeps its own card. Visitors' franchise cards read only visible library rows.
- Travel hex review fixes, committed as `7deea8d8` and on `origin/main`. Phone checks are still open (see below).

## Frontend: local only

- The MCU card (`30e0a877`) and its docs are on this branch only. Not pushed, not merged to `main`, not on GitHub Pages. Merging and pushing wait for the owner.
- The endpoint is live now, so the frontend can ship at any time. The old deploy-order hazard (new frontend hitting an undeployed proxy) no longer applies.

## Unverified

- No browser check of the MCU card. It needs the frontend on Pages, or a worktree with a `.env`. This worktree has no `.env`.
- The 6-per-10-min universe limiter in `tmdb-proxy` has not been exercised.
- Phone or touch pinch to 32x, GPU memory with level-5 patches, and frame rate on a high-refresh screen: not checked.

## Checks (2026-11-20, on `claude/sleepy-solomon-a6e0fc`)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass |
| `npx vitest run` | pass, 119 files / 2,893 tests |
| `graphify update .` | pass |
| `npm run ship-check` | not run |

## Still open (other sessions and owner)

- `/dev` dashboard, API/cron telemetry, Discover franchise retry, Franchises expansion, Watchlist News layout (`5296949c`, `a9e161c1`, `ec1fd147`, on `main`): awaiting a live browser check after the Pages deploy.
- Edge functions and `20261120201500_api_usage_metrics.sql`: applied remotely (`yvtiybyuifkiwyrnjebe`).
- Discover live browser check, after Pages deploys (includes the MCU card once merged).
- Real-device Travel checks (above).
- OMDb weekly refresh, ~2026-11-25: verify the scores refresh.
- Revolut bank access renewal (owner).
- Uncommitted Watchlist work from another session (Franchises "Not interested" dimming: `EntryList.tsx`, `useDiscovery.ts`, `WatchlistFranchises.tsx`, `useDismissedSuggestions.ts`) was in the main checkout at the last note. Not checked from this worktree; confirm there before it is committed, and keep it out of this branch's commits.

## Follow-ups, not done

- Franchises page (`src/pages/WatchlistFranchises.tsx`) still groups by collection only. Universes appear on Discover, not there.
- `wikidata/tv-spinoffs` has the same fan-out (up to 40 TMDB calls per call) and no limiter of its own.
- More universes are a registry row each in `tmdb-proxy`.

## Blockers

- Owner's OK to push and merge the frontend to `main` (GitHub Pages).
- Revolut bank access renewal.
