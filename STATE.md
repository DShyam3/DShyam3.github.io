# State

Updated: 2026-11-03 · Branch: `main` · Head: `29ed4d85`, pushed and deployed (Pages run `41709041057`: success).
Production check so far: anonymous home page only — loads, no console errors, 30 warm-up reads (sizes unreadable cross-origin). Everything else below is verified locally only.

## Pushed 2026-11-03 (`a7c892c7..dec67110`, rebased onto #13)

- `c12d8751` Tax Calculator chart: marginal-rate step list, Take-home % mode. Rebase conflict with #13 in `uk-tax-calculator.ts` resolved by keeping #13's `childBenefit` and charge share on top of the shared `deductionSharesOf` helper; 322 tax tests pass.
- `579b7866` Student Loan: repayments on current pay, itemised headline, Repaid and interest card, Checking SLC's figures, shared `formatDayMonth`.
- `a4af67fd` Holiday tracker: cross-year day count, booking dialog and calendar, container-query tiles. Second Opus pass found no new bugs.
- `a6b16406` Recurring: "Show as suggestion again" on dismissed rows; Delete only on inactive rows.
- `f16e7a7f` Home Transactions card draws `MerchantAvatar`; merchant tiles are rounded squares (8px) with logos filling the tile.
- `f93d13e2` Background warm-up and tab-long query cache, with three review fixes: watched-episode toggles now reach the cache write-back; `queryClient.clear()` on `SIGNED_OUT`; Finance section warm-up honours Save-Data (`prefersSavedData` moved to `src/lib/idle.ts`).
- `dec67110` `.claude/launch.json` dev ports.
- Local branch `backup/pre-rebase-2026-11-03` holds the pre-rebase commits; delete once production is checked.

## Pushed later 2026-11-03 (`1b273019..29ed4d85`)

- `3fc1180d` Cash Flow Sankey restyle, fixed per the review at the owner's request: every name and amount at 12px, hub label sentence case, hatch restored on the "From balances" link, gradient ids scoped by `useId`, no pointer cursors. Checked on local `dev:test` (Demo): 18 text spans at 12px, 1 hatched link, 7 gradient links, no overlap. Lint 0/0, typecheck, 2,131 tests, build pass.
- `29ed4d85` Holiday: refuse saving an implausible leave range (`isCountableLeaveRange` in `holidays.ts`, tested). Committed by the Holiday session for the owner to push; it went out with the Sankey push by mistake (a plain `git push` after it landed). Its session reports lint, typecheck, 2,131 tests, build and a local browser check. Keep or revert is the owner's call.
- Demo-profile Cash Flow reads backwards (Rent and ISA on the left feeding "Spending" into "Income"): labels come from `lib/finance/cash-flow`, likely the Demo rows' signs. Not investigated.

## Checks

| Check | Date | Tree / result |
|---|---|---|
| Pushed tip `dec67110` | 2026-11-03 | Clean worktree at the tip: `npm run lint` 0/0; typecheck passes on each of the 7 commits; `npx vitest run` 2,127 pass across 63 files; `typecheck:functions` pass; `npm run build` pass |
| Ship-check | 2026-11-03 | Pre-rebase working tree: 96/100, Beta only, 0 blockers, 1 high (possible N+1 in `FinanceDataContext.tsx`, already present 2026-10-30) |
| Browser, local `dev:test` | 2026-11-03 | Home card monograms and stand-in logos (rounded squares, `object-cover`); sign-in then sign-out renders with no new console errors. Watched-episode fix NOT browser-tested: local stack has no shows |
| Graph | 2026-11-03 | `graphify update .` after the rebase: 2,082 nodes, 4,790 edges |
| Production | 2026-11-03 | Pages run `41680495085` success. Anonymous home: no console errors, 30 REST reads. Nothing signed-in checked |

## Next

1. Check on production signed in: Tax Calculator (light theme too), Student Loan figures, holiday booking, recurring undismiss, Home logos with real Brandfetch icons, watched-episode toggle surviving leave-and-return, sign-out, Cash Flow Sankey.
2. Owner: keep or revert `29ed4d85` (above).
3. Owner: other branches are unmerged and untouched: `claude/affectionate-lamarr-f2d2cb` (12 commits, admin assistant), `codex/assistant-integration-2026-11-02` (13), `origin/claude/net-take-home-tax-f2n71j` (3, possibly superseded by #13, unverified).
4. Owner: switch the hosted pension type from net pay to salary sacrifice in Tax & Income, then record SLC's next balance and use "Checking SLC's figures" on the pending top-up.
5. Owner: holiday LEFT charges a cross-year booking's whole count to its start year (29 Dec 26 – 8 Jan 27 charges 8 to 2026); split rule needed. The real "Christmas Holidays" row still stores 8 days ("Use 7" in its edit dialog).
6. Owner decision: move Finance rows into the query cache, or keep `FinanceDataProvider` mounted (about 30 tables refetch on re-entry).
7. Finish signed-in live flows, cross-theme and device checks, save/reload races and schema reproducibility; feature work stays in `REHAUL_PLAN.md`.

## Open risks (from the 2026-11-03 Opus review, shipped as risks)

- Warm-up: every anonymous view sends about 30 reads, including the full watchlist library (about 7,600 episodes); payload unmeasured, and Save-Data exists only in Chromium.
- Watchlist: an edit made during a background re-read of a stale library is overwritten when the read lands; a failed first read is cached as an empty library.
- Recurring: "Show as suggestion again" deletes the row without confirming, losing edits on a once-active bill, and the toast can be wrong if detection no longer qualifies it.
- `MerchantAvatar` uses an arbitrary `rounded-[0.5rem]`; the resolver lookup is duplicated in `DashboardSurface` and `TransactionsTab`.
- Carried: four reference tables delete then insert; category edits during sync; stalled token refresh; schemas-only rebuild lacks composite-key objects; hosted sync, JWT config, `SITE_ORIGIN`, headers, cron/Edge/pg_net and HEIC uploads unverified; advisor warnings (`is_admin` callable by anon/authenticated, leaked-password protection off).
- Student Loan approximation: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay.
- Local only: `supabase/seed.sql` (~line 127) has the 2026/27 Plan 2 threshold at 28,470 vs 29,385 hosted; a local test profile's `personal_pension_percent` was set to 5.
- Keep stash `finance-reconciliation-backup-2026-10-29` until its backup is no longer needed.
