# State

**Updated:** 2026-10-27 · **Branch:** `claude/finance-calculator-followups` at `e9b60a52`, identical to `origin/main`
**Hosted Postgres:** 17.11.0.003 · **Hosted and local schema head:** `20261027075434` · **Local Postgres:** 15 (`supabase/config.toml`, not bumped)
**Pages for `e9b60a52`:** triggered by the push, not verified. `gh` auth is invalid on this machine.

## On main, live not checked

- `2fe8ff56` Tax Calculator (PR #11); `7b97ebe6` zero-sign fix; `05196a16` Birthday Day Off, Optimal Leave Maximiser and editable Package Benefits (pushed straight to main, no pre-merge review); `d31989f2` leave bookings no longer delete or double-charge the birthday day; `e9b60a52` child benefit clawback in the calculator.
- Migration `20261027075434_finance_birthday_leave.sql`: applied to hosted (recorded 07:54 UTC 2026-10-27; content identical to the file) and to the local stack.
- Local signed-in checks (localhost:8081, figures hidden) passed: Birthday Day Off enable and save; a 13–17 Apr trip with the birthday toggled (5 → 4 days, allowance 25 → 21); removing a birthday and Use Birthday Day on an existing trip; the three booking bug scenarios; moving a birthday between trips; calculator child benefit pointers at £50k, £60.1k, £70k, £80k and £90k with two children, band and legend.
- Unverified: the live site for `2fe8ff56..e9b60a52`; Safari, Firefox, phones and 375px for these changes.

## Hosted state (2026-10-25, unchanged)

- Public signup off; Email sign-in on. Postgres 15 → 17 upgrade ACTIVE_HEALTHY; five cron jobs kept their schedules; `pgjwt` absent.
- TOTP enabled and the UI deployed; `is_admin()` requires aal2 once a factor is verified (`20261025200100`). AAL1 session limit on, not exercised hosted.
- Leaked-password protection off by accepted risk (Free plan; `SECURITY.md`). The advisor's Postgres-version and MFA findings are gone; the rest are accepted in `SECURITY.md`.

## In progress

- Nothing uncommitted on this branch. The Birthday, package-benefit and leave follow-ups and the Tax & Income reconciliation are not started; their list is REHAUL_PLAN.md 8.H.
- The original checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` is on `main` at `05196a16` (2 behind origin) with another session's uncommitted work. Do not reset or delete it. Its local branch `codex/student-loan-draw-guard` (`20e5a811`) is superseded by PR #11; not deleted.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| `e9b60a52` worktree | 2026-10-27 | `npm run lint` 0 errors, 0 warnings; `npm run typecheck`, `npm run typecheck:functions`, `npm run build` pass; `npx vitest run` 60 files, 1,559 tests pass |
| `npm run ship-check` | 2026-10-27 | Not run on `e9b60a52`. Earlier commit: 98/100 Beta, nine findings, one high (`FinanceDataContext`), zero blockers |
| Reviewer (Opus), `05196a16` | 2026-10-27 | Post-merge, not before merge. Migration idempotent and matches `40_finance.sql`; RLS and grants unaffected; only day and month stored. Three booking bugs found, fixed in `d31989f2` |
| Reviewer, `d31989f2` and `e9b60a52` | 2026-10-27 | Nothing blocks; smaller items fixed before commit |
| Tax Calculator | 2026-10-27 | Zero-sign nit at `TaxCalculatorSurface.tsx:501` fixed in `7b97ebe6`. No review record for PR #11 is kept here |
| Graph | 2026-10-27 | Earlier run: 2,882 nodes, 6,568 edges, 146 communities. Not recorded for `e9b60a52` |
| Books release | 2026-10-27 | `d239b421` (PR #10) deployed; admin unchanged-field save and Open Library lookup verified live |
| Earlier auth checks | 2026-10-25 | Visitor rate limit and unauthenticated function checks passed |

## Next

1. Verify the Pages run for `e9b60a52` succeeded, then the live site: Tax Calculator child benefit clawback, Birthday Day Off, leave booking fixes. Needs `gh auth login` or the Actions page. Local results do not count as live.
2. REHAUL_PLAN.md 8.H birthday and package follow-ups, benefit-in-kind tax first: `finance-calcs.ts` subtracts `benefitTaxDeduction` from take-home although the tax code already collects it. Derive it from `uk-tax-calculator.ts`, with tests. Then the database guards (a new migration on `20261027075434`), dead code and accessibility.
3. REHAUL_PLAN.md 8.H "Two tax engines disagree": move Tax & Income onto the calculator's rules (region, pension relief), keeping `settings.personalAllowance` and benefit-in-kind tax. Decide first whether the settings pension percentage is gross or net.
4. Owner: enrol an authenticator on `/auth` ("Set up two-factor"). Not enrolled; until a verified factor exists the second step does not apply. Enrolment, code and recovery flows are unverified live.
5. Verify the first scheduled cron runs after the Postgres 17 upgrade (next 02:10 UTC), the edge functions (`tmdb-proxy`, `truelayer-sync`, `merchant-logo-cache`, `watchlist-cron-sync`) and their pg_net calls, and a signed-in admin session. Cron jobs were checked in the catalogue only.
6. Books leftovers, last recorded 2026-10-27: 45 covers and 97 descriptions to backfill (`/private/tmp/books-backfill-review.md`); 14 ambiguous source entries (`/private/tmp/books-import-review.json`). Reading progress, series position, ISBN autofill and statistics are planned (REHAUL_PLAN.md 8.E).
7. Owner: decide the local stack reset, then `major_version` 15 → 17 in `supabase/config.toml` in the same change. Delete the `VITE_TMDB_BASE_URL` GitHub Actions secret; no workflow reads it.
8. Follow REHAUL_PLAN.md for Borrowed rules, the schema rebuild from empty, Node 24 CI and the remaining security items.

## Blockers and open risks

- Unverified, not to be read as passed: the Pages run for `e9b60a52`; the live site for `2fe8ff56..e9b60a52`; signed-in live writes for leave and the calculator; Safari, Firefox, phones, 375px and 200% zoom for these changes.
- Local only: the local DB holds test rows (Test birthday trip, A1 trip, Birthday Day Off). Local checks are not hosted checks.
- Unverified after the Postgres 17 upgrade: cron runs, edge functions, pg_net calls, a signed-in admin session. Authenticator flows: local only.
- Unverified: signed-in runs of `truelayer-sync` v48 and `merchant-logo-cache` v15; the IPv6 /64 path has unit coverage only.
- Unverified live writes, checked locally only: Paid, untick and early payment; photo upload; CV; saved links.
- Physical devices, real HEIC files, phone detail scrolling and stored dates on non-UK devices are unchecked.
- Finance save-safety, races and unmeasured hosted reads stay in REHAUL_PLAN.md; per-row saves are kept by decision (REHAUL_HISTORY.md).
- Visitor IPs still reach flagcdn.com, image.tmdb.org and Google Books thumbnails. Owner decision, open.
- Other worktree: `/private/tmp/tax-calculator-release` (`codex/tax-calculator-handoff`).
- Full outstanding list and reasoning: REHAUL_PLAN.md.
