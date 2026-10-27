# State

**Updated:** 2026-10-27 · **Branch:** `codex/books-catalogue-editor` · **HEAD:** `86410a7`
**Release:** Books changes prepared locally, not committed or deployed. Isolated from main; the original checkout’s uncommitted Finance work is excluded.
**Last recorded Pages:** `60f807b5`, run 40235011253 · **Hosted Postgres:** 17.11.0.003 · **Last recorded hosted/local schema:** `20261025200100` · **Local Postgres:** 15

## In progress

- Books UI includes subjects, Currently Reading, duplicate-aware catalogue quick add, missing-details lookup and Amazon UK/Waterstones searches. No Books schema change is needed.
- Hosted import is complete: 226 distinct requested books, five already present, 221 inserted; 227 total including The Lean Startup.
- Last verified hosted metadata: 182 covers, 130 descriptions and 227 links. Backfill writes only missing metadata, never reading status. Remaining: 45 covers and 97 descriptions (`/private/tmp/books-backfill-review.md`); 14 ambiguous source entries (`/private/tmp/books-import-review.json`). Shop links are searches, not verified editions.
- Books release still needs commit, deployment and live verification. Reading progress, series position, ISBN autofill and statistics remain planned; Currently Reading is a status only.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Isolated Books release | 2026-10-27 | Lint 0 errors/0 warnings; both typechecks; 1,371 tests / 59 files; build pass. Local build warns of absent env; CI must rebuild with secrets |
| Launch scan | 2026-10-27 | 98/100 Beta, nine findings, one high in FinanceDataContext, zero blockers |
| Books review | 2026-10-27 | Reviewer (high) reports nothing after timeout/cancellation, All magazine filter and stale Added-state fixes; builder (medium) lint/typecheck and eight metadata tests pass |
| Books browser | 2026-10-27 | Signed-in localhost unchanged-field edit/save succeeds; Google 429 falls back to Open Library; duplicate Added buttons disabled. At 390px no horizontal overflow, Save reachable. Missing-only fill verified in fixture |
| Original checkout graph | 2026-10-27 | Refreshed: 2,833 nodes, 6,448 edges, 136 communities; not an isolated-release graph check |
| Earlier auth checks | 2026-10-25 | Local eight SQL cases, 26-check client script and browser flow; hosted post-upgrade reads passed. Hosted auth flows remain unverified |

## Next

1. Commit and deploy Books; verify the deployed editor and catalogue lookup. Continue uncertain metadata/entry review.
2. Owner enrols an authenticator on `/auth`; last recorded status is not enrolled, so the code step is not in force.
3. Owner decides on local stack reset: PostgreSQL 15 volume remains; upgrade config to 17 together with reset.
4. Verify scheduled cron execution, edge functions and pg_net after the hosted upgrade; catalogue checks alone do not verify execution.
5. Follow REHAUL_PLAN.md for Borrowed rules, remaining security work, schema rebuild from empty and Node 24 CI.

## Existing hosted state

- Public signup is disabled; Email sign-in remains enabled. Hosted Postgres upgrade from 15 to 17 is ACTIVE_HEALTHY; five cron jobs retain schedules/hashes, pgjwt is absent, anon Books reads succeed and Finance reads are denied.
- TOTP UI is deployed; `is_admin()` requires aal2 for a verified factor. Migrations `20261025200000` and `20261025200100` are applied. AAL1 session duration limiting is enabled, but not exercised hosted.
- Advisor vulnerable-version and insufficient-MFA findings are resolved; remaining accepted findings are in SECURITY.md.
- Edge versions last recorded: tmdb-proxy v13, merchant-logo-cache v15, truelayer-sync v48 (verify_jwt false), watchlist-cron-sync v14. Forty-one old merchant-logo names were owner-deleted; random-name replacements remain.

## Blockers and open risks

- Unverified live: two-factor enrolment/code/recovery flows, post-upgrade cron/edge execution, Paid/untick/early-payment, photo upload, CV and saved-link writes. Books save was verified on localhost, not the deployed UI.
- Unverified: signed-in TrueLayer v48 and merchant-logo-cache v15 runs, IPv6 /64 live path, Safari/Firefox, physical phones, 200% zoom, real HEIC, phone detail scrolling and non-UK stored dates.
- Finance save-safety/races and hosted read measurements remain in the plan; per-row saves are retained by decision. Birthday/benefits/leave changes in the original checkout are outside this release and are not claimed shipped.
- External image requests, Watchlist cron CPU and production sync-race verification remain open. Parser override is checked locally; CI Node 20 / Ubuntu transition remains unchecked.
- Original checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` stays on `codex/student-loan-draw-guard` with unrelated uncommitted work; do not delete or reset it.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
