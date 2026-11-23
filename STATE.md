# State

Updated 2026-11-23. Branch `main` = `origin/main` at `4c0439d7`. This worktree is on `discover-dislikes` at the same commit, clean.

## Closed
- **Stale-chunk reload** (`4c0439d7`, "fix(app): reload a tab left open across a deploy when a lazy page's file is gone"). Deploy run `45240037699` succeeded on 2026-11-23; live entry `/assets/index-BBZ2BVL_.js` contains the `vite:preloadError` handler and the `stale-chunk-reloaded-from` key (checked with curl). Files: `src/lib/stale-chunk-reload.ts`, its test, `src/main.tsx`.
  - Verified on a local production build only: same build with a missing chunk did not reload; a new build reloaded once into the new entry.
  - **Not yet seen on GitHub Pages across a real deploy.** Only tabs opened on `4c0439d7` or later carry the handler, so the first real test is the next deploy.
- **UI polish** (`734971af`, `ce7706cb`): command-input focus ring, rail scrollbar, timeline alignment, tooltips, dev table scroll.
- **Discover as taste data, step 4: dislikes count** (`8d8ca5fc`). Deployed, run `45188378499`, 2026-11-23; live bundle `index-cncDFdgj.js`.
  - Migration `20261123135113_watchlist_dismissal_facts` applied to hosted `yvtiybyuifkiwyrnjebe` on 2026-11-23.
  - Backfill: 1,679 existing answers filled from TMDB (1,666 with genres, 13 with only language or year). A rerun after the deploy filled 15 more rows the old live client wrote in between. Hosted: 1,694 answers, 0 without facts.
  - Decisions in `REHAUL_HISTORY.md` ("Discover answers carry their title's facts, so dislikes count", 2026-11-23).
- **Discover steps 1–3** (answers store why and where; Likely seen and Not seen; taste profile ordering YOU MIGHT LIKE): `ec6881fa`, `fc16742f`, `fbe288dd` (live via `00527d91`). Migrations `20261122192738` and `20261122201711` applied to hosted.
- **Watchlist atomic prune & cron sync** (`1a69f6d8`): atomic TV prune RPCs, cron sync unit tests, Phone News switches, up-next cleanup.

## Checks (2026-11-23, on `4c0439d7`, rebased onto `734971af`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | 130 files / 3,037 tests pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns (1 advisory note) |
| `npm run typecheck:functions` | not run (no `supabase/functions` change) |
| SQL test `supabase/tests/watchlist_dismissal_facts.sql` | pass on scratch Postgres with real migrations; fails against a no-op trigger (`8d8ca5fc`) |
| Live check, signed out only | YOU MIGHT LIKE reads "films lean to Action, Adventure, Comedy · 2010s · English; series lean to Drama, Adventure, Action · 2020s · English." No "away from" line, correct for the data |

## Still open (not verified)
- **Stale-chunk reload on GitHub Pages**: verified locally only. Check it on the next real deploy, in a tab opened before that deploy.
- **No error boundary outside Finance**: App.tsx wraps routes in a bare `<Suspense>`, so a lazy page whose file fails to load (offline, a half-propagated deploy) can leave a blank page. The stale-build case is covered by the reload above; the rest is not.
- **Signed-in owner browser check** of Discover, steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **Hosted migration name mismatch**: hosted `20261122222356 watchlist_atomic_prune` does not match repo file `20261122221500_watchlist_atomic_prune.sql`. Another session's work; not fixed here.
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Wildcards** (REHAUL_PLAN, Discover item 1): a few well-rated titles outside usual genres per page of YOU MIGHT LIKE, labelled as such.
2. **Seen it offers the rating** (REHAUL_PLAN, Discover item 2): Discover's Seen it asks for the rating where the tile was.
3. **Browser check signed in as the owner** (REHAUL_PLAN, Discover item 3): steps 1–3 and dislikes.

## Blockers
- Item 3 needs the owner's signed-in session; no agent can perform it.
- Migration version mismatch above needs a decision on which name hosted keeps.
