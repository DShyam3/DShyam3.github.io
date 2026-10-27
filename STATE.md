# State

**Updated:** 2026-10-27 · **Branch:** `main`
**Releases:** PR #10 (`d239b421`, Books) and PR #11 (`2fe8ff56`, Tax Calculator) merged to `main`, followed by Finance Birthday Day Off, Package Benefits & Optimal Leave Maximiser.
**Hosted Postgres:** 17.11.0.003 · **Hosted/local schema:** `20261027075434` (`finance_birthday_leave` applied to hosted DB) · **Local Postgres:** 15

## In progress

- Finance Birthday Day Off, Package Benefits (preset dropdown, edit, Travel Insurance, Benefit-in-Kind tax), and Date-Aware Optimal Leave Maximiser committed and pushed to `main`, with migration `20261027075434_finance_birthday_leave.sql` applied to the hosted Supabase database. Live signed-in browser verification of the new leave/benefit writes remains open.
- Finance Tax Calculator (`2fe8ff56`, plus `-£0.00` zero-sign fix) is on `main`. Local signed-in Chromium checks passed; live site, Safari, Firefox, and physical devices remain unverified.
- Books UI (`d239b421`) is deployed and verified live for unchanged-field save and Open Library lookup. Hosted metadata remaining: 45 covers, 97 descriptions (`/private/tmp/books-backfill-review.md`), and 14 ambiguous source entries (`/private/tmp/books-import-review.json`).

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Current working tree | 2026-10-27 | `npm run lint` (0 errors, 0 warnings), `npm run typecheck`, `npm run typecheck:functions`, `npx vitest run` (60 files, 1,519 tests), `npm run build`: pass |
| Launch scan | 2026-10-27 | `npm run ship-check`: 98/100 Beta, nine findings, one high in `FinanceDataContext`, zero blockers |
| Graph | 2026-10-27 | Refreshed with `graphify update .` (2,882 nodes, 6,568 edges, 146 communities) |
| Review | 2026-10-27 | `reviewer` (Opus) passed on Birthday Day Off / Optimal Leave Maximiser / Package Benefits and UK Tax Calculator (`TaxCalculatorSurface.tsx:501` zero-sign nit fixed) |
| Tax Calculator browser | 2026-10-27 | Local signed-in Chromium checks passed; live site, Safari, Firefox, and physical devices remain unverified |
| Books browser/live | 2026-10-27 | Deployed and verified live for unchanged-field save and Open Library lookup |
| Earlier auth checks | 2026-10-25 | Visitor rate limit and unauthenticated function checks passed |

## Next

1. Verify Birthday Day Off, Package Benefits, Optimal Leave Maximiser, and Tax Calculator live on the deployed site.
2. Review remaining Books metadata (45 covers, 97 descriptions, 14 ambiguous entries).
3. Owner dashboard: disable public signup, enable leaked-password protection (Pro) and TOTP, Postgres upgrade verification; rerun the advisor.
4. Follow REHAUL_PLAN.md for Borrowed rules, remaining security work, and Node 24 CI.

## Blockers and open risks

- Unverified live writes: Paid/untick/early payment, photo upload, CV and saved links. Link/upload changes were checked locally only.
- Unverified: signed-in runs of `truelayer-sync` v48 and `merchant-logo-cache` v15; IPv6 /64 path has unit coverage but no live probe.
- Physical devices, 200% zoom, real HEIC files, phone detail scrolling and stored dates on non-UK devices remain unchecked.
- Finance save-safety/races and unmeasured hosted reads remain in the plan; per-row saves are retained by decision in REHAUL_HISTORY.md.
- Visitor IPs still reach flagcdn.com, image.tmdb.org and Google Books thumbnails; owner decision remains open.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
