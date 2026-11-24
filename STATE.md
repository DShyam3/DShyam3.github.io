# State

Updated 2026-11-24. Branch `discover-dislikes` = origin/main at `12e24973`. Wildcards pushed to main and deployed (Pages run `45474511099`, succeeded). Nothing uncommitted for this task.

## Closed
- **Wildcards** (`12e24973`, pushed to main, deployed in run `45474511099`). Files: `src/features/watchlist/wildcards.ts` and `wildcards.test.ts` (new); `discovery.ts` and `discovery.test.ts`; `useDiscovery.ts`; `taste-profile.ts`; `components/DiscoverySection.tsx`.
  - Some YOU MIGHT LIKE tiles are well-loved titles from a genre outside the usual, labelled `Wildcard · <Genre>`. At most one per five other tiles on screen.
  - Live: entry bundle `/assets/index-C2hUdu7X.js` contains the `Wildcard · ${name}` label and the `vote_count.desc` query (curl grep).
  - Verified on a local production build at localhost:5173, signed out only: "Beauty and the Beast — Wildcard · Family" showed as 1 of 7 tiles; dismissing a regular tile kept the wildcard, a new suggestion took the freed place, no new wildcard came in.
  - Reviewed by `reviewer` (Opus): allowance creep, a vanishing tile, series-only genres, empty pages. Fixed with tests. Not re-reviewed after the fixes.
  - Decisions in `REHAUL_HISTORY.md` ("Wildcards: well-loved titles outside the usual genres" — 2026-11-23).
  - FEATURES.md, REHAUL_PLAN.md and REHAUL_HISTORY.md carry the move (same commit).
- **Route error screen** (`70cf978f`, deployed in run `45275294640`). `src/components/layout/RouteErrorBoundary.tsx`, its test (4 tests), `src/App.tsx`.
  - A page outside Finance that fails to render shows a full-screen message, not a blank page. Buttons: Reload page, and Back to home away from `/`.
  - Verified on a local production build only. Live: `/assets/index-BBS5oYKH.js` contains both messages and the stale-chunk handler (curl). https://dshyam3.github.io/travel rendered normally, no console errors.
  - Reviewed by `reviewer` (Opus); findings fixed.
- **Hosted migration name match** (`70cf978f`, no database change). `20261122221500_watchlist_atomic_prune.sql` renamed to `20261122222356_watchlist_atomic_prune.sql` to match hosted history. Hosted statements byte-identical to the file minus comment lines (md5 matched).
- **Stale-chunk reload** (`4c0439d7`). Deploy run `45240037699` succeeded; live entry `/assets/index-BBZ2BVL_.js` contains the `vite:preloadError` handler (curl). Files: `src/lib/stale-chunk-reload.ts`, its test, `src/main.tsx`. Verified locally only.
- **Discover as taste data, step 4: dislikes count** (`8d8ca5fc`). Deployed in run `45188378499`; live bundle `index-cncDFdgj.js`. Migration `20261123135113_watchlist_dismissal_facts` applied to hosted. Backfill: 1,694 answers on hosted, 0 without facts. Decisions in `REHAUL_HISTORY.md` ("Discover answers carry their title's facts, so dislikes count").
- **Discover steps 1–3** (answers store why and where; Likely seen and Not seen; taste profile ordering). `ec6881fa`, `fc16742f`, `fbe288dd`, live via `00527d91`. Migrations `20261122192738` and `20261122201711` applied to hosted.
- **UI polish** (`734971af`, `ce7706cb`): command-input focus ring, rail scrollbar, timeline alignment, tooltips, dev table scroll.
- **Watchlist atomic prune & cron sync** (`1a69f6d8`): atomic TV prune RPCs, cron sync tests, Phone News switches, up-next cleanup.

## Checks (2026-11-24, on the tree committed as `12e24973`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 132 files / 3,061 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `npm run typecheck:functions` | not run for wildcards (no `supabase/functions` change) |
| `npm run ship-check` | not run for wildcards |
| SQL test `supabase/tests/watchlist_dismissal_facts.sql` | pass on scratch Postgres with real migrations (2026-11-23); fails against a no-op trigger (`8d8ca5fc`) |

Post-push: `graphify update .` and floorplan refresh / recent-work / build run in the main checkout.

## Still open (not verified)
- **Wildcards, not seen in a browser on the live site.** Live bundle grep only. Not checked signed in as the owner. Signed-out local production check only.
- **Wildcards reviewer fixes not re-reviewed.** Fixed with tests; no second `reviewer` pass.
- **Route error screen on Pages**: live but not seen triggered there; only on a local production build.
- **Stale-chunk reload on GitHub Pages**: verified locally only. Needs a tab opened before a deploy, observed after it.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) renders AppShell in its fallback. Can throw a second time if Finance fails while a Watchlist detail is docked. Pre-existing, not fixed.
- **Local Supabase stack**: a local stack that applied the old file still records `20261122221500`. Fix with `supabase db reset` or `supabase migration repair --local --status reverted 20261122221500`. Not checked whether any local stack has it.
- **Signed-in owner browser check** of Discover, steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Seen it offers the rating** (REHAUL_PLAN, Discover item 1): Discover's Seen it logs the watch but asks nothing; offer the rating where the tile was.
2. **Browser check signed in as the owner** (REHAUL_PLAN, Discover item 2): steps 1–3 and dislikes.

## Blockers
- Item 2 needs the owner's signed-in session; no agent can perform it.
