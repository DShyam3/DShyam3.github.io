# State

Updated 2026-11-18 · Branch `main` · Head `63fa21b6` · 1 ahead of `origin/main` (`3d17b507`). `63fa21b6` is committed but NOT pushed, so NOT deployed: the live site still runs `3d17b507`.

## In progress

**Watchlist News and Library redesign: committed as `63fa21b6`, not pushed.** Open: push to origin/main (deploys via GitHub Pages), awaiting the owner's go-ahead in the redesign session.

- News: Following and Discover tabs; All / Films / Series switch. Discover mixes five seed groups; Show more continues with the next seeds after leaving and returning. Recommendations wait for the owner's ratings.
- Library: status shelves with a hint line; search groups results by shelf ("All shelves"); shelves hold while a detail is open; Finished sorts by Recently watched, series by their latest watched episode.
- Ratings: tap picker and prompts; stored in the owner-only `watchlist_ratings` table and read by a separate owner query, never in the public library read. Rating controls show only once ratings have loaded.
- Removed dead code: `UpNextRail.tsx`, `CountdownCard.tsx`, `useUpNext.ts`, about 120 lines of column-workspace CSS, the Up Next warm-up read.
- Hosted migrations applied (project `yvtiybyuifkiwyrnjebe`, owner-approved; the commit is unchanged from them): `20261117193741_watchlist_history_ratings`, `20261118074402_watchlist_dismissed_suggestions`, `20261118074422_watchlist_private_ratings`. The public `personal_rating` columns are gone. The live site never read them, so it is not broken meanwhile.
- Hosted `tmdb-proxy` v14 already allows the discover and recommendations routes, so no function deploy is needed.
- Backup `git stash` entry `stash@{0}` "watchlist-redesign-before-ff" (pre-merge copy) stays until the owner says to drop it.

## Checks (2026-11-18, committed tree `63fa21b6`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` / `typecheck:functions` | pass / pass |
| `npx vitest run` | 2,609 / 2,609 (89 files) |
| `npm run build` | pass |
| `graphify update .` | run |
| Hosted advisors (security, performance) | nothing for the new objects |

Browser-verified signed out, desktop, local dev server against hosted, no console errors: Finished sort puts "Don't Trust the B---- in Apartment 23" second, after 22 Jump Street; Discover leave-and-return then Show more loads the next four seeds; grouped search "the" shows To watch 41, Upcoming 1, Up to date 2, Finished 4.

NOT verified: anything signed in as admin (rating a film, season and episode; Seen it from Discover; favourite toggle; "Not interested" sync; ratings read back from `watchlist_ratings`); light mode; a real phone; production after deploy.

## Next

1. Owner go-ahead, then push `63fa21b6` and confirm the Pages run succeeds.
2. Signed-in owner check on production (the NOT-verified list above).
3. The plan's "Watchlist News and Library — what is left" items: see `REHAUL_PLAN.md`, not copied here.

## Landed (credits session, pushed and deployed)

- `12bb88d9` fix(watchlist): a film and a show that share a row id are told apart (`TitleRef`, `src/features/watchlist/title-ref.ts`).
- `3d17b507` feat(watchlist): directors, creators and top cast in a title's details; FEATURES.md "Credits" bullet. Pushed `e3708d80..3d17b507`; Pages run 44206083694 succeeded. Hosted migration `watchlist_credits` applied as `20261118001210`; `watchlist-cron-sync` v17 deployed.
- Backfill complete 2026-11-18: 952/952 films and 341/342 shows have credits. Gaps are TMDB's: 2 films with empty cast, 4 with no director, 59 shows with no "Created by", 1 empty show, and Cyberpunk: Edgerunners 2 (TMDB 404s tv/326788, pre-existing).
- NOT verified: a show's "Created by" and cast rendered in the production dialog (data is in the rows; UI checked for a film only); light theme; a real phone.
- The credits worktree `.claude/worktrees/watchlist-credits` and branch `feat/watchlist-credits` are deleted; that session owns nothing in the tree.

## Blockers

- Parallel sessions share one checkout, and cloud sessions push to `main`: fetch first, one committer. Keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
- Left uncommitted on purpose, not this work's: `.claude/launch.json` (another session's preview entries), the REHAUL_PLAN.md section "Part 4 — Personal tracking expansion" (owner unknown), untracked drafts `SITE_PLAN.md`, `google_implementation_redesign.md` and `gpt_implementation redesign.md`.
- Worktree `.claude/worktrees/affectionate-lamarr-f2d2cb` (detached at d46bdecf), owner unknown.

## Open risks

- Hosted `site_content` `about_me_1` / `about_me_2` have `section` NULL, so About shows the `site.json` fallback.
- Warm-up sends about 30 anonymous reads, including the full Watchlist library.
- Most watched episodes have no watch date: 2,447 of 2,532 on hosted (earliest dated 2026-09-13), so older finished series sort after dated titles under Recently watched.
