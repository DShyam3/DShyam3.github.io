# State

Updated 2026-11-22. Branch `claude/tv-spinoff-links-cache`, HEAD `f618f259`, rebased on origin/main `7024bd5f`. **Not pushed.** Tree clean at close.

## Closed

- Discover and Franchises read Wikidata TV spin-offs and film universes from a nightly cache (`f618f259`). Decisions: `REHAUL_HISTORY.md`, 2026-11-22.
- Live, owner approved: migration `20261122195334` applied to `yvtiybyuifkiwyrnjebe` (grants anon and authenticated SELECT only); `tmdb-proxy` v26 and `watchlist-cron-sync` v31 deployed by CLI from `f618f259`. Shard 2 run by hand 19:59:47Z: success, 43.5s, stored both rows.
- Verified on local builds against the live backend, signed out (not the live site): cache answers match a fresh proxy call; cold load reads both rows at about 0.9s with zero Wikidata or collection proxy calls.
- Live site still runs the pre-cache client until `f618f259` is pushed and Pages deploys.

## Checks (`f618f259`, 2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm test` | 125 files, 2,964 pass |
| `npm run test:functions` | 44 pass |
| `npm run build` | pass |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

One earlier vitest run had 2 failures that did not reproduce in four later runs. Not identified; unverified.

## Not verified (carry forward)

- Pushed client on the live site: not browser-checked. The 06:20Z run of 2026-11-23 has not been observed refreshing both rows.
- Same-day gap: a show added, hidden or stopped changes the visitor's seed list, so visitors use the proxy until the next nightly run. Not closed (a library_state trigger was suggested).
- Sibling-franchise query times out on nearly every call: no sibling shows for visitors; about 8s of each proxy spin-off call.
- Proxy reads only the first 400 of 434 visible shows; 34 never get a spin-off lookup (pre-existing).
- Signed-in owner view of `ec6881fa` (Not interested and Skip these writing source; skip-to-Not-interested upgrade; Likely seen). `REHAUL_PLAN.md` "Discover as taste data" item 4.
- Reviewer (Opus) findings for `ec6881fa` addressed, not re-reviewed. A dismissed title can be "Next up" on a collapsed Franchises card, undimmed.
- Scheduled 06:00-06:20Z sync: `watchlist_collection_parts` `synced_at` advances; the guard keeps a watched or rated episode (unverified until a run deletes something).
- Not browser-verified on live: custom `franchise` override and year-dedupe; `tv-spinoffs` v2; Franchises film universes and merged cards; Favourites tab and search; Coming soon priority.
- Launch checklist manual checks open: Check 1 (phone), 5 (PageSpeed), 6 (`umami.disabled`), 10 (private window).

## Next

1. Owner's OK to push `f618f259` to origin/main.
2. After Pages deploys: fresh signed-out load on the live site; expect both rows read and no Wikidata proxy calls.
3. Watch the 06:20Z run on 2026-11-23: both `watchlist_wikidata_cache` rows' `synced_at` advance.
4. Then `REHAUL_PLAN.md` "Discover as taste data" items 1-3 and the signed-in owner check above.

## Still open elsewhere

- Worktree `.claude/worktrees/discover-walk-lane`: uncommitted lane pacer on `69d8ea51`; may be unnecessary now the walk reads the parts cache.
- Shared checkout `/Users/dhyanshyam/Projects/DShyam3.github.io`: behind origin/main, another session's uncommitted STATE.md, untracked `src/features/dev/`.
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
