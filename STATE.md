# State

Updated 2026-11-24. Branch `discover-dislikes`. origin/main at `4c410a04` (docs), after `12e24973` (Wildcards).

## In progress (uncommitted, in the tree)
- **Seen it offers the rating** (REHAUL_PLAN, Discover item 1, now removed from the plan list). Not committed, not pushed, not deployed.
  - Files: `src/features/watchlist/components/DiscoverySection.tsx`, `components/PersonalRating.tsx` (optional `autoFocus` and `showLabel` props), `src/features/watchlist/discovery.ts` (`keepHeldInPlace`, `HeldTile`), `discovery.test.ts` (5 `keepHeldInPlace` tests), plus `FEATURES.md` and `REHAUL_PLAN.md`.
  - Behaviour: Seen it on a Discover tile keeps the tile in place and asks for the rating. Rating or skipping lets it go and the next tile takes its place.
  - Verified on the LOCAL Supabase stack only (`npm run dev:test`, port 5173, signed in as the seeded local test admin, tmdb-proxy served locally): films and a series, via tile and details dialog, keyboard and pointer. Tile keeps its place; footer one row, same height as neighbours; focus lands on Rate, then moves to the tile that takes the place. Ratings rows landed by `movie_id` / `tv_show_id`; skipped titles wrote none. Tab switch lets a waiting tile go; Skip these keeps a waiting tile. 375px layout with 44px targets. Local test rows deleted afterwards.
  - Reviewer (Opus) found 3 bugs and 2 risks, plus 1 nit. All fixed. The tab fix was then reworked after local testing showed a hidden held tile lost its prompt. Not re-reviewed after the fixes.
  - Not seen on the live site. Not checked as the owner.

## Checks (2026-11-24, on the tree with Seen it offers the rating, uncommitted)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `impeccable` against running `/watchlist` | 3 reported (header blinking cursor, 2 nested cards) on the signed-out Following panel. Not from this change |
| `npx vitest run` | 132 files / 3,066 tests pass in 7 runs. One earlier run had 2 failing tests that did not reproduce; names not captured. Recorded as flaky and unexplained, unverified |
| `npm run typecheck:functions` | not run (no `supabase/functions` change) |
| `npm run ship-check` | not run |
| `graphify update .`, floorplan refresh / build | not run for this change |

## Closed (recent)
- **Wildcards** (`12e24973`, pushed, deployed in run `45474511099`). Some YOU MIGHT LIKE tiles are well-loved titles from a genre outside the usual, labelled `Wildcard · <Genre>`, at most one per five other tiles. Live bundle grep only. Signed-out local production check only. Decision in `REHAUL_HISTORY.md` (2026-11-23).
- **Route error screen** (`70cf978f`, deployed in run `45275294640`). A page outside Finance that fails to render shows a full-screen message. Verified on a local production build only; live bundle contains the messages.
- **Hosted migration name match** (`70cf978f`, no database change). `20261122221500_watchlist_atomic_prune.sql` renamed to `20261122222356_watchlist_atomic_prune.sql` to match hosted history (md5 of statements matched).
- **Stale-chunk reload** (`4c0439d7`, deploy run `45240037699`). Verified locally only.
- **Discover dislikes count** (`8d8ca5fc`, deploy run `45188378499`). Migration `20261123135113_watchlist_dismissal_facts` applied to hosted; 1,694 answers, 0 without facts. Decision in `REHAUL_HISTORY.md`.
- **Discover steps 1–3** (`ec6881fa`, `fc16742f`, `fbe288dd`, live via `00527d91`). Migrations `20261122192738` and `20261122201711` applied to hosted.
- **Watchlist atomic prune and cron sync** (`1a69f6d8`), UI polish (`734971af`, `ce7706cb`).

## Still open (not verified)
- **Seen it offers the rating**: not committed; not seen on the live site; reviewer fixes not re-reviewed.
- **Wildcards**: not seen in a browser on the live site, not checked signed in as the owner. Reviewer fixes not re-reviewed.
- **Route error screen on Pages**: live, but not seen triggered there.
- **Stale-chunk reload on GitHub Pages**: verified locally only. Needs a tab opened before a deploy, observed after it.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) renders AppShell in its fallback. Can throw a second time if Finance fails while a Watchlist detail is docked. Pre-existing, not fixed.
- **Local Supabase stack**: checked and clean. It was at `20261122201711`; `supabase migration up --local` applied `20261122222356` and `20261123135113`, so it is now at `20261123135113`. It never recorded `20261122221500`. Other local stacks unknown; fix one with `supabase db reset` or `supabase migration repair --local --status reverted 20261122221500`.
- **Signed-in owner browser check** of Discover steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **Discover order on the owner's data**: not run since the walk stall fix (`48bdbdcf`).
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Commit and ship "Seen it offers the rating"** when the owner says so. Fetch origin first; check for peer sessions on this tree.
2. **Signed-in owner browser check** (REHAUL_PLAN Discover item 1): steps 1–3, dislikes, the taste line from the whole library, and Seen it's rating offer on a Discover tile.

## Blockers
- Item 2 needs the owner's signed-in session; no agent can perform it.
