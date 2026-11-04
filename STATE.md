# State

Updated: 2026-11-04 · Branch: `main` · HEAD `033a6583`.
Money Hub is local, uncommitted and not deployed. The Tax Calculator rework is committed on `main`, not pushed or deployed. The tax-code allowance fix (`5db86bd6`, Pages run `41896520385`), finance-session (`033a6583`, run `41895639334`), payslip fix (`3812d339`, run `41894364229`) and merchant-logo-cache v16 (`3394e2e9`, run `41800729607`, 67 cached logos) are pushed and deployed. Other sessions share this tree.

## In progress

- Money Hub (local, uncommitted, not deployed): manual four-city comparison under Finance → Income, housing share of take-home, largest monthly cost, equivalent gross salary against the baseline, and the England benefits, services and protections overview are in the tree (`FEATURES.md`). Still open: browser verification, sourced city presets/licensing/maintenance, richer employee/household/tax-year assumptions, saved scenarios, and international coverage (`MONEY_HUB_BLUEPRINT.md`, `REHAUL_PLAN.md`).
- Tax Calculator (committed on `main`, not pushed or deployed): Standard/Yours views, pension as a share in the engine, the take-home % line chart and the reviewer's fixes (next pound kept now nets the pension via `ukNextPound`, large-allowance relief-at-source bands, Scotland note, copy) are in the tree. Reviewed by `reviewer` (Opus); every finding applied.
- Parallel sessions' `DebtFormDialog` and other edits remain in the working tree; no commit or deployment was performed by the Money Hub task.
- Finance-session behaviour was owner-tested as admin; automation has not exercised the failure boundary or Watchlist edit write-back.

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-04 | Pass, 0 errors and 0 warnings (`npm run lint`) |
| Typecheck | 2026-11-04 | Pass (`tsc --noEmit -p tsconfig.app.json`) |
| Functions typecheck | 2026-11-04 | Pass (`deno check` via `npm run typecheck:functions`) |
| Tests | 2026-11-04 | `money-hub.test.ts` (33 tests) and `surfaces.test.ts` (12 tests) pass; earlier full run 2,191 tests across 64 files pass with `--maxWorkers=2` |
| Build | 2026-11-04 | Pass (`vite build`) |
| Ship-check | 2026-11-04 | 96/100, Beta, 0 blockers, 1 high: existing possible N+1 in `FinanceDataContext`; Semgrep + OSV ran; `glob`/`minimatch` dependency advisories remain |
| Graphify | 2026-11-04 | Pass (2,153 nodes, 4,909 edges) |
| Money Hub browser | 2026-11-04 | Unverified: requires connected browser extension |
| Tax code allowance (`5db86bd6`, deployed) | 2026-11-04 | `tax-code` tests, lint and typecheck pass; local browser verified `1063LX` → £10,630 and emergency note |
| Tax Calculator (session-reported) | 2026-11-04 | After review fixes: lint 0/0, typecheck, 1,943 finance tests and build pass; local browser checked Standard/Yours (desktop, 375px, Scotland); signed-in production unverified |
| Production | 2026-11-03 | Prior anonymous home check only: no console errors, 30 REST reads; signed-in flows unverified |

## Next

1. Tax Calculator: push, let Pages deploy, then check Standard and Yours signed in on production.
2. Verify Money Hub in a browser signed in (mobile/keyboard, both themes, missing inputs, equivalent salary states, England benefits/services cards, Hide Figures, leaving and profile switches), then scope Phase 0 data/licensing for sourced city budgets.
3. Coordinate one committer across the shared checkout; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
4. Merchant logos: fix `popworld` (`popworld.cc` wrong icon) and check `revolution-bars` / `vue` in `supabase/functions/merchant-logo-cache/index.ts`, deploy, and run one manual sync.
5. Signed-in verification: Tax Calculator on production, Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits/watched toggles across leave-and-return, sign-out and Cash Flow (including demo Cash Flow reversed labels).
6. Owner: set hosted pension to salary sacrifice, record SLC's next balance and check the pending top-up; check `1063LX` breakdown in the HMRC app and whether taxable benefits starting November 2026 are payrolled. Cross-year holiday allocation still needs a split rule.
7. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave untouched branches alone (`claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02`, `origin/claude/net-take-home-tax-f2n71j`).

## Blockers

- Parallel sessions share one checkout: coordinate file ownership before committing. Browser verification requires a connected browser extension.
- Local stack still lacks the `finance_category_rules` migration (shows load toast locally).

## Open risks

- Warm-up sends ~30 reads on anonymous load, including the full watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; failed first read caches an empty library.
- Recurring "Show as suggestion again" deletes without confirmation; `MerchantAvatar` uses `rounded-[0.5rem]` and duplicates resolver lookup in `DashboardSurface` and `TransactionsTab`.
- Carried: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild missing composite-key objects; hosted sync, JWT config, `SITE_ORIGIN`, headers, cron/Edge/pg_net and HEIC uploads unverified; advisor warnings (`is_admin` callable by anon/authenticated, leaked-password protection off).
- Student Loan approximation: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay. Local `supabase/seed.sql` has 2026/27 Plan 2 threshold at 28,470 vs 29,385 hosted, and a local test profile has `personal_pension_percent = 5`. Keep stash `finance-reconciliation-backup-2026-10-29`.
