# State

**Updated:** 2026-10-25 · **Branch:** `main` at `0142694a` (origin/main; worktree `.claude/worktrees/auth-hardening` is on `claude/auth-hardening` at the same commit) · **Pages:** `60f807b5`, run 40235011253 · **Hosted Postgres:** 17.11.0.003 · **Hosted and local schema:** `20261025200100` · **Local Postgres:** 15

Uncommitted in the worktree: the 2026-10-25 doc edits to SECURITY.md, REHAUL_PLAN.md and STATE.md. Nothing committed.

## Closed 2026-10-25

- Hosted: public signup off (`auth/v1/settings` `disable_signup: true`; a signup POST is refused with `signup_disabled`). The Email provider stays on, so password sign-in works.
- Hosted: Postgres upgraded in place, 15.8.1.030 → 17.11.0.003, ACTIVE_HEALTHY. Checked after, read-only: 5 pg_cron jobs active with the same schedules and command hashes; `pgjwt` absent; `is_admin()` keeps the aal2 rule; anon reads `books` (200) and is refused `finance_transactions` (42501); the site returns 200.
- Hosted: security advisor re-run. `vulnerable_postgres_version` and `auth_insufficient_mfa_options` are gone; the rest are accepted in SECURITY.md.
- Hosted: TOTP was already enabled under Authentication → Multi-Factor (max 10 factors). No change made.
- On `main` and deployed: TOTP code step and two-factor panel (`ab0b759e`); `is_admin()` requires aal2 once a factor is verified (`20261025200100`); `pgjwt` dropped (`20261025200000`). Both migrations applied to hosted with `supabase db push`.
- Hosted "Limit duration of AAL1 sessions" ON (2026-10-25): once a factor is verified, a password-only session that does not pass the code step within 15 minutes of sign-in cannot refresh. Per the Auth source it never applies to an account with no verified factor, so nothing changes before enrolment. Not exercised on hosted.
- Local stack only: 8 SQL session/factor cases, a 26-check supabase-js script, and the browser UI flow.

## Open, in order

1. Owner enrols an authenticator on `/auth` ("Set up two-factor"). Not enrolled yet, so the code step is not in force.
2. Owner decides on the local stack reset. Local is still Postgres 15 (`supabase/config.toml` `[db] major_version = 15`); a 17 config cannot start on the PG15 volume, so bump it in the same change as the reset.
3. Unverified after the upgrade: the first scheduled cron runs (next 02:10 UTC); the edge functions (`tmdb-proxy`, `truelayer-sync`, `merchant-logo-cache`, `watchlist-cron-sync`) and their pg_net calls; a signed-in admin session; any write. The cron jobs were checked in the catalogue only.
4. Remaining REHAUL_PLAN.md items: Borrowed rules, security items left, schemas rebuild from empty, Node 24 CI.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Docs-only edits | 2026-10-25 | No code file changed; lint, typecheck and build not run for them |
| `ab0b759e` (clean tree) | 2026-10-25 | From the session, not re-run here. Lint 0 errors, 0 warnings; `npm run typecheck` and `npm run typecheck:functions` pass; Vitest 1,363 tests / 58 files; `npm run build` pass; `npm run ship-check` 98/100 with 9 findings (the earlier record said 8; not reconciled), the one high is the pre-existing FinanceDataContext N+1 |
| Reviewer (Opus) | 2026-10-25 | One pass, no blockers. Should-fixes and nits applied; the fixes were not re-reviewed |

## Live (unchanged by this branch)

- Pages `60f807b5` (run 40235011253, success) includes PR #9 (`2d237d11`). The live bundle carries the code step and two-factor strings; the page was not signed in to.
- Hosted: `finance_debt_observations` keyed `(profile_id, debt_id)` (`20261025090000`). Merchant logos use random names (`merchant-logo-cache` v15); the 41 brand-named originals were deleted by the owner on 2026-10-25, and the old names return 400.
- Edge functions: `tmdb-proxy` v13, `merchant-logo-cache` v15, `truelayer-sync` v48 (`verify_jwt` false), `watchlist-cron-sync` v14.
- Signed in, read-only (2026-10-25): bills calendar, Forecast at 375px, Student Loan card, logos in Transactions. Not checked live: early-payment Paid, header fade, Travel columns, About bio, phone detail scrolling, stored-date changes.

## Blockers and open risks

- Unverified, not to be read as passed: the code step and two-factor panel on the live site (deployed, not exercised); GoTrue's refusal of aal1 enrol and unenrol (local only); lost-authenticator recovery (local only); Safari, Firefox and a phone; everything in Open item 3.
- Unverified, carried forward: live writes (Paid tick, untick and early payment; photo upload; the CV; a saved link), local stack only; a signed-in run of `truelayer-sync` v48 and `merchant-logo-cache` v15; the IPv6 /64 path (unit-tested, not probed); physical devices, 200% zoom, real HEIC files, stored dates on a non-UK device.
- Finance: save-safety and races in REHAUL_PLAN.md; hosted reads unmeasured. Per-row saves left as they are by decision (REHAUL_HISTORY.md, 2026-10-25).
- Visitor IPs still go off-site for images: flagcdn.com, image.tmdb.org, Google Books. Owner decision, not changed.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed. Parser override validated for this install, tests and CSS only; CI Node 20 / Ubuntu transition not checked.
- Main checkout (`/Users/dhyanshyam/Projects/DShyam3.github.io`, `codex/student-loan-draw-guard`) carries another session's uncommitted Books work and its own STATE.md edits. Do not describe that branch as deletable while the work is there.
- Branches: `claude/auth-hardening` (pushed to `main` as `60f807b5`; the branch itself is not on origin); `claude/affectionate-lamarr-f2d2cb` (worktree `.claude/worktrees/affectionate-lamarr-f2d2cb`); `codex/student-loan-draw-guard` (PRs #8 and #9 merged, still checked out in the main checkout). Local `main` in the shared repo is 20 commits behind origin/main; not touched.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
