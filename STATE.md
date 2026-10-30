# State

Updated: 2026-10-30 · Branch: `main` · Verified code revision: `d895a224` (deployed).

## Landed and deployment

- Take-home slices, leave/birthday reconciliation, employer matching and category rules are deployed. Pages succeeded for `d895a224` (run `41046846244`).
- `a5a7c892` adds queued debt-balance saves, logout verification and mobile dialog containment; its changes and the category-rules loader fix pass the checks below.
- Hosted migration `20261029230000` is applied on `yvtiybyuifkiwyrnjebe`; migration history, RLS and restricted grants were verified. Local replay is untested.
- Signed-in Tax & Income and a synthetic calculator scenario with negative benefits cash impact render correctly; the earlier 375px check found no document overflow.
- After deployment, a fresh signed-in calculator loads with empty notifications and no console warnings/errors: the category-rules loading error is cleared. Light-theme smoke check passed at 1440px; dark theme was restored.

## Checks

| Check | Date | Verified revision / result |
|---|---|---|
| Lint / app typecheck | 2026-10-30 | `d895a224`: pass; lint 0 errors, 0 warnings |
| Function typecheck / build | 2026-10-30 | `d895a224`: pass |
| Tests | 2026-10-30 | `d895a224`: 1,768 pass across 62 files |
| Ship-check | 2026-10-30 | `d895a224`: 98/100, Beta only; 9 findings, 1 high, 0 blockers |
| Graph | 2026-10-30 | Updated after loader fix: 2,942 nodes, 6,732 edges |
| Hosted migration / advisors | 2026-10-30 | Applied; same three warnings before/after |
| Pages / live loading | 2026-10-30 | `d895a224`: CI checks pass; signed-in loading error cleared |

## In progress and next

1. Finish signed-in live flows: early payment, actual writes, bank sync, uploads and saved links.
2. Complete cross-theme checks, iPhone Safari keyboard/toolbars, iPad split view, Larger mode and 200% zoom.
3. Address remaining save/reload races and schema reproducibility before the next new feature; remaining feature work stays in `REHAUL_PLAN.md`.

## Open risks and session handoff

- Four reference tables still delete then insert; deadline/reload races, category edits during sync and stalled token refresh remain open.
- A schemas-only rebuild lacks composite-key objects. Local PG15→17 reset and administrator authenticator enrolment need the owner.
- Hosted authenticated sync, JWT configuration, `SITE_ORIGIN`, response headers, cron/Edge/pg_net checks and real HEIC uploads remain unverified.
- Existing advisor warnings: `is_admin` security-definer callable by anon/authenticated, and leaked-password protection disabled; no new warning appeared with this migration.
- Claude's admin-assistant branch was last observed unmerged (six commits); Gemini was last observed stopped by quota. Current activity is unverified.
- Keep `finance-reconciliation-backup-2026-10-29` stash until its backup is no longer needed.
