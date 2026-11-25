# State

Updated 2026-11-25. Branch `main`, rebased onto `origin/main` (`379caacc`) and pushed to GitHub Pages. Hosted Supabase (`yvtiybyuifkiwyrnjebe`) has the per-episode score migrations and `watchlist-cron-sync` v34 live.

## Closed
- **Per-episode IMDb & TMDB ratings.** Migrations `20261124204936_watchlist_episode_scores` and `20261124211553_watchlist_season_omdb_rpc` are applied on hosted, and `watchlist-cron-sync` v34 is deployed. Both TMDB (`1,080/1,082` regular seasons; `13,100` `tmdb_votes`, `12,773` `tmdb_rating`s) and OMDb (`1,079/1,079` eligible seasons; `12,341` `imdb_id`s, `8,718` `imdb_rating`s) backfills finished after the `2026-11-25 06:00–06:20Z` cron (`sync_log` `455–457`, all `success`). Lazy episode score loading (`WatchlistContext.tsx`) and episode/season `avg` chips (`SeasonEpisodeList.tsx`, `TitleScores.tsx`) passed `reviewer` (Opus) fixes and SSR tests.
- **Watchlist Finished tab.** Dedicated `/watchlist/finished` route (`WatchlistFinished.tsx`) with `LibraryFiltersPopover.tsx`, `WatchlistNav.tsx`, `SFCheckmarkCircleFill`, and `/watchlist` shelf cleanup.
- **Rate what you've watched queue (`e05e3049`), Transaction details sheet (`d5bc2ac2`), and Diary plan correction (`5dccda52`).** Live on Pages (`379caacc`).
- **Wikidata nightly cache (`watchlist_wikidata_cache`, verified live).** Hosted DB inspection confirmed the `2026-11-24 06:20:38Z` cron populated both rows (`tv-spinoffs`: 58 links from 434 seeds; `film-universes`: 45 films).
- **Impeccable setup.** Design hook enabled (`impeccable hooks on` for `.agents` and `.gemini`), `impeccable doctor --json` reports `0` findings, and `impeccable detect` reports `0` anti-patterns.

## Last checks (2026-11-25, rebased `main`)
| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors and 0 warnings |
| `npm run typecheck` & `npm run typecheck:functions` | pass |
| `npm run test:functions` | pass, 57 Deno tests |
| `npx vitest run` | pass, 134 files / 3,081 tests |
| `npm run build` | pass (Vite large-chunk advisory) |
| `impeccable detect` & `impeccable doctor --json` | pass, 0 anti-patterns / 0 findings |

## Still open / not verified
- **Browser checks (new UI):** Episode score chips, season `avg` headers, Finished tab, Rate queue, and Transactions sheet have not yet been inspected signed in on live Pages (or on iPhone/iPad hardware for Transactions / Travel map / dot-matrix numbers).
- **Rate queue owner choices:** Series rule, hidden titles excluded, skips per browser (`REHAUL_PLAN.md` Discover item 2).
- **Local Supabase stack:** Not updated with `20261124204936` or `20261124211553` (older local stacks may carry `20261122221500`).
- **Owner-signed-in Watchlist checks:** Favourites `Refresh favourite details` + `Language unknown`, Discover steps 1–3, dislikes, taste line, owner franchise order since `48bdbdcf`, `Seen it` rating prompt, and Wildcards (reviewer fixes not re-reviewed).
- **Platform & edge checks:** Route error screen and stale-chunk reload on live Pages; pre-existing `FinanceHostBoundary` rethrow when a Watchlist detail is docked; hosted `finance_settings` payday schedule (`monthly_date`, day `29`) unverified here; Revolut TrueLayer consent renewal when convenient.

## Next
1. Spot-check the deployed GitHub Pages build for episode score chips, season `avg` headers, `/watchlist/finished`, the rating queue, and the Transactions sheet.
2. Run signed-in owner checks for Favourites (`Refresh favourite details`) and Discover (`REHAUL_PLAN.md` items 1–2).

## Blockers
- Owner-specific checks require the owner's signed-in browser session.
