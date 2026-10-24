# State

**Updated:** 2026-10-25 · **Branch:** `main` · **Code:** `3279c6f6`, pushed (`92cbc754..3279c6f6`) and on Pages · **Hosted database:** `20261024160000` · **Local stack:** `20261024170000`

## In progress

None in the tree. Waiting on the owner: Next 1 to 4.

## Deployed, and not

- Pages for `3279c6f6`: [run 40140918032](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40140918032) succeeded (`gh run view`, 2026-10-25). Live `/watchlist/library` loads with the new CSP, no violations. Anonymous only.
- **On main, not on hosted** (owner approval pending):
  - `tmdb-proxy`, `truelayer-sync`, `watchlist-cron-sync` (`34f9af5c`). Hosted runs the old code.
  - Migration `20261024170000` (SVG off two buckets). Applied to the local stack only.
- **Live, not checked signed in:** link and upload changes (`dad993b0`, `553b08e3`). Local stack only. The owner has not signed in on the live site.
- `merchant-logo-cache` v13 on hosted (2026-10-24), `verify_jwt` true. Not yet run by a real TrueLayer sync.
- **On main, not checked live (signed out):** bills calendar, balance forecast, recurring Paid with early payment, Student Loan "You borrowed", header social-link fade, Travel UN and city columns, About whole bio on desktop, phone collection detail as one scroller, stored dates shown as the stored day (`6e146826`, `b02eb1d5`).

## Checks

| Check | Date | Result |
| --- | --- | --- |
| `npm run lint` | 2026-10-25 | 0 errors, 0 warnings (`--max-warnings=0`); re-run on this tree |
| `npm run typecheck` | 2026-10-25 | Pass; re-run on this tree |
| `npm run typecheck:functions` | 2026-10-25 | Pass; re-run on this tree |
| `deno test supabase/functions/_shared/` | 2026-10-25 | 23 pass; re-run on this tree |
| Vitest | 2026-10-25 | 1,334 pass under Europe/London and America/Los_Angeles (session) |
| `npm run build` | 2026-10-25 | Pass (session) |
| Reviewer (Opus), two passes | 2026-10-25 | No blockers; all findings closed. Server-side CHECK constraints on link columns deliberately not added (SECURITY.md). One nit kept in REHAUL_PLAN.md: the 32-byte signature read can refuse a rare real HEIC |
| Uploads, local stack | 2026-10-25 | A PNG named `.jpg` stored as `image/png` (old path stored `image/jpeg`); PDFs typed `text/plain` stored as `application/pdf` in `documents` and `finance-documents`. Test objects removed |
| `npm audit` | 2026-10-24 | 0 vulnerabilities (earlier tree) |
| ship-check | 2026-10-24 | 98/100 on `9568b7d4`, unpinned command. Not re-run on `3279c6f6` (now pinned to 0.1.12) |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-24 | Overall MEDIUM on `9568b7d4`; nothing critical or high. MEDIUM from dashboard auth only. DB side checked on the local stack, not hosted |
| Signed-in finance, local stack | 2026-10-24 | Pass: recurring tick, untick, due-day edit, Forecast at 375px, "You borrowed" ignores an empty-date draw. Not run: early-payment button (unit-tested only) |
| Local stack | 2026-10-25 | At `20261024170000` (session; 82 migration files in tree) |
| Hosted after `20261024160000` | 2026-10-24 | Performance advisor 0 unindexed foreign keys (was 5); grants unchanged; security advisor no new findings; anon POST to `merchant-logo-cache` → 401; `aldi.webp` public → 200 |
| graphify update | 2026-10-25 | Ran on `3279c6f6`; `graphify-out/` is gitignored |

## Next

1. Owner approval: apply `20261024170000` to hosted (`supabase db push --dry-run` should list only it), then deploy `tmdb-proxy`, `truelayer-sync` and `watchlist-cron-sync`. Then decide on `github.svg`, `gmail.svg`, `linkedin.svg` in `site-assets`.
2. Owner, signed in on the live site: bills calendar, Forecast at 375px, recurring Paid (tick, untick, early payment, edit), Student Loan "You borrowed". Logos render after a real sync (v13 not yet run). Also one photo upload, the CV, and a saved link.
3. Owner, dashboard: turn off public signup; leaked-password protection (Pro plan); TOTP MFA (clears the advisor only); Postgres upgrade (brief downtime). Uninstall the Strix GitHub App and delete its PR #7 comment. Re-run the security advisor.
4. Owner: rotate the TMDB API key. No `VITE_TMDB_API_KEY` secret remains (`gh secret list`, 2026-10-24).
5. Owner decisions: guessable merchant-logo keys; `finance_debt_observations` composite key; per-row save design. Then, all in REHAUL_PLAN.md: the simulator's malformed-draw guard with the Borrowed rules; the security items left; schemas rebuild from empty; CI on Node 24.

## Blockers and open risks

- Hosted runs older edge code than main (above). Its service-role compare has no missing-key refusal; the platform always sets the variable, so this is defence in depth.
- Until `20261024170000` is on hosted, admins can still upload SVG to `merchant-logos` and `site-assets`. Admin-only.
- Guessable logo keys: the public object route still confirms a guessed `<slug>.<ext>`. `aldi.webp` returned 200 publicly on 2026-10-24. Owner decision.
- Student loan simulator: one borrowing draw with an empty date turns the whole simulator into Invalid Date and £NaN (pre-existing). Reachable only by a write outside the UI; hosted has no such draw (read-only check). Tied to "Borrowed has three rules" in REHAUL_PLAN.md. Not started.
- TMDB key: public in client bundles 2026-05-09 to 2026-07-25; not rotated. Next 4.
- Unverified, not to be read as passed: physical devices, 200% zoom, live authenticated writes, the live site signed in (uploads and saved links included), real HEIC files (tests use synthetic boxes), stored dates on a non-UK device.
- Finance: save-safety and race list (REHAUL_PLAN.md). Hosted finance reads and per-row saves unmeasured; 1,000 distinct per-row edits take about 6 s locally.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed.
- Parser major-version override validated for this install, tests and CSS only.
- CI: Node 20 Actions face Node 24 enforcement; `ubuntu-latest` moves to 26. Earlier handoff, not checked.
- Branches: `main` and `claude/affectionate-lamarr-f2d2cb` only.
- Full list and reasoning: REHAUL_PLAN.md.
