# State

**Updated:** 2026-10-24 · **Branch:** `main` · **Code:** `9568b7d4`, pushed (`1f90b6b5..9568b7d4`) · **Hosted database:** `20261024160000` · **Local stack:** `20261024160000`, reset 2026-10-24

## In progress

None in the tree. Waiting on the owner: Next 1 to 4.

## Deployed, and not

- Pages for `9568b7d4`: [Pages run 40137028415](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40137028415) succeeded (`gh run view`, 2026-10-24). Live `/inspiration` at 375px: no header element past the viewport (the old live header put the theme toggle at 388px). Anonymous only.
- Hosted database: `20261024160000` applied 2026-10-24 with `supabase db push`.
- `merchant-logo-cache` v13 on hosted (2026-10-24), `verify_jwt` true. Not yet run by a real TrueLayer sync.
- **On main, not checked live (signed out):** bills calendar, balance forecast, recurring Paid with early payment, Student Loan "You borrowed", header social-link fade, Travel UN and city columns, About whole bio on desktop, phone collection detail as one scroller, stored dates shown as the stored day (`6e146826`, `b02eb1d5`).
- The owner has not signed in on the live site. Signed-in checks ran on the local stack only (table below).

## Checks

| Check | Date | Result |
|---|---|---|
| `npm run lint` | 2026-10-24 | 0 errors, 0 warnings (`--max-warnings=0`); run on this tree |
| `npm run typecheck` | 2026-10-24 | Pass; run on this tree |
| `npm run typecheck:functions` | 2026-10-24 | Pass (session) |
| `npm run build` | 2026-10-24 | Pass (session) |
| Vitest | 2026-10-24 | 1,325 tests pass under UTC, Europe/London, America/Los_Angeles, Pacific/Auckland (session; Los Angeles had 21 failures before `6e146826`) |
| Reviewer (Opus), two passes | 2026-10-24 | No blockers. 4 risks and 8 nits fixed; 3 nits from pass two fixed after it, not re-reviewed |
| ship-check on `9568b7d4` | 2026-10-24 | 98/100; 0 critical, 1 high (N+1, `FinanceDataContext.tsx`, long-standing), 4 medium; CORS finding is a false positive (SECURITY.md) |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-24 | Overall MEDIUM, nothing critical or high; MEDIUM from dashboard auth only. DB side checked on the local stack, not hosted |
| `npm audit` | 2026-10-24 | 0 vulnerabilities (session) |
| Signed-in finance, local stack | 2026-10-24 | Pass: recurring tick, untick, due-day edit (Paid follows the period), Forecast at 375px, "You borrowed" ignores an empty-date draw. Test rows deleted after. Not run: early-payment button (window cannot open for a monthly bill on 24 Oct; unit-tested only) |
| Local stack reset | 2026-10-24 | `supabase db reset`: 81 migrations recorded = 81 files, head `20261024160000`, seed applied |
| Hosted after `20261024160000` | 2026-10-24 | Performance advisor 0 unindexed foreign keys (was 5); grants unchanged; security advisor no new findings; anon POST to `merchant-logo-cache` → 401; `aldi.webp` public → 200 |
| graphify update | 2026-10-24 | Ran on `9568b7d4`; `graphify-out/` is gitignored |

## Next

1. Owner, signed in on the live site: bills calendar, Forecast at 375px, recurring Paid (tick, untick, early payment, edit), Student Loan "You borrowed". Logos render after a real sync (v13 not yet run).
2. Owner, dashboard: turn off public signup; leaked-password protection (Pro plan); TOTP MFA (clears the advisor only); Postgres upgrade (brief downtime). Uninstall the Strix GitHub App and delete its PR #7 comment. Re-run the security advisor.
3. Owner: rotate the TMDB API key. No `VITE_TMDB_API_KEY` secret remains (`gh secret list`, 2026-10-24).
4. Owner decisions: guessable merchant-logo keys; `finance_debt_observations` composite key; per-row save design.
5. Then, all in REHAUL_PLAN.md: the simulator's malformed-draw guard with the Borrowed rules; the security LOWs; schemas rebuild from empty; CI on Node 24.

## Blockers and open risks

- Guessable logo keys: the public object route still confirms a guessed `<slug>.<ext>`. `aldi.webp` returned 200 publicly on 2026-10-24. Owner decision.
- Student loan simulator: one borrowing draw with an empty date turns the whole simulator into Invalid Date and £NaN (pre-existing). Reachable only by a write outside the UI; hosted has no such draw (read-only check). Tied to "Borrowed has three rules" in REHAUL_PLAN.md. Not started.
- TMDB key: public in client bundles 2026-05-09 to 2026-07-25; not rotated. Item 3 above.
- Branches: `main` and `claude/affectionate-lamarr-f2d2cb` only. The second is backed up on GitHub; its header fix is on main; the rest waits for a model key. `fix/readiness-followups` and `fix/tablet-touch-ux` were deleted 2026-10-24.
- Unverified, live or on devices, not to be read as passed: physical devices, 200% zoom, live authenticated writes, the live site signed in, stored dates on a non-UK device.
- Finance: save-safety and race list (REHAUL_PLAN.md). Hosted finance reads and per-row saves unmeasured; 1,000 distinct per-row edits take about 6 s locally.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed.
- Parser major-version override validated for this install, tests and CSS only.
- CI: Node 20 Actions face Node 24 enforcement; `ubuntu-latest` moves to 26. Earlier handoff, not checked.
- Full list and reasoning: REHAUL_PLAN.md.
