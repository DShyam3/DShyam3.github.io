# State

Updated 2026-11-18 · `main` (pushed on top of `1c6bbacb`).

## Deployed & landed on `main`

- **Discover "Have you already watched?" polish + spin-off posters:**
  - `tmdb-proxy` v18 deployed and verified over HTTP (`endpoint=wikidata/tv-spinoffs` now enriches unique related spin-off/parent targets with TMDB `posterPath` and `releaseDate` so not-in-library spin-off entries render posters).
  - Gap-first ranking (`hasWatchGap` in `src/features/watchlist/franchise.ts`): incomplete collections/spin-off groups with an earlier missing/unwatched entry before a watched/in-progress one sort to the top of `HAVE YOU ALREADY WATCHED?` and are labelled `Gap in series`.
  - Multi-seed consensus (`likelySeenConsensus` in `src/features/watchlist/discovery.ts`): released titles independently recommended by 2+ titles in the library surface under `Likely seen` inside `HAVE YOU ALREADY WATCHED?` and are excluded from `YOU MIGHT LIKE`.
  - Clickable posters & titles (`EntryList.tsx` + `EntryPreviewDialog.tsx`): every entry's poster and title in `HAVE YOU ALREADY WATCHED?` and `/watchlist/franchises` is clickable—in-library entries open `WatchlistDetailDialog`, and `not-in-library` entries (e.g. *Slippin' Jimmy*) open a TMDB preview dialog with synopsis, credits, platform, trailer, and `Add to watchlist` / `Seen it` / `Not interested`.
- **Earlier on `main` (`1c6bbacb`, `ac9fae38`, `b7aa0e1b`, `5050676b`, `acf42c01`):**
  - Library search shelf narrowing, `Shelf:` + `Favourite` pills, `NOW`/`Paramount+`/`Channel 4`/`Crunchyroll` platforms, News `Following` `Worth your attention` scrim + `WeekStrip` + `OUT NOW` grid + `None of these`, `Upcoming`/`Up to date` shelves, TMDB Library categories (`20261118201834` applied, `watchlist-cron-sync` v20), Diary, Franchises, Import, and OMDb scores (`20261118190243` applied, `OMDB_API_KEY` set; retire screenshot copy; first OMDb pass: 899/1,052 films checked, 0/377 shows yet).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass (`deno check`) |
| `npx vitest run src/features/watchlist src/integrations/supabase/rls-admin-check.test.ts` | 32 files / 474 tests pass |
| `npm run build` | pass |
| `tmdb-proxy` v18 HTTP probe | pass (`wikidata/tv-spinoffs` returns `posterPath` + `releaseDate`) |
| `graphify update .` | pass |
| Browser | not run against production for the new commit |

## Next

1. Verify GitHub Pages deploy for the latest `main` push and browser-verify `HAVE YOU ALREADY WATCHED?` (spin-off posters, gap-first ordering, `Likely seen` grid), `YOU MIGHT LIKE`, and `/watchlist/franchises` (signed out and signed in as admin).
2. After 2026-11-19 06:00 UTC: check show scores (`select count(scores_checked_at) from tv_shows`) and `pg_net` 120 s timeout.

## Still unverified & blockers

- **Unverified:** Production browser checks for the latest Watchlist features (spin-off posters, gap-first ordering, `Likely seen`, Library shelf search narrowing, `Shelf:` pill, new streaming platforms, News `Following`, Discover, Franchise screens); signed-in admin flows (rating, favourite toggle, Not interested sync, `watchlist_ratings` reads, `Seen it` date menu); `S{n}E{e}` live countdown pill; light mode; phone viewport; show creator and cast dialog.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, etc.) and `.claude/launch.json` in local main checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
