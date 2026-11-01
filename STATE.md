# State

Updated: 2026-11-01 · Branch: `claude/net-take-home-tax-f2n71j` (not merged) · Main verified: `d895a224` (deployed).

## This branch: `claude/net-take-home-tax-f2n71j`

- Head: `99f1a6d` plus the docs commit that rewrote this file. NOT merged, NOT deployed, NOT live. A PR to `main` is being opened; no PR number is recorded here.
- Landed here: the take-home-by-slice card and `ukTakeHomeBySlice` count the High Income Child Benefit Charge, split at £60,000 and £80,000 of adjusted net income. The card names the child benefit amount beneath the table and says the charge is paid through Self Assessment. FEATURES.md matches.
- History: the branch first held a separate card implementation (`b99483c`, `46d9b11`, `37d8bf4`). `main` had already shipped its own (`0c9da54`), so the owner chose to fix main's version; the branch was reset onto main and force-pushed. Those three commits are no longer on any branch.
- Reviewer (Opus) on `d816a2e`: no engine or card defects; 534k fuzzed inputs agree across slices, summary and `calculateUkTax`. Its two findings (the FEATURES.md paragraph, the Self Assessment copy) are fixed by the docs commit and `99f1a6d`.
- Known and accepted: a slice under £200 wide that straddles a charge step carries the whole 1% step, so its charge rate is capped at 100%.
- Unverified: the card with children has never been seen in a browser, locally or live.
- Next: review and merge the PR, deploy, then check the Tax Calculator with children live.

## Checks

| Check | Date | Verified revision / result |
|---|---|---|
| Lint, typecheck (app) | 2026-11-01 | `99f1a6d`: lint 0 errors, 0 warnings; typecheck pass (both re-run on this head) |
| Build, tests | 2026-11-01 | `d816a2e`: build pass; `npx vitest run` 62 files, 1,783 pass (`99f1a6d` changed copy only, not re-run) |
| Function typecheck | — | Not run on this branch: Deno not installed here; no function changed |
| Ship-check | — | Not run on this branch |
| Graph | — | Not updated: `graphify-out/` is absent from this checkout |
| Main: lint / typecheck | 2026-10-30 | `d895a224`: pass; lint 0 errors, 0 warnings |
| Main: function typecheck / build | 2026-10-30 | `d895a224`: pass |
| Main: tests | 2026-10-30 | `d895a224`: 1,768 pass across 62 files |
| Main: ship-check | 2026-10-30 | `d895a224`: 98/100, Beta only; 9 findings, 1 high, 0 blockers |
| Main: graph | 2026-10-30 | Updated after loader fix: 2,942 nodes, 6,732 edges |
| Main: hosted migration / advisors | 2026-10-30 | Applied; same three warnings before/after |
| Main: Pages / live loading | 2026-10-30 | `d895a224`: CI checks pass; signed-in loading error cleared |

## Main: in progress and next

1. Finish signed-in live flows: early payment, actual writes, bank sync, uploads and saved links.
2. Complete cross-theme checks, iPhone Safari keyboard/toolbars, iPad split view, Larger mode and 200% zoom.
3. Address remaining save/reload races and schema reproducibility before the next new feature; remaining feature work stays in `REHAUL_PLAN.md`.

## Main: landed and deployed

- Take-home slices, leave/birthday reconciliation, employer matching and category rules are deployed on `d895a224` (Pages run `41046846244`).
- `a5a7c892` adds queued debt-balance saves, logout verification and mobile dialog containment; the category-rules loader fix is included.
- Hosted migration `20261029230000` is applied on `yvtiybyuifkiwyrnjebe`; migration history, RLS and restricted grants were verified. Local replay is untested.
- Signed-in Tax & Income and a synthetic calculator scenario with negative benefits cash impact render correctly; a 375px check found no document overflow.
- After deployment, a fresh signed-in calculator loads with empty notifications and no console warnings or errors. Light-theme smoke check passed at 1440px; dark theme restored.

## Open risks and session handoff

- Four reference tables still delete then insert; deadline/reload races, category edits during sync and stalled token refresh remain open.
- A schemas-only rebuild lacks composite-key objects. Local PG15→17 reset and administrator authenticator enrolment need the owner.
- Hosted authenticated sync, JWT configuration, `SITE_ORIGIN`, response headers, cron/Edge/pg_net checks and real HEIC uploads remain unverified.
- Existing advisor warnings: `is_admin` security-definer callable by anon/authenticated, and leaked-password protection disabled; no new warning appeared with this migration.
- Claude's admin-assistant branch was last observed unmerged (six commits); Gemini was last observed stopped by quota. Current activity is unverified.
- Keep `finance-reconciliation-backup-2026-10-29` stash until its backup is no longer needed.
- FEATURES.md, the Breakdown Rates sentence (~line 407), still says "Take-home by tax band"; the card's heading is "Take-home by income slice". Left alone by the docs change; the owner to correct.
