# State

**Updated:** 2026-10-27 · **Branch:** `claude/finance-calculator-followups` at `038bfe80`, 2 commits ahead of `origin/main` `88ed3f8a`, **not pushed**
**Hosted Postgres:** 17.11.0.003 · **Hosted schema head:** `20261027075434` · **Local schema head:** `20261027220000` · **Local Postgres:** 15 (`supabase/config.toml`, not bumped)
**Pages:** deploy for `e9b60a52` succeeded 20:20 UTC (public Actions API). Live behaviour not checked. `gh` auth is invalid on this machine.

## Committed on the branch, not pushed, not on hosted

- `27ca4669` birthday and package-benefit guards. Migration `20261027220000_finance_birthday_leave_guards.sql`, mirrored in `supabase/schemas/40_finance.sql`; no RLS or grant change. A birthday booking is one day, full or half; a birthday month needs a real day (29 February allowed); `package_benefits` must be a JSON array.
  - **Local stack only.** Applying it through the Supabase MCP tool was refused by the auto-mode check as a production deploy. Hosted pre-flight: 0 violating rows, 0 package items without a `kind`. The client does not depend on it.
- `038bfe80` one tax engine and typed package benefits. Tax & Income now uses `uk-tax-calculator.ts` with the Tax Calculator's rules and settings mapping (`ukTaxInputFromSettings`); the calculator gains a personal allowance field. Scottish bands, relief at source (80% from pay, basic band extended), tax-code allowance including 0. `finance_tax_configs` no longer moves a pay figure; it still feeds the student loan tools.
  - Package benefits are Cash or Benefit in kind. Benefit-in-kind tax comes from the engine (with the benefit minus without) and comes off take-home, or is shown as collected through the code when the code's allowance is below the statutory one. Cash items show their after-tax value and stay out of take-home. The typed "tax taken off" field and the flat 20/40/45% helpers are gone; an old item reads as cash unless tax was typed against it, so take-home does not move on upgrade.
  - Holiday tracker: year chevrons and "Plan next year" change only the viewed year; only Settings writes `tax_year`. Leave-year browsing is local state. Accessibility: switches on the Birthday Day Off controls, `aria-expanded` on the maximiser, a "Show N other bridges" disclosure in place of the capped scroller, `aria-pressed` on the birthday toggle, linked labels, word labels on the 🎂 buttons. FEATURES.md, REHAUL_PLAN.md and REHAUL_HISTORY.md updated in the same commit.

## In progress

- Nothing uncommitted in this worktree.
- The original checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` was fast-forwarded to `main` `88ed3f8a` on 2026-10-27 and keeps another session's uncommitted employer-logo work: `employer-logo.ts` and its test (13/13), `PayslipsSection.tsx`, `useResume.ts`, one `FEATURES.md` line, `deno.lock`. Not reviewed, not committed; its `STATE.md` carries a note about that work. Graph refreshed there 2026-10-27. Do not reset or delete it.

## Next

1. Owner: allow the hosted migration, then apply it with `supabase db push` (recorded version matches the file). Through the MCP `apply_migration` tool, hosted records a new timestamp and `20261027220000_finance_birthday_leave_guards.sql` must be renamed to match, as was done for `20261027075434`. Then correct the hosted head above.
2. Owner: decide whether to push the two commits to `main`.
3. Verify live after any deploy: the `2fe8ff56..e9b60a52` changes, and on the pushed commits, Tax & Income on the calculator engine, typed package benefits and the holiday tracker. Local results do not count as live.
4. REHAUL_PLAN.md 8.H, birthday and package follow-ups still open: attach and detach should use `count − 1` / `count + 1`; deleting an attached birthday does not return the host holiday's day; the maximiser has no standalone birthday recommendation and does not treat sick days as booked; day-level dedupe covers holidays only; dead code (positional `planOptimalHolidays` overload, `OptimalLeavePlan`, `calculateBirthdayBenefitValue`); the FEATURES.md holiday tracker line; Settings labels without `htmlFor`; Title Case and emoji in some copy.
5. Review nit, not fixed: `calculateFinance`'s unused `_taxConfigs` and `_asOfDate` parameters (14 call sites, mostly tests).
6. REHAUL_PLAN.md 8.H "Tax engine — what is left": one tax year (2026/27 rules only; a new year means editing the engine); where the student-loan thresholds live; whether the band fields leave Settings. The `finance_tax_configs` table goes only after the thresholds question is answered.
7. Owner: enrol an authenticator on `/auth` ("Set up two-factor"). Not enrolled; the second step does not apply until a verified factor exists.
8. Verify after the Postgres 17 upgrade: the first scheduled cron run (next 02:10 UTC), the edge functions (`tmdb-proxy`, `truelayer-sync`, `merchant-logo-cache`, `watchlist-cron-sync`) and their pg_net calls, a signed-in admin session. Cron jobs were checked in the catalogue only.
9. Books leftovers, last recorded 2026-10-27: 45 covers and 97 descriptions to backfill (`/private/tmp/books-backfill-review.md`); 14 ambiguous source entries (`/private/tmp/books-import-review.json`). Reading progress, series position, ISBN autofill and statistics are planned (REHAUL_PLAN.md 8.E).
10. Owner: decide the local stack reset, then `major_version` 15 → 17 in `supabase/config.toml` in the same change. Delete the `VITE_TMDB_BASE_URL` GitHub Actions secret; no workflow reads it.
11. Follow REHAUL_PLAN.md for Borrowed rules, the schema rebuild from empty, Node 24 CI and the remaining security items.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| `038bfe80` tree: `npm run lint`, `typecheck`, `typecheck:functions`, `build` | 2026-10-27 | Pass; lint 0 errors, 0 warnings. Reported from the session, not re-run here |
| `npx vitest run` | 2026-10-27 | 61 files, 1,663 tests pass (reported from the session) |
| Reviewer (Opus), whole diff of the two commits | 2026-10-27 | Nothing structural; findings fixed except item 5 |
| Local browser, localhost:8081, local stack | 2026-10-27 | Pass, local only: Scotland £60k test profile gives £39,112.00 take-home on both pages; benefit-in-kind and cash cases as described above; year chevron leaves `tax_year` at 2026 |
| `npm run ship-check` | — | Not run on `038bfe80`. Earlier commit: 98/100 Beta, nine findings, one high (`FinanceDataContext`), zero blockers |
| Graph | 2026-10-27 | Original checkout only: 6,590 edges, 151 communities. Not recorded for this worktree |
| Books release | 2026-10-27 | `d239b421` (PR #10) deployed; admin unchanged-field save and Open Library lookup verified live |

## Blockers and open risks

- Unverified, not to be read as passed: the live site for `2fe8ff56..e9b60a52` and for the two new commits; signed-in live writes for leave and the calculator; Safari, Firefox, phones, 375px and 200% zoom for these changes.
- Hosted does not enforce the `27ca4669` guards until item 1 is done. Local checks are not hosted checks.
- Local only: the "Dhyan" settings row holds the test profile (Scotland, £60k, relief at source 5%, plan 2, 1107L, two package benefits); the DB also holds test trips and holiday rows (Test birthday trip, A1 trip, Birthday Day Off).
- Student Loan page reads thresholds from `finance_tax_configs`. Hosted rows hold 2026/27 thresholds, matching the engine; the local seed row holds 2025/26, which differs locally only. Tracked in REHAUL_PLAN.md 8.H.
- Unverified after the Postgres 17 upgrade: cron runs, edge functions, pg_net calls, a signed-in admin session. Authenticator flows: local only.
- Unverified signed-in runs of `truelayer-sync` v48 and `merchant-logo-cache` v15; the IPv6 /64 path has unit coverage only.
- Unverified live writes, checked locally only: Paid, untick and early payment; photo upload; CV; saved links.
- Physical devices, real HEIC files, phone detail scrolling and stored dates on non-UK devices are unchecked.
- Finance save-safety, races and unmeasured hosted reads stay in REHAUL_PLAN.md; per-row saves are kept by decision (REHAUL_HISTORY.md).
- Visitor IPs still reach flagcdn.com, image.tmdb.org and Google Books thumbnails. Owner decision, open.
- Other worktree: `/private/tmp/tax-calculator-release` (`codex/tax-calculator-handoff`, `2fe8ff56`).
- Full outstanding list and reasoning: REHAUL_PLAN.md.
