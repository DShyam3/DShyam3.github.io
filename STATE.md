# State

Updated 2026-11-22. Branch `discover-history`, HEAD `fc16742f` = origin/main (pushed). Tree clean at close.

## Closed

- Discover as taste data, step 2: Likely seen reads the whole watch history; Not seen is its own answer (`fc16742f`, pushed to main 2026-11-22, Pages run `45065607302` green). Migration `20261122201711_watchlist_not_seen` applied to hosted the same day: table `watchlist_not_seen`, RLS on (Public Read Access, Admin insert, Admin delete), grants anon SELECT, authenticated SELECT,INSERT,DELETE; 0 rows; no new security advisors. Decisions: `REHAUL_HISTORY.md`, 2026-11-22.
- Step 1 (`ec6881fa`, migration `20261122192738_watchlist_dismissal_reasons`) live as recorded in `REHAUL_HISTORY.md`, 2026-11-22.
- Discover and Franchises read Wikidata TV spin-offs and film universes from a nightly cache (`f618f259`, migration `20261122195334`, live; on origin/main since `fc16742f`; `tmdb-proxy` v26, `watchlist-cron-sync` v31; shard 2 by hand 19:59:47Z stored both rows). Decisions: `REHAUL_HISTORY.md`, 2026-11-22.

## Checks (`fc16742f`, 2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 126 files, 2,975 pass |
| `npm run build` | pass |
| `npm run typecheck:functions` | not re-run at `fc16742f` (pass at `f618f259`) |
| `npm run test:functions` | not re-run at `fc16742f` (44 pass at `f618f259`) |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

Step 2 migration run twice on a scratch Postgres (owner writes, others refused, anon read, bad media rejected, re-run no-op). From the Wikidata-cache session (`f618f259`): one earlier vitest run had 2 failures that did not reproduce in four later runs; unidentified.

Verified, signed out, on live: Likely seen and YOU MIGHT LIKE both appeared; people tiles showed (e.g. "Constantine — By Francis Lawrence"); `watchlist_not_seen` read returned 200. Not seen removing a tile was checked on a local dev server only. YOU MIGHT LIKE took about 40s to show 4 tiles (paging known titles; Browser pane hidden, which throttles timers).

## Not verified (carry forward)

- Signed-in owner view of steps 1 and 2: Not interested and Skip these writing source; skip-to-Not-interested upgrade; skipped titles in Likely seen; Not seen written to `watchlist_not_seen`. `REHAUL_PLAN.md` "Discover as taste data" item 4.
- Reviewer (Opus), step 2: all findings fixed but the duplicated hook setup (`useNotSeen` repeats `useDismissedSuggestions`' pattern), left by choice; fixes not re-reviewed. Same for `ec6881fa`: a dismissed title can be "Next up" on a collapsed Franchises card, undimmed.
- Live cache reads for the Wikidata rows (zero Wikidata proxy calls on a cold load): not confirmed on live.
- Same-day gap: a show added, hidden or stopped changes the visitor's seed list, so visitors use the proxy until the next nightly run. Not closed (a library_state trigger was suggested).
- Sibling-franchise query times out on nearly every call: no sibling shows for visitors; about 8s of each proxy spin-off call.
- Proxy reads only the first 400 of 434 visible shows; 34 never get a spin-off lookup (pre-existing).
- Scheduled 06:00-06:20Z sync: `watchlist_collection_parts` `synced_at` advances; the guard keeps a watched or rated episode (unverified until a run deletes something).
- Not browser-verified on live: custom `franchise` override and year-dedupe; `tv-spinoffs` v2; Franchises film universes and merged cards; Favourites tab and search; Coming soon priority.
- Launch checklist manual checks open: Check 1 (phone), 5 (PageSpeed), 6 (`umami.disabled`), 10 (private window).

## Next

1. Signed-in owner check of steps 1 and 2 (list above); then `REHAUL_PLAN.md` "Discover as taste data" items 1-3: taste profile; wildcards; "Seen it" in Discover offers the rating.
3. Fresh signed-out live load: expect both Wikidata rows read and no Wikidata proxy calls.
4. Watch the 06:20Z run on 2026-11-23: both `watchlist_wikidata_cache` rows' `synced_at` advance.

## Still open elsewhere

- Worktree `.claude/worktrees/discover-walk-lane`: uncommitted lane pacer on `69d8ea51`; may be unnecessary now the walk reads the parts cache.
- Shared checkout `/Users/dhyanshyam/Projects/DShyam3.github.io`: behind origin/main, another session's uncommitted STATE.md, untracked `src/features/dev/`. Its `node_modules` (19:26, older `package.json`) lacks `@radix-ui/react-toast`; worktrees symlinking it fail typecheck.
- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`): uncommitted, not deployed; `reviewer` not run. Was `git stash@{0}`; re-find before use.
- YOU MIGHT LIKE stays empty for the owner (all 1,120 suggestions from the first 28 seeds already in library, favourited or dismissed).
- Discover order on the owner's data (`REHAUL_PLAN.md` item 11): not re-checked since `48bdbdcf`.
- Cron sync (`REHAUL_PLAN.md` item 10): season delete not atomic; function not unit-tested. Shard 1 reported 615 of 616, not investigated.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, frame rate) or live; hover outline, globe lock, GeoNames names, colours not checked on live.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Blockers

- Uncommitted `/dev` files and `DotMatrixGlobe.tsx` from other sessions must stay separate.
- Revolut bank access renewal.
