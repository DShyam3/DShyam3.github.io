# State

**Updated:** 2026-10-25 · **Branch:** `main` (pushed from worktree `.claude/worktrees/auth-hardening`) · **Code:** `60f807b5` · **Pages:** `60f807b5`, run 40235011253 · **Hosted and local database:** `20261025200100`

## In progress

No code task open. TOTP is live on Pages but not yet in force: the owner has not enrolled. Waiting on the owner: Next 1 and 2.

## Closed 2026-10-25 (on `main`, deployed)

- TOTP two-factor for the single admin (`ab0b759e`): `/auth` asks for a six-digit code after the password once a verified factor exists; the admin view has a two-factor setup panel. Removing a factor is done in the Supabase dashboard; the app has no remove button.
- `is_admin()` requires an `aal2` session once a verified factor exists (`20261025200100`). Before enrolment it behaves as before.
- `pgjwt` dropped (`20261025200000`): unused, and it blocked the Postgres 17 upgrade.
- Hosted: both migrations applied with `supabase db push` (the dry run listed exactly those two). Read-only afterwards: `pgjwt` absent, the `aal2` rule in place, `auth.mfa_factors` empty, the owner's password-only session still admin. Nothing changes for the owner until enrolment.
- Local stack only: 8 SQL session/factor cases, a 26-check supabase-js script, and the browser UI flow (setup, logout, code step, reload, wrong and right codes, recovery). Test users deleted.
- Decisions in REHAUL_HISTORY.md (2026-10-25): the factor rule applies only once enrolled; leaked-password protection accepted off (Pro-only, on Free).

## Checks

| Check | Date | Result |
| --- | --- | --- |
| `ab0b759e` (clean tree) | 2026-10-25 | From the session, not re-run here. `npm run lint` 0 errors, 0 warnings; `npm run typecheck` and `npm run typecheck:functions` pass; Vitest 1,363 tests / 58 files; `npm run build` pass; `npm run ship-check` 98/100 with 9 findings (the earlier record said 8; not reconciled), the one high is the pre-existing FinanceDataContext N+1; graphify updated |
| Reviewer (Opus) | 2026-10-25 | One pass, no blockers. Should-fixes and nits applied; the fixes were not re-reviewed |
| Pages `8e8c4c19` | 2026-10-25 | Earlier tree. Lint 0/0 and typecheck run on it; Vitest 1,347 / 56 files and build reported from that session, not re-run here |

## Live (unchanged by this branch)

- Pages: `60f807b5` deployed by run 40235011253 (success). It includes PR #9 (`2d237d11`, Finance figures hidden until shown). Live bundle checked: it carries the code step and two-factor panel strings; the page was not signed in to.
- Hosted: `finance_debt_observations` keyed `(profile_id, debt_id)` (`20261025090000`). Merchant logos use random names (`merchant-logo-cache` v15); the 41 brand-named originals were deleted by the owner on 2026-10-25, and the old names return 400.
- Edge functions: `tmdb-proxy` v13, `merchant-logo-cache` v15, `truelayer-sync` v48 (`verify_jwt` false), `watchlist-cron-sync` v14.
- Live, signed in, read-only (2026-10-25): bills calendar, Forecast at 375px, Student Loan card, logos in Transactions. Self-hosted fonts and the PR #8 draw guard are live too.
- Not checked live: early-payment Paid, header fade, Travel columns, About bio, phone detail scrolling, stored-date changes.

## Next

1. Owner: enrol an authenticator on `/auth` (signed in as admin, "Set up two-factor"). Needs the hosted TOTP factor enabled (step 2).
2. Owner, Supabase dashboard (not signed in when this was written; none of this is checked):
   - Turn off "Allow new users to sign up" at `/auth/providers`. Hosted `auth/v1/settings` still gave `disable_signup: false` on 2026-10-25.
   - Enable the TOTP factor under Authentication → Multi-Factor if it is off.
   - Upgrade Postgres 15.8.1.030 → 17 (brief downtime; pgjwt no longer blocks it). Then set `major_version` 15 → 17 under `[db]` in `supabase/config.toml`.
3. Re-run the security advisor after the push. Leaked-password stays listed (accepted). The MFA and Postgres lints stay listed until step 2 is done. Also listed and accepted: `is_admin()` EXECUTE for anon and authenticated; two `rls_enabled_no_policy` INFO.
4. Remaining REHAUL_PLAN.md items: Borrowed rules, security items left, schemas rebuild from empty, Node 24 CI.

## Blockers and open risks

- Unverified, not to be read as passed: the code step and two-factor panel on the live site (deployed, not exercised); Safari, Firefox and a phone; the hosted TOTP setting (not checked); GoTrue's refusal of aal1 enrol and unenrol on hosted (local only); lost-authenticator recovery (local only).
- Unverified, carried forward: live writes (Paid tick, untick and early payment; photo upload; the CV; a saved link), local stack only; the IPv6 /64 path (unit-tested, not probed); a signed-in run of `truelayer-sync` v48 and `merchant-logo-cache` v15; physical devices, 200% zoom, real HEIC files, stored dates on a non-UK device.
- Finance: save-safety and races in REHAUL_PLAN.md; hosted reads unmeasured. Per-row saves left as they are by decision (REHAUL_HISTORY.md, 2026-10-25).
- Visitor IPs still go off-site for images: flagcdn.com, image.tmdb.org, Google Books. Owner decision, not changed.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed. Parser override validated for this install, tests and CSS only; CI Node 20 / Ubuntu transition not checked.
- Main checkout (`/Users/dhyanshyam/Projects/DShyam3.github.io`, `codex/student-loan-draw-guard`): carries another session's uncommitted Books work and its own STATE.md edits. Do not describe that branch as deletable while the work is there.
- Branches: `main`; `claude/auth-hardening` (pushed to `main` as `60f807b5`; branch itself not on origin); `claude/affectionate-lamarr-f2d2cb` (worktree `.claude/worktrees/affectionate-lamarr-f2d2cb`); `codex/student-loan-draw-guard`, PRs #8 and #9 merged, still checked out in the main checkout.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
