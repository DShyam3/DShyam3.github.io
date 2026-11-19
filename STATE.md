# State

Updated 2026-11-19 · `main` at `332a7ad` (this branch, merging `origin/main` `b04db3e`). Pages run `44479344055` (manual re-run) deployed it; the push run `44478486168` failed twice at the Pages deploy step on a GitHub artifact error (none found, then two found), not on any check. Browser check not done.

## Closed 2026-11-19

- **Library Watching shelf narrowed (`library-state.ts`, `82210f40`, deployed by Pages run `44483401937`; live signed-out check shows Watching 2 with the new hint):** Watching holds only series part-way through a season, or kept up with as they air (next episode due within 14 days; earlier seasons skipped or not). A started series at a season boundary, or with only some seasons ticked, sits on To watch with a pill naming where you pick up (`S5 next`), and its detail opens on that season. A longer mid-season break sits on Upcoming with its countdown. The pill text is the pure, tested `statusLabel`, shared with the shelf rule. Discover's watching seed keeps any started show. Signed-out dev preview against live data: Watching 2 (Dan Da Dan; Tulsa King `S4E6 in 1d`), Bridgerton `S4 next`, Stranger Things `S5 next`, Up to date 23, Upcoming 38, clean console.
- **Travel double-load & visual flash elimination (`TravelPage.tsx`):** removed destructive `key={`${session?.user.id ?? 'public'}-${isAdmin}`}` on `<TravelContent />` that was causing React to completely unmount and remount the Three.js globe and page tree once auth state resolved.
- **Finance internal tab switching & re-entry latency (`FinancePage.tsx`):**
  1. Kept `FinanceView` mounted in a persistent DOM container in `FinanceHost` across route transitions, eliminating the heavy remount, un-suspending, and tab reset when navigating away from Finance and back.
  2. Wrapped visited tabs in `TabSlot` comparator so inactive tabs skip re-rendering on tab switches (preventing exponential slowdown as multiple heavy chart/table surfaces are visited).
  3. Prefetched all 17 finance section chunks eagerly on mount and on tab pointer enter rather than waiting for 4s idle timeout.
  4. Scoped `detectRecurringPayments` to run only when the recurrings tab is in `visitedTabs`.
- **Watchlist News card alignment & grid baseline (`WatchlistNews.tsx`, `WatchlistNews.css`):** cards use `flex flex-col h-full` with schedule actions pinned to the bottom (`mt-auto`), `line-clamp-2` with `min-h-[2.5rem]` for titles so 1- and 2-line titles allocate the same height, and `minmax(min(100%, 16.5rem), 1fr)` columns to prevent platform and countdown pill wrapping.
- **GitHub Pages deploy workflow artifact race & retry failure (`.github/workflows/deploy.yml`):** split single `deploy` job into `build` (test, build, `upload-pages-artifact`) and `deploy` (`needs: build`, `deploy-pages`) jobs, eliminating `Found 0 artifact(s)` race and `Multiple artifacts named "github-pages"` error on re-runs.
- **Discover "Seen it" stamped today's date.** It now asks when, with the same menu as Mark as watched (just now, on release or each episode's air date, date unknown, or a picked date bounded by release and today). Browser check still open.
- The ~54 films added 2026-11-18 with today's date (ids 2362-2417) were set to "date unknown" by SQL on 2026-11-18. They stay watched.

## Deployed & landed on `main`

- **Watchlist Discover, News & Franchises:** `tmdb-proxy` v18 deployed; gap-first ranking, `Likely seen` consensus, `EntryPreviewDialog`, News `Following` scrim + `WeekStrip` + `OUT NOW` grid, Library shelf filters/categories (`20261118201834`), Diary, Franchises, Import.
- **Watchlist `TitleScores` badges + TMDB score:** committed on this branch; browser check outstanding.
- **Staged warmup, public IndexedDB cache, deduplicated Supabase calls** (`565c605`): committed on this branch; browser check outstanding.

## OMDb scores

- **First pass complete.** Three parts ran at 06:00 UTC on 2026-11-19, each 200 OK in 68-75 s (the cron `pg_net` timeout is 120 s).
- Films: 1,064 of 1,070 checked; 1,008 with an IMDb rating.
- Series: 393 of 395 checked; 354 with an IMDb rating; only 3 with Rotten Tomatoes (OMDb rarely carries RT for series).

## Checks (2026-11-19, merged tree `049ed65`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 107 files, 2,806 tests pass |
| `npm run build` | pass |
| Browser | not run |

## Next

1. Browser-verify: Discover "Seen it" menu and picked-date bounds (signed in as admin); Watchlist ↔ Finance switching and internal tabs (single `check_connection`, IndexedDB public cache hydration on reload, no Finance keys in IndexedDB); `TitleScores`/TMDB scores; Discover; `/watchlist/franchises`.
2. First weekly OMDb refresh (~2026-11-25): it re-asks ~900 titles at up to 300 a part (~100 s, close to the 120 s timeout). Check that day's `sync_log`.

## Still unverified & blockers

- **Unverified (not browser-checked):** Discover "Seen it" dating, IndexedDB public cache hydration and privacy boundary, staged warmup, Watchlist ↔ Finance switching, Travel batched signed URLs, `TitleScores` badges, Watchlist Discover/News/Franchise/Library flows, signed-in admin flows, the narrowed Watching / To watch shelves signed in, `S{n}E{e}` live countdown pill, light mode, phone viewport, and show creator/cast dialog.
- **Unverified (not yet run):** the weekly OMDb refresh.
- **Blocker:** the 2026-11-19 finance sync reported "Revolut: bank access needs renewing; reconnect this bank". Not yet reconnected.
- **Carried forward from 2026-11-18, not re-checked:** untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`) and `.claude/launch.json` in the local main checkout; worktree `.claude/worktrees/affectionate-lamarr-f2d2cb` (owner unknown). `.claude/worktrees/caught-up` was removed 2026-11-19; `.claude/launch.json` on `main` still carries its stale `caught-up-worktree` entry.
