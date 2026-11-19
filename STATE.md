# State

Updated 2026-11-19 · `main` at `234eeba2`. The payslip, reimbursement and future-holiday code was pushed in `d5120557`; the payslip row-logo change was pushed in `234eeba2`. Migration `20261119150000_payslip_reimbursement_links.sql` is written but **not applied** because the connected Supabase project reports `INACTIVE` and database reads timed out. The last confirmed Pages deployment is run `44483401937` for separate Watchlist work; deployment of the payslip changes is unverified.

## Payslip work

- Pushed: payslip history uses a full-width ledger within each group. The group heading shows totals; rows show the complete employer and gross with take-home and labelled status. The clicked detail dialog remains as before.
- Pushed: a matched employer logo appears beside the employer in tax-year and calendar-year rows. Employer groups continue showing the logo in the heading.
- Once the reimbursement table is available, a payslip can record a reimbursement payment line manually. Matching suggests penny-exact prior spending within 120 days, with explicit confirmation; confirmed expenses show in the transaction ledger and stale links need review. Until then, the reimbursement controls are hidden.
- Future leave years explain that bank holidays follow ordinary UK rules and can change for exceptional holidays or new rules.
- Other edits and untracked drafts may be present in the shared checkout; do not attribute them to this work without checking their diff.

## Checks (2026-11-19, local tree)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| Targeted Vitest (reimbursement, payslip reconciliation, RLS) | 3 files, 17 tests pass |
| `npm run build` | pass |
| `graphify update .` | pass after the row-logo edit |
| `npm run ship-check` | command passed; scan verdict **Do not launch yet** (93/100, one reported critical finding later inspected as a false positive; Semgrep skipped) |
| Browser and database migration | not verified / not applied |

## Earlier landed work

- `feat/watching-mid-season` narrowed Watching to series mid-season or current as episodes air; signed-out live-data preview was checked. Signed-in shelves remain unverified.
- Travel remount flash and Finance re-entry/tab switching latency were addressed. Watchlist News cards were aligned. The Pages build/deploy artifact race was addressed; the last recorded manual re-run deployed.
- Discover “Seen it” now asks when; the affected ~54 films were set to “date unknown” on 2026-11-18.
- Watchlist Discover, News, Franchises, Library, Diary and Import changes, TitleScores/TMDB score, staged warmup, public IndexedDB cache and deduplicated Supabase calls were recorded as landed previously. Browser checks remain open.
- OMDb first pass completed on 2026-11-19: films 1,064/1,070 checked (1,008 IMDb ratings); series 393/395 checked (354 IMDb ratings; 3 RT ratings).

## Next

1. Restore database access and apply and verify the reimbursement-link migration in the intended environment, then browser-check payslip layout and logos at desktop and phone widths, manual reimbursement entry, suggestion/confirmation/unlink, stale links, and the ledger marker. Test a future leave year such as 2049.
2. Browser-verify Discover “Seen it” dating; signed-in Watching/To watch shelves; Watchlist ↔ Finance switching and internal tabs; IndexedDB cache hydration and privacy boundary; TitleScores/TMDB badges; Discover, News, Franchises, Library; Travel signed URLs; countdown pill; light mode and phone viewport.
3. Check the first weekly OMDb refresh around 2026-11-25 in `sync_log` (roughly 900 titles at up to 300 per part).
4. Carry forward the other ship-check findings rather than treating an exit code of zero as launch approval. The reported AWS key in `airport-countries.data.ts:226` was inspected and is a false positive inside a static encoded airport-country lookup string.

## Still unverified and blockers

- No browser verification of the pushed payslip/reimbursement/holiday or row-logo work. New PDF imports still capture summary figures, not reimbursement line items; enter those lines manually for matching.
- The connected Supabase project reports `INACTIVE`; its migration list and a read-only table check timed out. The reimbursement table migration has not been applied or database-tested; the controls stay hidden until the table is available.
- The 2026-11-19 finance sync reported “Revolut: bank access needs renewing; reconnect this bank”. Not yet reconnected.
- Prior browser work remains open for staged warmup, Watchlist flows, signed-in admin flows, show creator/cast dialog and the items in Next.
- Carried forward without re-checking: untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`), `.claude/launch.json` with stale `caught-up-worktree` entry, and `.claude/worktrees/affectionate-lamarr-f2d2cb` (owner unknown).
