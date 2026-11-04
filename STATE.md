# State

Updated: 2026-11-04 · Branch: `claude/affectionate-lamarr-f2d2cb`, with `main` `a7c892c7` merged in as `89a8a48a` (pushed) · Main: `3394e2e9`, deployed; the branch is 14 commits behind it.

## Landed (on the branch; not in main)

- Merge of `main` `a7c892c7` (#13) as `89a8a48a`, pushed. Only STATE.md conflicted; this file keeps the branch's handoff plus main's new facts.
- The history cap (`a8534650`). Each request is checked against the Edge Function's caps (64 messages, 256 KiB) before it is sent. A question whose tool rounds outgrow the history starts afresh when its own turns fit and two calls remain; otherwise it stops unsent and the history is kept. A question that fails after starting afresh (stopped, cut off or empty) keeps the history too. Six tests in `conversation.test.ts`. The stop notice now reads "ran out of steps or room".
- Merged `main` `caff0df2` into the admin-assistant branch (plan 7.6; forked from main on 2026-10-08). The merge includes `a5a7c892` and `d895a224`.
- Seven conflicts resolved: header keeps main's socials-open fade plus the assistant `action` slot; the inventory spec parser stays in `src/collections/inventory-specs.ts` with main's `safeHref()` check; finance tool context keeps the branch's ledger and main's local-day alert dates; SECURITY.md lists the assistant's rate limit.
- After review: the inventory tool uses main's `isInEdc` (`src/features/inventory/edc/categories.ts`, widened to take `is_edc`/`is_wishlist`); a duplicate, contradicting header paragraph was removed from FEATURES.md; phone-header heights re-measured on the merged header and unchanged.
- Reviewer (Opus) found no high findings: Edge Function admin check, rate limit, CORS allowlist, provider-by-id and generic errors are correct; category rules and the tax engine do not drift from the screens.
- Main, deployed: Pages run `41800729607` on `3394e2e9`, not merged into this branch. Last merged in: `a7c892c7` (#13: the take-home-by-income-slice card counts the High Income Child Benefit Charge), Pages run `41347059793`. Before it, `d895a224`; hosted migration `20261029230000` applied on `yvtiybyuifkiwyrnjebe`.

## Checks

| Check | Date | Verified revision / result |
|---|---|---|
| Lint | 2026-11-01 | Merge of `a7c892c7`: 0 errors, 0 warnings |
| Typecheck (`npm run typecheck`, `src`) | 2026-11-01 | Merge of `a7c892c7`: pass |
| Function typecheck (`npm run typecheck:functions`) | 2026-10-30 | Merged tree: pass. Not re-run since; no file under `supabase/functions` changed |
| Tests | 2026-11-01 | Merge of `a7c892c7`: 1,870 of 1,870 pass across 67 files |
| Build | 2026-11-01 | Merge of `a7c892c7`: pass |
| Graph | 2026-11-01 | `graphify update .` current on the merge of `a7c892c7` |
| Reviewer (Opus) | 2026-10-30 | Merged diff, before the post-review edits: no high findings |
| Reviewer (Opus), history-cap fix | 2026-11-01 | First pass: one medium, two low, all fixed. Second pass: one risk (an empty answer after a restart wiped the history) and three nits, all fixed; that last fix is not re-reviewed |
| Ship-check | 2026-11-01 | `a8534650`: 16 findings, 0 blockers. New against main's 2026-10-30 run: four "hardcoded credential" highs in `assistant/providers.ts`, which are secret names (`ANTHROPIC_API_KEY` etc.), not values; glob/minimatch advisories on an unchanged lockfile, so main has them too |
| Hosted migration / advisors | 2026-10-30 | Main `d895a224`: applied; same three warnings before and after |

## Next

1. Owner's calls (REHAUL_PLAN 7.6): send goal and category names to the model as a confirmed exception, or switch to neutral labels; Cash Flow average divisor; phone header height at 320px.
2. Deploy `assistant`, set a provider key (`supabase secrets set <PROVIDER>_API_KEY=...`), then verify signed in on a live model with the three target questions.
3. Merge the branch into main.
4. Then main's list: subscription audit; merchant drilldown; transaction splitting; budget rollover; investment pricing.

## Blockers and open risks

- The merge is on the branch only, pushed to origin; main has none of it. Nothing about the assistant is live; the function is not deployed and no model key is set.
- The history-cap fix is on the branch only and unit-tested only; it has not run against a real provider.
- Unverified: the assistant has never run against a real provider on this merged code, and no signed-in browser check of it has been done.
- Unverified wire names (REHAUL_PLAN 7.6): the Anthropic row sends `fallbacks: "default"` under `anthropic-beta: server-side-fallback-2026-07-01`; if the API refuses either, every call fails as a generic 502.
- No re-review is recorded for the post-review edits to `inventory-tool.ts` and `edc/categories.ts`.
- The glob and minimatch advisories in `package-lock.json` are unfixed on main and the branch.
- Shared checkout: the owner runs parallel sessions on this tree. Agree on one committer and confirm no other session has staged or edited files before committing.
- Pending, not verified: signed-in live Finance on production; real bank sync and TrueLayer credentials against live endpoints.

## Carried from main (open, unverified where stated)

- #13's card with children has never been seen in a browser, locally or live. FEATURES.md ~line 412 still says "Take-home by tax band"; the card's heading is "Take-home by income slice" (owner to correct).
- Main's live checks still open: signed-in Finance flows (early payment, actual writes, bank sync, uploads, saved links); cross-theme, iPhone Safari, iPad split view, Larger mode and 200% zoom.
- Four reference tables still delete then insert; deadline/reload races, category edits during sync and stalled token refresh remain open.
- A schemas-only rebuild lacks composite-key objects. Local PG15→17 reset and administrator authenticator enrolment need the owner.
- Hosted authenticated sync, JWT configuration, `SITE_ORIGIN`, response headers, cron/Edge/pg_net checks and real HEIC uploads: unverified.
- Advisor warnings: `is_admin` security-definer callable by anon/authenticated; leaked-password protection disabled.
- Gemini was last observed stopped by quota; current activity unverified.
- A local Codex branch, `codex/assistant-integration-2026-11-02` (worktree in `/private/tmp`, not pushed), builds two integration commits on this branch's `bdb17432`. A commit here diverges from it.
- Keep the stash named `finance-reconciliation-backup-2026-10-29` until its backup is no longer needed (find it by name; the stack is shared).
