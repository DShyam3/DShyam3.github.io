# State

Updated 2026-11-22. Branch `discover-answers`, HEAD `ec6881fa` (also origin/main). Pushed to main 2026-11-22; GitHub Pages run `45061004897` green.

## Live

- Discover answers record why and where (`ec6881fa`). Migration `20261122192738_watchlist_dismissal_reasons` applied to hosted (`yvtiybyuifkiwyrnjebe`) the same day: 1,168 answers Not interested, 511 Skip. Backfilled from shared `created_at`; the earliest group of 44 (first browser handover) kept as Not interested. Live table has the Admin update policy, UPDATE grant for authenticated, and trigger `tr_watchlist_dismissed_suggestions_keep_stronger`. Advisors: no new findings.
- Signed-out live check: client reads reason, source, answered_at (both pages 206); "Skip these" button and new footnote live. Visitor view at check time: 4 franchise cards, 1 Likely seen tile.
- Collection parts cache (`5299a8c7`): migration `20261122170000_watchlist_collection_parts.sql` applied via MCP, 218 of 218 collections, 672 parts. `watchlist-cron-sync` v29 deployed (CLI, verify_jwt true), keeps the watched-or-rated guard. Pages run `45059621340` succeeded.
- Discover ordering by last activity (`31819643`, main `36324d8d`): migration applied; 0 of 1,227 films and 0 of 423 series stamped, by design.
- Live check (dshyam3.github.io, signed out, fresh, ~19:27Z): 0 collection calls through tmdb-proxy, one parts read (193ms), walk done 5.1s after the HTML arrived. `wikidata/tv-spinoffs` returned 502 (Wikidata upstream, per function logs), so the section showed its "couldn't load" line; Retry got 200 in 9.5s and the end state matched (no cards). The 17.5s local wait at 19:01Z was a Wikidata sibling-lookup timeout (logs). Signed-in owner path not checked.
- Dev ports on tmdb-proxy's origin allowlist: 8080, 8081, 8082, 5173.

## Checks

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings, 2026-11-22, before push at `ec6881fa` |
| `npm run typecheck` | pass, 2026-11-22, before push at `ec6881fa` |
| `npm test` | 124 files, 2,949 pass, 2026-11-22, before push at `ec6881fa` |
| `npm run build` | pass, 2026-11-22, before push at `ec6881fa` |
| migration on scratch Postgres | run twice; backfill, trigger, RLS, idempotency as intended, 2026-11-22 |
| `npm run typecheck:functions`, `npm run test:functions` | last run at `5299a8c7` (39 pass); not re-run for `ec6881fa` |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Not verified (carry forward)

- Signed-in owner view of `ec6881fa`: Not interested and Skip these writing their source; a skip upgraded to Not interested; skipped titles reappearing in Likely seen. This is `REHAUL_PLAN.md` "Discover as taste data" item 4.
- Reviewer (Opus) findings were all addressed; the fixes were not re-reviewed.
- Dismissed title can still be named "Next up" on a collapsed Franchises card; the poster strip does not dim it.
- Scheduled 06:00-06:20Z `watchlist-cron-sync` run: `watchlist_collection_parts` `synced_at` advances, and the v29 guard keeps a watched or rated episode (unverified until a run deletes something).
- Watchlist items from earlier commits, not browser-verified on live: custom `franchise` override and year-dedupe; `tv-spinoffs` v2; Franchises film universes and merged cards; Favourites tab and search; Coming soon priority.
- Launch checklist manual checks open: phone pass (Check 1), mobile PageSpeed (Check 5), `umami.disabled` in owner browsers (Check 6), private-window walkthrough (Check 10).

## Next

1. `REHAUL_PLAN.md` "Discover as taste data" items 1-3: Have you already watched? from whole history; taste profile; wildcards. Whole history is needed: of 79 collections in the parts cache on 2026-11-22, 7 released films were missing, and all 7 had been turned down one at a time, so the shipped reasons alone do not fill that section.
2. Browser-verify the signed-in owner path (see Not verified).

## Still open elsewhere

- Worktree `.claude/worktrees/discover-walk-lane`: uncommitted lane pacer for the Discover collection walk (`call-pacer.ts`, `call-pacer.test.ts`, `useDiscovery.ts`, `STATE.md`), based on `69d8ea51`. May be unnecessary now the walk reads the parts cache (`5299a8c7`); not checked. Not committed, not pushed.
- Shared checkout `/Users/dhyanshyam/Projects/DShyam3.github.io`: 14+ commits behind origin/main, another session's uncommitted STATE.md edit, untracked `src/features/dev/`. Its dev server on :8080 serves old Discover code.
- `/dev` status board and History rework (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`, `.test.ts`): uncommitted, not deployed. Was `git stash@{0}`; re-find the entry before use. `reviewer` not run.
- Fresh visitor in All still waits for the Wikidata TV spin-off lookup: a 17.5s timeout in one sample, a 502 in another, 9.5s on retry. A follow-up to cache spin-off links server-side is proposed, not started.
- YOU MIGHT LIKE stays empty for the owner: all 1,120 suggestions from the first 28 seeds are already in the library, favourited, or dismissed. Needs a decision on digging deeper per seed.
- Discover order on the owner's data (`REHAUL_PLAN.md` item 11): stall fixed in `48bdbdcf`; order not re-checked.
- Cron sync (`REHAUL_PLAN.md` item 10): season delete is not atomic (a SQL-function fix would be a migration, optional); the function itself is not unit-tested, only `_shared/owner-data.ts`. Shard 1 reported 615 of 616 synced, not investigated.
- Travel hexes not verified on phone (pinch to 32x, GPU memory, frame rate); hovered-hex outline, two-minute globe lock, GeoNames town names, "near" fallback, colours not checked on live. Regenerating hex data needs GeoNames' cities1000.zip in `.cache/geonames/`.
- Local DB drifted: `supabase migration up --local` fails at `20261117193741`; `supabase db reset` restores it.
- Verify OMDb weekly refresh (~2026-11-25).

## Blockers

- Uncommitted `/dev` files and `DotMatrixGlobe.tsx` from other sessions must stay separate.
- Revolut bank access renewal.
