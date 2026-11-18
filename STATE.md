# State

Updated 2026-11-18 · Branch `claude/eloquent-johnson-xdjc53` · Head: the commit after `645601e` (no watch dates on unreleased titles), merged with `origin/main` `49a186e`, pushed. NOT merged into `main`; no PR. Nothing here is deployed.

## In progress

**Watchlist Diary, Franchises, history import, TMDB scores and public ratings.** In the tree on the branch; not merged, not deployed, migration not applied. Full list in `REHAUL_PLAN.md`, "Watchlist Diary, Franchises, import and public ratings".

- Built: TMDB score beside the owner's rating; Mark as watched and Mark Season as Complete ask when; Paused series state; Diary and Year in review (`/watchlist/diary`); Franchises (`/watchlist/franchises`); Letterboxd and Trakt file import (admin); nav News · Library · Diary · Franchises.
- Fixed in code, not live: a season is no longer unmarked when one of its episodes is (migration `20261118120000`, `pg_trigger_depth` guard).
- Ratings are now public, read-only to visitors; writes stay admin-only (the owner's decision, 2026-11-18). Committed: client in `bf1f2db` (visitors read `watchlist_ratings`, "My score · TMDB" line), policy in migration `20261118120000` (`Public Read Access`, anon SELECT; checked on a scratch Postgres: anon reads, cannot write). Not applied, not deployed: applying it publishes every existing rating.

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

1. Apply migration `20261118120000_watchlist_tracking` to hosted (after main's three, which are applied); check `select library_state, tmdb_vote_count from tv_shows limit 1` and that anon can read `watchlist_ratings`. Then deploy `watchlist-cron-sync` and `tmdb-proxy`. Then merge to `main`. This order matters: the client and the sync read and write the new columns.
2. Browser-verify every new screen, signed out and signed in as admin. Nothing has been checked yet.
3. Let the TMDB votes and collections backfill run over three nightly sync parts.
4. Check the Trakt export format against a real export, and that `last_watched_at` (latest play) is used as such.

## Landed on main (checked against git, 2026-11-18)

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
