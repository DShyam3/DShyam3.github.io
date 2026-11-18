# State

Updated 2026-11-18 · `main` = branch `claude/eloquent-johnson-xdjc53` (fast-forwarded, pushed). Migration applied to hosted; `tmdb-proxy` v15 and `watchlist-cron-sync` v18 deployed. Pages deploy of this push NOT yet verified.

## Deployed — Discovery fixes (`0ba78391`)

**Watchlist Diary, Franchises, history import, OMDb scores and public ratings.** Live on hosted (database and functions) and pushed to `main`. Full list in `REHAUL_PLAN.md`, "Watchlist Diary, Franchises, import and public ratings".

- Built: IMDb, Rotten Tomatoes and Metacritic scores (from OMDb, by the nightly sync) beside the owner's rating; Mark as watched and Mark Season as Complete ask when; Paused series state; Diary and Year in review (`/watchlist/diary`); Franchises (`/watchlist/franchises`); Letterboxd and Trakt file import (admin); nav News · Library · Diary · Franchises.
- Hosted migration `20261118190243_watchlist_tracking` applied and checked by SQL: score and collection columns, `paused` on `tv_shows`, public read with admin-only writes on `watchlist_ratings` (ratings are now public, the owner's decision) and the viewing-order tables, anon cannot execute the new RPCs, the season-cascade guard is in. 0 ratings existed when it was applied.
- `OMDB_API_KEY` is NOT set yet: storing it through the Supabase MCP is paused, so the owner is adding it in the dashboard (Edge Functions → Secrets). Until then the sync skips scores. The owner shared the key in chat (screenshot); a fresh key would retire that copy.

## Checks (2026-11-18, final tree of this branch)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 101 files / 2,760 tests pass |
| `npm run build` | pass |
| `npm run typecheck:functions` (`deno check`) | pass only with local substitutes: esm.sh and deno.land are blocked here, supabase-js 2.39.8 mapped to npm, std `serve` stubbed. Not a real Deno run. |
| `npm run ship-check` (run before the merge) | 94. Its critical is a false positive: airport codes in `src/features/travel/airport-countries.data.ts` match an AWS key pattern. |
| Browser | not run for any new screen |
| RPCs | tested on a scratch Postgres with a stubbed `is_admin()` only |

Not run: `supabase db diff` against a from-schema build; graphify (not installed).

## Next

1. Verify the Pages deploy of `main` finished, then browser-verify every new screen, signed out and signed in as admin. Nothing has been checked in a browser.
2. Owner: activate the OMDb key and add `OMDB_API_KEY` in Edge Functions → Secrets. Then scores and collections fill in over the nightly sync parts (up to 300 OMDb lookups a part; 1,295 titles, weekly refresh after the first pass).
3. Check the Trakt export format against a real export, and that `last_watched_at` (latest play) is used as such.

## Landed on main (checked against git, 2026-11-18)

- `0ba78391` Discover fixes (other session): validated series status and credits kept on add, Seen it puts an ended series in Finished, Coming soon alternates films and series. Deployed by Pages run `44376019120`; signed-in writes unverified.

- `63fa21b6` Watchlist News and Library redesign: on `origin/main`. Its three migrations are applied to hosted. Browser-verified signed out only.
- `3d17b507` Credits (directors, creators, top cast): on `origin/main`. Hosted migration `watchlist_credits` applied; `watchlist-cron-sync` v17 deployed. Backfill complete 2026-11-18.
- `12bb88d9` TitleRef, a film and a show sharing a row id told apart: on `origin/main`.

## Still unverified (carried forward, not checked)

- Signed-in admin on production: rating, Seen it, favourite toggle, Not interested sync, reads from `watchlist_ratings`.
- Light mode; a real phone; a show's "Created by" and cast in the production dialog.
- Hosted `site_content` `about_me_1` / `about_me_2` have `section` NULL, so About shows the `site.json` fallback.
- Warm-up sends about 30 anonymous reads, including the full Watchlist library.
- Most watched episodes have no watch date: 2,447 of 2,532 on hosted, earliest dated 2026-09-13. Older finished series sort after dated titles under Recently watched.

## Blockers

- Parallel sessions share one checkout, and cloud sessions push to `main`: fetch first, one committer.
- Not seen on 2026-11-18 (`git status` clean, one worktree): the earlier uncommitted `.claude/launch.json`, the REHAUL_PLAN.md "Part 4" section, and untracked drafts `SITE_PLAN.md` and the two `*implementation*` drafts. Confirm before assuming they are gone.
- Dropped as stale: `stash@{0}`, `backup/pre-rebase-2026-11-03` and worktree `affectionate-lamarr-f2d2cb` no longer exist.
