# State

Updated 2026-11-23. Branch `discover-dislikes`. main = origin/main at `70cf978f`. This worktree is on the same commit, with STATE.md the only uncommitted file (this close-out).

## Closed
- **Route error screen** (`70cf978f`, deployed in run `45275294640`). `src/components/layout/RouteErrorBoundary.tsx`, its test (4 tests), and `src/App.tsx` wrap the top-level Suspense/Routes.
  - A page outside Finance that fails to render shows a full-screen message, not a blank page. A file that did not load reads "This page could not load. Check your connection, then reload the page." Any other render error reads "This page ran into a problem."
  - Buttons: Reload page, and Back to home away from `/`. A path change clears it. Does not use AppShell, because the docked Watchlist detail would throw a second time.
  - Verified on a local production build: Dev and Travel chunks hidden, error screen shows; with Watchlist docked at 1440px, Travel shows the error screen, not a blank page.
  - Live: `/assets/index-BBS5oYKH.js` contains both messages and the stale-chunk handler (curl). https://dshyam3.github.io/travel rendered normally, no console errors.
  - Reviewed by `reviewer` (Opus); its findings were fixed.
- **Hosted migration name match** (`70cf978f`, no database change). `20261122221500_watchlist_atomic_prune.sql` renamed to `20261122222356_watchlist_atomic_prune.sql` to match hosted history. Hosted statements are byte-identical to the file minus comment lines (md5 matched).
- **Stale-chunk reload** (`4c0439d7`). Deploy run `45240037699` succeeded; live entry `/assets/index-BBZ2BVL_.js` contains the `vite:preloadError` handler (curl). Files: `src/lib/stale-chunk-reload.ts`, its test, `src/main.tsx`. Verified locally only (see Still open).
- **Discover as taste data, step 4: dislikes count** (`8d8ca5fc`). Deployed in run `45188378499`; live bundle `index-cncDFdgj.js`. Migration `20261123135113_watchlist_dismissal_facts` applied to hosted. Backfill: 1,694 answers on hosted, 0 without facts. Decisions in `REHAUL_HISTORY.md` ("Discover answers carry their title's facts, so dislikes count").
- **Discover steps 1–3** (answers store why and where; Likely seen and Not seen; taste profile ordering). `ec6881fa`, `fc16742f`, `fbe288dd`, live via `00527d91`. Migrations `20261122192738` and `20261122201711` applied to hosted.
- **UI polish** (`734971af`, `ce7706cb`): command-input focus ring, rail scrollbar, timeline alignment, tooltips, dev table scroll.
- **Watchlist atomic prune & cron sync** (`1a69f6d8`): atomic TV prune RPCs, cron sync tests, Phone News switches, up-next cleanup.

## Checks (2026-11-23, `70cf978f`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 131 files / 3,041 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `npm run typecheck:functions` | not run (no `supabase/functions` change) |
| SQL test `supabase/tests/watchlist_dismissal_facts.sql` | pass on scratch Postgres with real migrations; fails against a no-op trigger (`8d8ca5fc`) |

## Still open (not verified)
- **Route error screen on Pages**: live but not seen triggered there; only on a local production build.
- **Stale-chunk reload on GitHub Pages**: verified locally only. The `70cf978f` deploy was the first after `4c0439d7`, but no tab from the old build was open to observe it. Check on the next deploy after `70cf978f`, in a tab opened before that deploy.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) renders AppShell in its fallback. It can throw a second time the same way if Finance fails while a Watchlist detail is docked. Pre-existing, not fixed.
- **Local Supabase stack**: a local stack that applied the old file still records `20261122221500`. Fix with `supabase db reset` or `supabase migration repair --local --status reverted 20261122221500`. Not checked whether any local stack has it.
- **Signed-in owner browser check** of Discover, steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Wildcards** (REHAUL_PLAN, Discover item 1): a few well-rated titles outside usual genres per page of YOU MIGHT LIKE, labelled as such.
2. **Seen it offers the rating** (REHAUL_PLAN, Discover item 2): Discover's Seen it asks for the rating where the tile was.
3. **Browser check signed in as the owner** (REHAUL_PLAN, Discover item 3): steps 1–3 and dislikes.

## Blockers
- Item 3 needs the owner's signed-in session; no agent can perform it.
