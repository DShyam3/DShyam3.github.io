# State

**Updated:** 2026-10-30 · **Branch:** `claude/net-take-home-tax-f2n71j` (code at `46d9b11`, pushed; the docs commit on top carries this file) · **Main:** `28afd3d`, as last fetched
**Hosted Postgres:** 17.11.0.003 · **Hosted and local schema head:** `20261027220000` · **Local Postgres:** 15 (`supabase/config.toml`, not bumped)
**Pages:** deploys for `e9b60a52` and `038bfe80` succeeded (public Actions API). Live behaviour not checked. `gh` auth is invalid on this machine.

## This branch: slice-by-slice take-home. Not merged, not deployed, not live

- **What:** "Your pay, slice by slice" on Tax & Income and the Tax Calculator. Engine: `src/lib/finance/uk-tax-calculator.ts` (`ukPaySlices`, `ukTakeHomeBySlice`, `UK_TAX_BAND_NAMES`). Card: `src/features/finance/components/TakeHomeSlices.tsx`, mounted in `TaxIncomeSurface.tsx` and `TaxCalculatorSurface.tsx`. `calculateFinance` (`src/features/finance/finance-calcs.ts`) now returns `taxInput`.
- **Commits:** `b99483c` (feature) and `46d9b11` (review fixes), both pushed. No PR: the owner has not asked for one. Not merged to `main`.
- **Unverified:** rendered only in an isolated harness (since removed), light and dark, at 900px and 375px. Never seen in the real pages, signed in, locally or live. No Safari, Firefox or phone check.
- **Not run:** `npm run typecheck:functions` on `46d9b11` (Deno not installed here; no edge function changed); `npm run ship-check` on `46d9b11`; a third reviewer pass; graphify (`graphify-out/` absent, CLI not installed, graph not updated).
- **Next for this work:** owner decides on PR and merge. Then verify live: Tax & Income signed in with hidden figures on and off, and the Tax Calculator; then Safari, Firefox and phones.

## In progress

- Unmerged: `.claude/worktrees/affectionate-lamarr-f2d2cb` (`claude/affectionate-lamarr-f2d2cb`, also on GitHub) holds six commits of a site-wide admin chat assistant (7.6) that never reached `main`. Finished worktrees and their merged local branches were removed 2026-10-27; `codex/tax-calculator-release` (content in `main` via #11) and the GitHub copies of old branches remain.
- The original checkout `/Users/dhyanshyam/Projects/DShyam3.github.io` was fast-forwarded to `main` `87d62b22` on 2026-10-27 and keeps another session's uncommitted employer-logo work (`employer-logo.ts` and its test, `PayslipsSection.tsx`, `useResume.ts`, one `FEATURES.md` line, `deno.lock`). Not reviewed, not committed. Do not reset or delete it.

## Next

1. Verify live after any deploy: the `2fe8ff56..e9b60a52` changes, and the `main` commits `27ca4669` and `038bfe80`, on Tax & Income (calculator engine, typed package benefits, holiday tracker). Local results do not count as live.
2. REHAUL_PLAN.md 8.H birthday and package follow-ups still open: attach and detach should use `count − 1` / `count + 1`; deleting an attached birthday does not return the host holiday's day; the maximiser has no standalone birthday recommendation and does not treat sick days as booked; day-level dedupe covers holidays only; dead code (positional `planOptimalHolidays` overload, `OptimalLeavePlan`, `calculateBirthdayBenefitValue`); the FEATURES.md holiday tracker line; Settings labels without `htmlFor`; Title Case and emoji in some copy.
3. Review nit, not fixed: `calculateFinance`'s unused `_taxConfigs` and `_asOfDate` parameters (14 call sites, mostly tests).
4. REHAUL_PLAN.md 8.H "Tax engine — what is left": one tax year (2026/27 rules only; a new year means editing the engine); where the student-loan thresholds live; whether the band fields leave Settings. The `finance_tax_configs` table goes only after the thresholds question is answered.
5. Owner: enrol an authenticator on `/auth` ("Set up two-factor"). Not enrolled; the second step does not apply until a verified factor exists.
6. Verify after the Postgres 17 upgrade: the first scheduled cron run (next 02:10 UTC), the edge functions (`tmdb-proxy`, `truelayer-sync`, `merchant-logo-cache`, `watchlist-cron-sync`) and their pg_net calls, a signed-in admin session. Cron jobs were checked in the catalogue only.
7. Books leftovers, last recorded 2026-10-27: 45 covers and 97 descriptions to backfill (`/private/tmp/books-backfill-review.md`); 14 ambiguous source entries (`/private/tmp/books-import-review.json`). Reading progress, series position, ISBN autofill and statistics are planned (REHAUL_PLAN.md 8.E).
8. Owner: decide the local stack reset, then `major_version` 15 → 17 in `supabase/config.toml` in the same change. Delete the `VITE_TMDB_BASE_URL` GitHub Actions secret; no workflow reads it.
9. Follow REHAUL_PLAN.md for Borrowed rules, the schema rebuild from empty, Node 24 CI and the remaining security items.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| `46d9b11` tree: `npm run lint` | 2026-10-30 | Pass: 0 errors, 0 warnings |
| `46d9b11` tree: `npm run typecheck` | 2026-10-30 | Pass |
| `46d9b11` tree: `npx vitest run` | 2026-10-30 | 61 files, 1,752 tests pass |
| `46d9b11` tree: `npm run build` | 2026-10-30 | Pass |
| `npm run ship-check` (first version, `b99483c`, before review fixes) | 2026-10-30 | 98/100 Beta, nine findings, one high (the existing N+1 note), zero blockers. Not re-run on `46d9b11` |
| Reviewer (Opus), this branch | 2026-10-30 | Pass 1: 7 findings, 8 nits. Pass 2: 2 bugs, 3 risks, 6 nits. All fixed in `46d9b11`. Third pass not run |
| Visual, isolated harness (since removed) | 2026-10-30 | Light and dark, 900px and 375px. Not seen in the real pages, signed in or live. Unverified |
| `npm run typecheck:functions` | 2026-10-27 | Pass on `038bfe80`, reported from the session, not re-run. Not run on `46d9b11`: Deno not installed here |
| Local browser, localhost:8081, local stack | 2026-10-27 | Pass, local only: Scotland £60k test profile gives £39,112.00 take-home on both pages; year chevron leaves `tax_year` at 2026 |
| Graph | 2026-10-27 | Original checkout only: 6,590 edges, 151 communities. Not recorded for this worktree |
| Books release | 2026-10-27 | `d239b421` (PR #10) deployed; admin unchanged-field save and Open Library lookup verified live |

## Blockers and open risks

- Unverified, not to be read as passed: the slice card in the real pages (this branch); the live site for `2fe8ff56..e9b60a52` and for `27ca4669` and `038bfe80`; signed-in live writes for leave and the calculator; Safari, Firefox, phones, 375px and 200% zoom for those changes.
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
