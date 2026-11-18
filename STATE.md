# State

Updated 2026-11-18 · Branch `main` · Head `0ba78391`, pushed to `origin/main` with the owner’s approval (including prior docs commit `6d848708`). Discovery fixes are deployed: Pages run `44376019120` at `0ba78391` succeeded.

## Deployed — Discovery fixes (`0ba78391`)

- `useTMDB.ts`, `discovery-add.ts`, `DiscoverySection.tsx`: Discover preserves validated series status and fetched director, creator and cast details. Seen it puts a fully watched ended/cancelled series in Finished rather than Up to date.
- `discovery.ts`, `DiscoverySection.tsx`: Coming soon alternates eligible films and series before its 12-tile limit, preserves each source's order, and fills remaining slots from whichever list remains. Regression tests cover these behaviours and missing versus empty credits.
- FEATURES.md describes the tree. No schema or Edge Function changes. No historical data was changed.
- Still open: signed-in browser writes and production behaviour verification. Commit/push and deployment are confirmed.

## Checks — Discovery fixes, 2026-11-18

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` / `typecheck:functions` | pass / pass |
| Watchlist and Supabase tests | 312/312, 18 files |
| `npm run build` | pass |
| Pages CI `44376019120` at `0ba78391` | lint, both typechecks, full Test, Build and Deploy passed; full test count not inspected |
| `graphify update .` | run |
| Reviewer (high reasoning tier) | no actionable findings in the scoped fixes |
| `npm run ship-check` | 91/100; Do not launch. Existing airport-code AWS-key false positive, dependency advisories, N+1 and other repository findings remain unresolved |

Local results above come from this session. CI subsequently passed the full test suite; its count was not inspected. Signed-in browser writes remain unverified.

## Deployed baseline

- Watchlist redesign `63fa21b6`, with docs `49a186ec`, deployed by Pages run 44306812884: Following/Discover, status shelves, grouped search, stable shelf while details are open, Recently watched ordering, owner-only ratings, and cached recommendation seeds.
- Hosted migrations applied, owner-approved: `20261117193741_watchlist_history_ratings`, `20261118074402_watchlist_dismissed_suggestions`, `20261118074422_watchlist_private_ratings`. Public rating columns are gone. `tmdb-proxy` v14 supports discovery.
- Baseline checks 2026-11-18: lint 0/0, both typechecks, build, graphify; full suite 2,609/2,609 (89 files); hosted advisors found nothing for the new objects.
- Baseline signed-out production desktop: Finished (78) sorted Recently watched; public view returns 200 with no ratings read; Discover has 12 Coming soon and 72 suggestions, proxy calls 200. Only console errors were GitHub Pages' deep-link document 404s before SPA fallback.
- NOT verified: signed-in rating film/season/episode and reload, Seen it, favourite toggle, dismissal sync; light mode; real phone. Prior local signed-out desktop checks covered grouped search and Discover leave/return paging.
- Credits and typed title identity: `12bb88d9` and `3d17b507` deployed, Pages run 44206083694; hosted credits migration `20261118001210`, cron sync v17. Backfill: 952/952 films, 341/342 shows; remaining gaps are TMDB's, including Cyberpunk: Edgerunners 2 (404). Show creator/cast rendering, light theme and real phone remain unverified.

## Next

1. Verify the deployed Discovery fixes in production: mixed Coming soon results and preserved status/credits on add.
2. Signed-in owner browser check: Seen it for an ended show, saved credits, ratings and reload, favourites, and cross-device dismissal sync.
3. Continue `REHAUL_PLAN.md` → “Watchlist News and Library — what is left”.

## Blockers and retained work

- Parallel sessions share the checkout: fetch first, one committer. Keep `backup/pre-rebase-2026-11-03` until signed-in production is verified and stash `watchlist-redesign-before-ff` until the owner says to drop it.
- Preserve unrelated `.claude/launch.json`, REHAUL_PLAN.md Part 4 Personal tracking expansion, and untracked `SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`.
- `.claude/worktrees/affectionate-lamarr-f2d2cb` is detached at d46bdecf, owner unknown. Credits worktree/branch were deleted and own nothing in this tree.

## Open risks

- Hosted About text rows have `section` NULL, so About uses the `site.json` fallback.
- Warm-up sends about 30 anonymous reads, including the full Watchlist library.
- 2,447 of 2,532 watched episodes have no watch date (earliest dated 2026-09-13); older finished series sort after dated titles under Recently watched.
