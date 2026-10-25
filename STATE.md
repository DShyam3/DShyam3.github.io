# State

**Updated:** 2026-10-25 · **Branch:** `codex/student-loan-draw-guard` · **HEAD before local fix:** `9b1fdece`
**Deployed code:** `300d5c07` ([Pages 40141569566](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40141569566)) · **Hosted DB:** `20261024160000` · **Local stack:** `20261024170000`

## In progress

Student-loan draw guard is LOCAL, UNCOMMITTED and NOT SHIPPED. Simulator and course-end
inference exclude invalid calendar dates/non-finite amounts; finite signed/zero draws stay valid.
Thirteen regression cases cover the guard. Borrowed/Edit/saved-amount consolidation remains open.
No new live verification or database deployment was performed.

## Deployed, and not

- Pages `300d5c07` is deployed. Anonymous Watchlist with the new CSP passed earlier; no signed-in pass.
- On main, not hosted (owner approval pending): `tmdb-proxy`, `truelayer-sync`, `watchlist-cron-sync`
  (`34f9af5c`), and migration `20261024170000` (SVG off two buckets; local only).
- Link/upload changes are live but verified only locally; live authenticated writes remain unchecked.
- Hosted `merchant-logo-cache` v13 has `verify_jwt` true; no real TrueLayer sync has exercised it.
- Calendar, forecast, early-payment Paid, Student Loan Borrowed, header fade, Travel columns,
  About bio, phone detail scrolling and stored-date changes remain unchecked live.

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Lint / application typecheck | 2026-10-25 | Pass; lint 0 errors, 0 warnings |
| Deno typecheck / build / graph | 2026-10-25 | Pass; graph refreshed |
| Full Vitest | 2026-10-25 | 1,347 tests / 56 files pass |
| Finance in London / Los Angeles | 2026-10-25 | 967 tests / 30 files pass in each timezone |
| Reviewer | 2026-10-25 | No blockers |
| Pinned ship-check | 2026-10-25 | 98/100 Beta; 8 findings: 1 high, 4 medium, 1 low, 2 info |
| Deno shared tests / local uploads | 2026-10-25 | Earlier session: 23 tests pass; sniffed PNG/PDF types stored correctly; objects removed |
| npm audit / security audit | 2026-10-24 | Earlier tree: 0 vulnerabilities; checklist MEDIUM from dashboard auth; DB checked locally |
| Signed-in finance, local | 2026-10-24 | Recurring tick/untick/due-day edit, 375px forecast, Borrowed empty-date guard pass; early payment unit-only |
| Hosted after `20261024160000` | 2026-10-24 | 0 unindexed FKs, grants unchanged, no new advisor findings; logo endpoint anon 401, public aldi.webp 200 |

## Next

1. Commit/review release and deploy the local guard; retain Borrowed/Edit consolidation in the plan.
2. Owner approval: apply only `20261024170000` to hosted, deploy the three edge functions above,
   then decide on existing github.svg, gmail.svg and linkedin.svg in site-assets.
3. Owner signed-in live checks: calendar, 375px forecast, Paid/early payment/edit, Borrowed,
   real-sync logos, photo upload, CV and saved link.
4. Owner dashboard: public signup off, leaked-password protection (Pro), TOTP, Postgres upgrade;
   uninstall Strix GitHub App/delete PR #7 comment, rerun advisor; rotate exposed TMDB key.
5. Owner decisions: guessable logo keys, debt-observation composite key, per-row saves.
   Then remaining plan: Borrowed rules, security items, schemas rebuild from empty, Node 24 CI.

## Blockers and open risks

- Hosted still runs older edge code; missing-key service-role refusal awaits deployment.
- Hosted permits admin SVG uploads until migration; existing SVG objects require owner decision.
- Guessable public logo keys expose existence; TMDB key formerly bundled remains unrotated.
- Physical devices, 200% zoom, live signed-in flows/writes, real HEIC and non-UK stored dates unverified.
- Finance save-safety/races remain in REHAUL_PLAN.md. Hosted reads/saves unmeasured;
  1,000 distinct per-row edits take about 6 s locally. Borrowed/Edit rules still disagree.
- Watchlist cron CPU unmeasured; production sync-race fix unconfirmed.
- Parser override validated for this install/tests/CSS only; CI Node 20/Ubuntu transition remains.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
