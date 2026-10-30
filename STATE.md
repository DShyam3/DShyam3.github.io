# State

Updated: 2026-10-30 · Branch: `claude/affectionate-lamarr-f2d2cb` (pushed) · Verified code revision: `a2e00a2e`, the merge of `main` `caff0df2`.

## Landed (on the branch, pushed; not in main)

- Merged `main` `caff0df2` into the admin-assistant branch (plan 7.6; forked from main on 2026-10-08). The merge includes `a5a7c892` and `d895a224`.
- Seven conflicts resolved: header keeps main's socials-open fade plus the assistant `action` slot; the inventory spec parser stays in `src/collections/inventory-specs.ts` with main's `safeHref()` check; finance tool context keeps the branch's ledger and main's local-day alert dates; SECURITY.md lists the assistant's rate limit.
- After review: the inventory tool uses main's `isInEdc` (`src/features/inventory/edc/categories.ts`, widened to take `is_edc`/`is_wishlist`); a duplicate, contradicting header paragraph was removed from FEATURES.md; phone-header heights re-measured on the merged header and unchanged.
- Reviewer (Opus) found no high findings: Edge Function admin check, rate limit, CORS allowlist, provider-by-id and generic errors are correct; category rules and the tax engine do not drift from the screens.
- Main, deployed and unchanged by this merge: Pages run `41046846244` on `d895a224`; hosted migration `20261029230000` applied on `yvtiybyuifkiwyrnjebe`; signed-in Tax & Income and calculator render.

## Checks

| Check | Date | Verified revision / result |
|---|---|---|
| Lint | 2026-10-30 | Merged tree: 0 errors, 0 warnings |
| Typecheck (`npm run typecheck`, `src`) | 2026-10-30 | Merged tree: pass |
| Function typecheck (`npm run typecheck:functions`) | 2026-10-30 | Merged tree: pass |
| Tests | 2026-10-30 | Merged tree: 1,849 of 1,849 pass across 67 files |
| Build | 2026-10-30 | Merged tree: pass |
| Graph | 2026-10-30 | `graphify update .` current on the merged tree |
| Reviewer (Opus) | 2026-10-30 | Merged diff, before the post-review edits: no high findings |
| Ship-check | 2026-10-30 | Not run on this tree. Last run on `d895a224` (main): 98/100, Beta only; 9 findings, 1 high, 0 blockers |
| Hosted migration / advisors | 2026-10-30 | Main `d895a224`: applied; same three warnings before and after |

## Next

1. Owner's calls (REHAUL_PLAN 7.6): send goal and category names to the model as a confirmed exception, or switch to neutral labels; Cash Flow average divisor; phone header height at 320px.
2. Fix the history cap: it counts messages, not what one question adds, so it can pass the Edge Function's 64-message cap (`LIMITS.maxMessages`) and wipe the history (REHAUL_PLAN 7.6).
3. Deploy `assistant`, set a provider key (`supabase secrets set <PROVIDER>_API_KEY=...`), then verify signed in on a live model with the three target questions.
4. Merge the branch into main.
5. Then main's list: subscription audit; merchant drilldown; transaction splitting; budget rollover; investment pricing.

## Blockers and open risks

- The merge is on the branch only, pushed to origin; main has none of it. Nothing about the assistant is live; the function is not deployed and no model key is set.
- Unverified: the assistant has never run against a real provider on this merged code, and no signed-in browser check of it has been done.
- Unverified wire names (REHAUL_PLAN 7.6): the Anthropic row sends `fallbacks: "default"` under `anthropic-beta: server-side-fallback-2026-07-01`; if the API refuses either, every call fails as a generic 502.
- No re-review is recorded for the post-review edits to `inventory-tool.ts` and `edc/categories.ts`.
- Ship-check has not been run on this tree.
- Shared checkout: the owner runs parallel sessions on this tree. Agree on one committer and confirm no other session has staged or edited files before committing.
- Pending, not verified: signed-in live Finance on production; real bank sync and TrueLayer credentials against live endpoints.

## Carried from main (open, unverified where stated)

- Main's live checks still open: signed-in Finance flows (early payment, actual writes, bank sync, uploads, saved links); cross-theme, iPhone Safari, iPad split view, Larger mode and 200% zoom.
- Four reference tables still delete then insert; deadline/reload races, category edits during sync and stalled token refresh remain open.
- A schemas-only rebuild lacks composite-key objects. Local PG15→17 reset and administrator authenticator enrolment need the owner.
- Hosted authenticated sync, JWT configuration, `SITE_ORIGIN`, response headers, cron/Edge/pg_net checks and real HEIC uploads: unverified.
- Advisor warnings: `is_admin` security-definer callable by anon/authenticated; leaked-password protection disabled.
- Gemini was last observed stopped by quota; current activity unverified.
- Keep the stash named `finance-reconciliation-backup-2026-10-29` until its backup is no longer needed (find it by name; the stack is shared).
