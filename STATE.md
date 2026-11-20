# State

Updated 2026-11-20 · `main` at `e19905e4`, pushed to `origin/main`. Uncommitted and local only, not deployed: Travel flat-map projection picker and the Home constellation fix, plus the Discover work under *Uncommitted, this tree* (not browser-verified).

## Uncommitted, this tree

- Travel flat map: Equal Earth pill is now a menu (Equal Earth default, Winkel Tripel, Robinson, Mercator), one-line note each, remembered per browser (`travel-map-projection`). Mercator cut at 84°N and 60°S. Switching keeps the centre. Menu hidden below 640px. Globe unchanged.
  - Verified locally (preview, 1600×900): all four render; hover resolves the right country on Mercator; open ocean resolves nothing; choice survives reload; no console errors.
  - Not verified: phone; live site (not deployed).
- Home constellation: orbit speed frame-rate independent (was 2–4x fast on 120/240 Hz); loop stops while scrolled out of view.
  - Verified locally: ~60 rAF/s on screen, 0 off screen, resumes on scroll back.
  - Not verified: real high-refresh monitor; phone.
- Reviewer pass on this diff: done; 3 bugs and 5 risks found, all fixed (projection-switch pan target held/stale, focus re-run resetting zoom on a switch, Mercator focus past the cut, Antarctica smearing during the morph, base tier label, IntersectionObserver entry order, 36px trigger). Re-verified in the preview: two switches in a row keep the view on the same place; a switch with a selection keeps the user's zoom.
- Discover, `HAVE YOU ALREADY WATCHED?` order and request budget (`discovery.ts`, `franchise.ts`, `useDiscovery.ts`, `DiscoverySection.tsx`, `EntryPreviewDialog.tsx`, `WatchlistDetailDialog.tsx`, `useWatchHistoryImport.ts`, `useTMDB.ts`, `WatchlistFranchises.tsx`). Not browser-verified, not deployed. The decision is in `REHAUL_HISTORY.md`.
  - Franchise cards rank by newest library row id, films and series taking turns (film first). Release and watch dates do not count. A franchise needs 2+ titles. Collections are fetched in that order, 12 per batch; the auto-scan no longer stops when `Likely seen` has cards.
  - Known limit: marking an existing to-watch film watched does not move its franchise up. There is no last-touched column; one would need a migration, not done.
  - tmdb-proxy allows 60 calls/min per IP. Opening Discover costs 25; automatic top-ups add at most 26, once per visit. `getMovieDetails` retries only 429s (5s, 20s, 40s); the watch-history import opts out (`retryRateLimit: false`).
  - Fixed a same-key `fetchQuery` deadlock: the preview and detail dialogs shared `getMovieDetails`' query key, so a preview stuck on Loading and an Add/Seen on that entry hung. Likely cause of the stuck "Adding…" on Paddington 4; not confirmed by the user.
  - Collection and spin-off lookups (Discover and `/watchlist/franchises`) throw on failure, so a 429 is no longer cached, or persisted for spin-offs, as empty.
  - Copy: the order rule sits under the section heading; `Likely seen` and empty `COMING SOON` lines corrected. Seeds: franchise titles first within each `discoverySeeds` signal. Also from earlier, uncommitted: `COMING SOON` auto-pages (up to 5), `YOU MIGHT LIKE` auto-advances (up to 8 pages), explicit loading and empty states.
  - Reviewer (Opus) pass done. Left as is: a card can re-rank under the pointer on add (the user asked for a just-added franchise to jump to the top); series-add season fetches have no 429 retry.
  - Open: Marvel as one group. TMDB has no MCU collection, and the owner has every Avengers and Iron Man film, so neither shows; a universe grouping needs a new tmdb-proxy lookup and a deploy. A local preview on 8082 hit the proxy's 429 and was stopped; `.claude/launch.json` gained `dev:8082`.
  - "Not interested" race fixed. A signed-in dismissal now stays in the browser copy until a re-read of `watchlist_dismissed_suggestions` contains it (`dismissalHandover` in `discovery.ts`, tested). Before, a dismissed-list read already in flight (e.g. the 5-minute stale refetch on returning to the tab) could finish after the write and drop the key from both copies, so the title came back until a reload. Live table showed Jurassic Park 1–3 saved at 19:13 while the user still saw them. Signed-out path verified in the preview at 8082; the signed-in path is unit-tested only, not browser-verified.

- Watchlist News updates & calendar (`useWatchlistNews.ts`, `useWatchlistNews.test.ts`, `YourWeek.tsx`, `responsive.css`, `WatchlistNews.tsx`, `WatchlistNews.css`). Uncommitted, local only, not browser-verified, not deployed.
  - `recentAnnouncementsQuery` now paginates `tv_show_seasons` and `tv_show_episodes` through `selectAllPages` instead of capping at 1,000 rows (`episodes_30d` was 3,277 on live, tripping the cap and showing `"Some updates could not load"`). Unit-tested past 1,000 rows (5/5 pass).
  - `YourWeek` week grid now switches to 7 columns via `@container (min-width: 68rem)` on `.your-week-container` instead of viewport `xl:grid-cols-7`, preventing skinny squished columns in the narrower right pane of the 2200px+ News layout.
  - In the viewport-locked 2200px+ News layout, `.news-calendar-pane` is capped at `max-height: 54%` with internal scrolling on `.your-week-scroll` so the calendar can no longer crush `UpdatesList` to 0px.
  - `UpdateRow` converted from the old 4-track CSS grid (which reserved 176px of empty tracks on `sm:` and caused wrapped lines to collide with `today` and adjacent rows via `self-end`/`self-start` + `grid-row: 1 / 4`) to a plain flex row with a single stacked text column and `align-content: start` on `.news-updates-grid`.
  - Not verified: browser at 2200–2560px and 5120×1440; live site (not deployed).

- Watchlist Franchises & Discover rate-limit copy (`WatchlistFranchises.tsx`, `CollectionCard.tsx`, `franchise.ts`, `franchise.test.ts`, `DiscoverySection.tsx`). Uncommitted, local only, not browser-verified, not deployed.
  - `/watchlist/franchises` now expands TMDB collections in batches of 20 so 2+ part film series appear even when only 1 film is in the library (while excluding 1-film collections and 1-item custom library franchises). Added category pills (`All`, `Film Series`, `TV & Spin-offs`, `Viewing Orders`, `Library Franchises`), progress filter (`All status`, `In progress`, `Completed`), and name search.
  - Discover empty-page copy now states that automatic loading paused to stay within API rate limits.
- Private `/dev` API & Supabase metrics dashboard (`Dev.tsx`, `App.tsx`, `WorkspaceRail.tsx`, `api-usage-fetch.ts`, `api-usage-fetch.test.ts`, `client.ts`, `AuthContext.tsx`, `types.ts`, `03_api_usage.sql`, `20261120201500_api_usage_metrics.sql`, `_shared/api-usage.ts`, `tmdb-proxy/index.ts`, `sync-bank-holidays/index.ts`). Uncommitted, local only, not browser-verified; migration not yet applied to live Supabase and edge functions not yet redeployed.
  - Admin-only `/dev` route and left-rail `Dev` utility button above `Text: Std` (hidden when signed out). Tracks Edge Function public API calls (`tmdb`, `wikidata`, `bank_holidays`) and batched client-side Supabase calls (`rest`, `rpc`, `functions`, `auth`, `storage`, excluding telemetry endpoints) into `api_usage_events` with admin-only RLS, plus live rate-limit windows via `get_active_rate_limits()`.

## Pushed, still open

- `2f1601b8` Travel zoom and ultrawide layout (deployed, Pages run 44789914433).
  - Unverified: zoom feel on 120/240 Hz and the 49" display; ultrawide track on a real monitor; phone. Zoom complaint addressed in code, not confirmed by the user.
- `1a38256c` Travel hex-map WebGL (deployed, Pages run 44706048460). Decision in `REHAUL_HISTORY.md`.
  - Unverified: real-time fps on a focused window (preview rAF throttled); Travel enter/exit lag (never timed); touch and pinch on a phone; shader compile on other drivers.
  - Known, left as is: stars sit above cells during the 500 ms morph; border width multiplies by dpr twice; a country selected within ~2 s of a drag can let momentum turn the globe off it.
- `2977e585` H3 res-3 map (12,390 cells, 234 countries/territories). Live deployment not separately confirmed.
- `34e104f7` Watchlist filmography, Cool facts, News layout, Discover cap, watched search. Browser checks open.
- `c6cb54c7` CollectionCard stall fix and `franchise` column; `20261120074000_watchlist_franchise.sql` applied on `yvtiybyuifkiwyrnjebe`.
- Dot-matrix UI chrome (`8886fe3c`). Browser verification open.
- Landed, checks open: About wide layout (`76a56f9a`) local only at 2560×1080 and 1440×900; Payslip (`d5120557`) and row-logo (`234eeba2`) pushed. Reimbursement migration `20261119150000_payslip_reimbursement_links.sql` applied on `yvtiybyuifkiwyrnjebe`; linked access, RLS and signed-in behaviour unverified. `feat/watching-mid-season` signed-in shelves unchecked. OMDb first pass done 2026-11-19 (films 1,064/1,070; series 393/395).

## Checks (2026-11-20, this tree on `e19905e4`, as reported by the session that ran them)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass, whole tree, 0 errors (2026-11-20) |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass |
| `vitest` dot-matrix + lib (53 files / 2059), home + pages | pass |
| `graphify update .` | pass |
| `vitest` watchlist + pages + query-cache-persistence (Discover work) | 37 files / 502 pass (2026-11-20) |
| reviewer pass | done, findings fixed; full vitest over src/components/dot-matrix, src/lib, src/components/home: 54 files / 2076 pass |
| `npm run ship-check` | not run; last 93/100, **Do not launch yet** (`1a38256c`) |
| full `vitest run` | not run; last 115 files / 2841 tests (`1a38256c`) |

## Next

1. Commit and push the projection picker and constellation fix (uncommitted; reviewed and fixed).
2. Check projection picker and constellation on a real 120/240 Hz screen, a phone, and the live site once deployed.
3. Zoom feel on 120/240 Hz and the 49" display; ultrawide layout on the real monitor.
4. Hex-map unverified items on the live site and a phone. Check the first weekly OMDb refresh around 2026-11-25 in `sync_log`.
5. Reload Discover to confirm the franchise order and that adds no longer stall. Then browser-check Discover watched search, Library Add and Watchlist shelves, signed in.
   - Commit the watchlist files separately from the hex-map work: `src/features/watchlist/{discovery.ts,discovery.test.ts,franchise.ts,franchise.test.ts,useDiscovery.ts,useTMDB.ts,tmdb-retry.test.ts,components/DiscoverySection.tsx,components/WatchlistDetailDialog.tsx,components/franchise/EntryPreviewDialog.tsx,components/import/useWatchHistoryImport.ts}` and `src/pages/WatchlistFranchises.tsx`.
6. Browser-check reimbursement entry, suggestions, unlink, stale links and ledger marker; leave year 2049.
7. Carry forward ship-check findings; exit code zero is not launch approval. Revolut bank access needs renewing.

## Open questions (undecided, not plan items)

Zoom-dependent H3 levels (res 4/5); coastline and thin-country hex assignment in `scripts/generate-hex-map.py`; map styles (satellite, terrain, night-lights).
- Franchises page (`/watchlist/franchises`) has no "Not interested" and lists every film in a collection; dismissals only affect Discover. Unchanged. Hide or dim dismissed entries there?

## Blockers and carried context

None recorded; real-device checks depend on hardware. Signed-in admin and show creator/cast flows open. Untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`), `.claude/launch.json` `caught-up-worktree` entry and `.claude/worktrees/affectionate-lamarr-f2d2cb` carried forward, ownership not re-checked.
