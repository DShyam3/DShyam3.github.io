# State

Updated 2026-11-20 · `main` at `2977e585`. The Travel H3 res-3 hexagon map (`2977e585`) is pushed to `main` (live Pages deployment unverified); the shared checkout still contains other owners' uncommitted local work.

## In the tree, still local

- Watchlist UX & discovery updates (to be pushed): widened the right-hand inspector (`responsive.css`), added clickable person filmography (`PersonFilmographyDialog`, `person-credits.ts`, `person-credits-query.ts`, deployed `tmdb-proxy` `search/person` + `person/*/combined_credits`), added the **Cool facts** tab (`/watchlist/facts`, `WatchlistFacts.tsx`, `cool-facts.ts`, `cool-facts-query.ts`), switched News to inline `Your calendar` + `PosterCard`s (`WatchlistNews.tsx`, `YourWeek.tsx`, `PosterCard.tsx`, `PlatformLogo.tsx`, `surfaces.css`), tightened `Rate` spacing (`SeasonEpisodeList.tsx`, `PersonalRating.tsx`), and capped `interleaveBySeed` at 4 per non-filler seed (`discovery.ts`).
- Discover has an owner-only full-width search bar above its suggestions. Clicking anywhere opens a TMDB film/series lookup, following the `All` / `Films` / `Series` switch. Each result offers `Seen it`, then asks when (now, release or episode air date, unknown, or a picked date) before adding a new title as watched; future-dated titles are disabled and pending/added results cannot be selected again. Library's Add search saves titles as unwatched (`To watch` once released, `Upcoming` before release). Both searches now clear outdated results as the query changes and ignore late replies from older requests; the same guard also covers Favourites and Franchises searches. This is uncommitted and not browser-verified.
- Pushed (`2977e585`): Travel H3 res-3 hexagon map (`DotMatrixGlobe.tsx`, `hexMapData.ts`, `useCityMap.ts`, `TravelPage.tsx`, `public/data/hex-world-map-r3.json`, `scripts/generate-hex-map.py`, `h3-js@4.5.0`) with 12,390 cells across 234 countries/territories, small-island and overseas-territory splits, 16×8 spatial-bucket culling, city hex snapping, sub-national region hover labels, and curated island entries (`Tenerife`, `Fuerteventura`, etc.). Live Pages deployment and Vitest remain unverified.
- Dot-matrix UI chrome remains uncommitted: `DotMatrixText size="ui"` and Doto readout labels across the rail, header, dock, nav, Travel, Collection, Watchlist and Finance controls. Browser verification remains open.
- Other edits and untracked drafts in this shared checkout may belong to other work; inspect their diffs before attributing them.

## Landed elsewhere, with checks still open

- Travel double-flash (`37bae8a9`, `0763a04b`) and Finance tab/Home latency (`194093c2`, `22998cc7`) fixes are pushed and user-verified live.
- About wide-screen layout fix (`76a56f9a`) was pushed and browser-verified locally at 2560×1080 and 1440×900; live Pages deployment remains unverified.
- Payslip code (`d5120557`) and row-logo change (`234eeba2`) were pushed. The reimbursement migration `20261119150000_payslip_reimbursement_links.sql` is recorded as applied on `yvtiybyuifkiwyrnjebe`; linked table access, RLS and signed-in browser behavior remain unverified. PDF imports still capture summary figures, so reimbursement lines need manual entry.
- Discover “Seen it” asks when; about 54 affected films were set to “date unknown” on 2026-11-18. Signed-in flow remains unverified in the browser.
- `feat/watching-mid-season` narrows Watching to mid-season or current-as-aired series; signed-out preview was checked, signed-in shelves were not. Watchlist News, Franchises, Library, Diary, Import, scores, warmup and public cache changes were previously recorded as landed; browser checks remain open.
- OMDb first pass completed 2026-11-19: films 1,064/1,070 checked (1,008 IMDb ratings); series 393/395 checked (354 IMDb ratings, 3 RT ratings).

## Checks (2026-11-19, current local tree)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors and 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| Watchlist Vitest (`src/features/watchlist/`) | 35 files, 485 tests pass (2026-11-20) |
| `npm run ship-check` | command passed; **Do not launch yet**, 93/100. The reported AWS key at `airport-countries.data.ts:226` was previously inspected as an encoded lookup-string false positive; other findings remain open. |
| Browser | Discover search, H3 map, dot-matrix chrome, payslip/reimbursement and other signed-in flows not verified this session |

## Next

1. Verify linked reimbursement table access and RLS, then browser-check payslip rows/logos and reimbursement entry, suggestions, confirmation/unlink, stale links and ledger marker. Test a future leave year such as 2049.
2. Browser-check Discover's full-width watched search for film, series and All on desktop and phone; compare identical queries with Library, including rapid typing and switching dialogs, then verify date choices, future releases, duplicate prevention, watched status and signed-in persistence. Check the separate Library Add path, suggestion “Seen it” dating, Watching/To watch shelves, Watchlist ↔ Finance navigation, IndexedDB cache/privacy boundary, scores, News, Franchises, Library, Travel signed URLs, countdown, light mode, H3 map and dot-matrix chrome.
3. Run Vitest for the H3 map work. Check the first weekly OMDb refresh around 2026-11-25 in `sync_log` (roughly 900 titles, up to 300 per part).
4. Carry forward ship-check findings; exit code zero does not grant launch approval. The 2026-11-19 Finance sync said Revolut bank access needs renewing and is not yet reconnected.

## Unverified carried context

- Prior signed-in admin and show creator/cast browser flows remain open. The unrelated Supabase connector project that reported `INACTIVE` was not the linked site project.
- Untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`), `.claude/launch.json` stale `caught-up-worktree` entry and `.claude/worktrees/affectionate-lamarr-f2d2cb` were carried forward without re-checking ownership.
