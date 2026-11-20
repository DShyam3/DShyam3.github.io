# State

Updated 2026-11-20. Branch `claude/sleepy-solomon-a6e0fc`, head `30e0a877`. Local only: not pushed, not merged to `main`. `origin/main` includes `7deea8d8` (Travel hex fixes), which sits under this branch's head.

## Closed today

- Marvel Cinematic Universe as one Discover card, committed as `30e0a877`. A universe lists its films in release order; a collection it lists in full is folded in; a collection with films outside it (Deadpool) keeps its own card. Visitors' franchise cards read only visible library rows.
- Travel hex review fixes, committed as `7deea8d8` and on `origin/main`. Phone checks are still open (see below).

## Deploy order (read before merging)

- `tmdb-proxy` is NOT deployed. Deploying it waits for the owner's OK.
- Deploy `tmdb-proxy` BEFORE the frontend reaches `main` / GitHub Pages. If the frontend ships first, the old proxy answers the new endpoint with 403, Discover shows "Some collections couldn't load", and its Retry cannot work.

## Unverified

- The `wikidata/film-universes` endpoint has not run end to end: no deploy, no local Supabase.
- The SPARQL was checked live with curl (45 TMDB ids, 42 dated). The TMDB enrichment path (titles, posters, dates) was not run.
- No browser check of the MCU card. The worktree has no `.env`, and the card needs the deployed proxy.
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
- Discover live browser check, after Pages deploys.
- Real-device Travel checks (above).
- OMDb weekly refresh, ~2026-11-25: verify the scores refresh.
- Revolut bank access renewal (owner).
- Uncommitted Watchlist work from another session (Franchises "Not interested" dimming: `EntryList.tsx`, `useDiscovery.ts`, `WatchlistFranchises.tsx`, `useDismissedSuggestions.ts`) was in the main checkout at the last note. Not checked from this worktree; confirm there before it is committed, and keep it out of this branch's commits.

## Follow-ups, not done

- Franchises page (`src/pages/WatchlistFranchises.tsx`) still groups by collection only. Universes appear on Discover, not there.
- `wikidata/tv-spinoffs` has the same fan-out (up to 40 TMDB calls per call) and no limiter of its own.
- More universes are a registry row each in `tmdb-proxy`.

## Blockers

- Owner's OK to deploy `tmdb-proxy`, then the frontend merge in that order.
- Revolut bank access renewal.
