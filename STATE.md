# State

Updated 2026-11-23. `origin/main` has `8d8ca5fc` and this close-out, pushed from worktree `.claude/worktrees/discover-answers` (branch `discover-dislikes`). The main checkout is behind: it holds another session's unpushed `ec9219d4`.

## Closed
- **Discover as taste data, step 4: dislikes count** (`8d8ca5fc`, "feat(watchlist): Discover answers carry genres, so dislikes count in the taste profile"). Deployed to GitHub Pages, run `45188378499`, success, 2026-11-23; live bundle `index-cncDFdgj.js` has the code.
  - Migration `20261123135113_watchlist_dismissal_facts` applied to hosted `yvtiybyuifkiwyrnjebe` on 2026-11-23.
  - Backfill: 1,679 existing answers filled from TMDB (1,666 with genres, 13 with only language or year). A rerun after the deploy filled 15 more rows the old live client wrote in between. Hosted: 1,694 answers, 0 without facts.
  - Decisions recorded in `REHAUL_HISTORY.md` ("Discover answers carry their title's facts, so dislikes count", 2026-11-23).
- **Discover steps 1–3** (answers store why and where; Likely seen and Not seen; taste profile ordering YOU MIGHT LIKE): `ec6881fa`, `fc16742f`, `fbe288dd` (live via `00527d91`). Migrations `20261122192738` and `20261122201711` applied to hosted. Signed-in owner check still open (below).
- **Watchlist atomic prune & cron sync** (`1a69f6d8`): atomic TV prune RPCs, cron sync unit tests, Phone News switches, up-next cleanup. Hosted migration version mismatch still open (below).

## Checks (2026-11-23, on `8d8ca5fc` after rebasing onto `origin/main`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npx vitest run` | 129 files / 3,027 tests pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| SQL test `supabase/tests/watchlist_dismissal_facts.sql` | pass on scratch Postgres with real migrations; fails against a no-op trigger |
| `npm run typecheck:functions` | not run (no `supabase/functions` change in `8d8ca5fc`) |
| Live check, signed out only | YOU MIGHT LIKE reads "films lean to Action, Adventure, Comedy · 2010s · English; series lean to Drama, Adventure, Action · 2020s · English." No "away from" line, correct for the data |

## Still open (not verified)
- **Signed-in owner browser check** of Discover, steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **graphify and floorplan not refreshed for `8d8ca5fc`**: `graphify update .` and `floorplan/recent-work.json` + `build.mjs` were not run. The main checkout holds another session's unpushed local commit `ec9219d4` (docs(state)) and has diverged from `origin/main`, so it was left alone.
- **Hosted migration name mismatch**: hosted `20261122222356 watchlist_atomic_prune` does not match repo file `20261122221500_watchlist_atomic_prune.sql`. Another session's work; not fixed here.
- **Stale lazy chunks after a deploy**: `/dev` and other lazy routes 404 for an open tab still holding the previous index bundle (it asks for `Dev-Bh8fq8UC.js`; current is `Dev-2ZNEztG4.js`). No reload-on-`vite:preloadError` handler exists. Not fixed.
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Wildcards** (REHAUL_PLAN, Discover item 1): a few well-rated titles outside usual genres per page of YOU MIGHT LIKE, labelled as such.
2. **Seen it offers the rating** (REHAUL_PLAN, Discover item 2): Discover's Seen it asks for the rating where the tile was.
3. **Browser check signed in as the owner** (REHAUL_PLAN, Discover item 3): steps 1–3 and dislikes.

## Blockers
- Item 3 needs the owner's signed-in session; no agent can perform it.
- Migration version mismatch above needs a decision on which name hosted keeps.
