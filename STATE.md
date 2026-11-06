# State

Updated: 2026-11-06 · Branch: `claude/connect-banks-mobile-page-9ug9k1` · the phone new-tab fix (`13cc7cc` plus its review follow-up) is being fast-forwarded to `main`, Pages deploy unconfirmed; `e64741b` deployed via Pages run `42295536086`.
Money Hub (`ea8b9640`, Pages run `42102041607`) is pushed and deployed; the live bundle ships its chunk, and signed-in production is unchecked. The Tax Calculator rework (`6308e148`, Pages run `41902130209`), its one-chart follow-up (`8113b70d`, run `41987157028`), the Pension paid by choice (`cccfb9bd`, run `41987923144`) and the Marginal rate rename (`1f43cf26`, run `42089880935` attempt 2, after an Actions billing block was cleared) are pushed and deployed; signed-in production is unchecked. The tax-code allowance fix (`5db86bd6`, Pages run `41896520385`), finance-session (`033a6583`, run `41895639334`), payslip fix (`3812d339`, run `41894364229`) and merchant-logo-cache v16 (`3394e2e9`, run `41800729607`, 67 cached logos) are pushed and deployed. Other sessions share this tree.

## In progress

- Bank connection in a new tab. `e64741b` is deployed: on a computer, "Connect Another Bank" opens TrueLayer consent in a new tab, with one localStorage OAuth key per state and a BroadcastChannel refresh of open pages. `13cc7cc` makes phones and tablets open a new tab too, via `/finance?connect_bank=1` (decision in `REHAUL_HISTORY.md`, 2026-11-06). Its `reviewer` follow-up adds a one-minute localStorage connect intent, so the address alone starts nothing; strips the parameter through the router, not `history.replaceState`; and re-reads connections when a waiting tab becomes visible. Both are being pushed to `main`; its Pages deploy is unconfirmed, so it is not live yet. The first bank still stays in the same tab. Checks after the follow-up, 2026-11-06: lint 0/0, typecheck, 204 tests across 13 finance files, build pass; ship-check 98/100, Beta, 0 blockers, 1 high (the existing N+1 in `FinanceDataContext`), with Semgrep and OSV not installed so custom rules only. Browser, Playwright device emulation against a local dev server with Supabase and TrueLayer mocked: iPhone 13 and Desktop Chrome, the tap opens a second tab at `/finance?connect_bank=1` with opener null, which reaches the TrueLayer URL with its state key stored, and the original tab stays on Accounts with no `get_auth_url` call; Pixel 7 with `window.open` stubbed to null, the original tab navigates to TrueLayer; opening `/finance?connect_bank=1` directly (no tap) makes no `get_auth_url` call and clears the parameter. Not run: `npm run typecheck:functions` (Deno absent; no function changed), `graphify update .` (graphify absent), full `npm test`. Unverified: real iOS Safari and Android Chrome, the phone app-to-app round trip (Barclaycard), whether a paused original tab on iOS gets the BroadcastChannel refresh on resume (the visibility re-read covers the connection list, not the ledger), the desktop round trip against real TrueLayer, signed-in production.
- Money Hub (`ea8b9640`, pushed and deployed via Pages run `42102041607`; signed-in production unchecked): jurisdiction-neutral comparison of 41 cities in 22 countries, 31 tax jurisdictions and 15 currencies. Pay is calculated for England, Scotland, Wales, Northern Ireland, Germany and the Netherlands; every other city takes a user-entered net figure. German tax matches the BMF official calculator at five zvE cases and sits €8 and €14 above BMF Lohnsteuer withholding at €50,000 and €120,000; Dutch tax matches ten rows of the Belastingdienst 2026 white monthly wage tax table within €0.30 a month (no row covers labour-credit segment 1); both are reference tests. Benefits, services and protections (19 entries) cover the six calculated jurisdictions where their sources apply (Wales and NI have no healthcare item; NI sick and parental pay not assessed); user-supplied jurisdictions state not assessed. Housing sensitivity and upfront relocation cash (deposits vs consumed expenses) are built. Two `reviewer` passes ran; findings applied, except de-duplicating the UK pension/loan option lists shared with Tax Calculator and Tax & Income files that carry other sessions' edits, and building provision prose figures from constants. Unverified: dark theme, keyboard and screen reader, signed-in production. Open: scenario persistence, more calculated jurisdictions, sourced city budgets, and whether to fold `MONEY_HUB_BLUEPRINT.md` into `REHAUL_PLAN.md`.
- Tax Calculator: `6308e148` (Standard/Yours, pension as a share, reviewed by `reviewer`) and the one-chart follow-up (`TaxCurveChart.tsx`: share kept and next-pound loss on one % axis, take-home £ on hover, replacing the Marginal / Take-home / Take-home % switch) are pushed; not yet checked signed in on production. Standard now has a Pension paid by choice (relief at source by default).
- Working tree clean at 2026-11-06 (`git status`) before this fix. The earlier note on other sessions' uncommitted `DebtFormDialog` and `PillSwitch` edits no longer shows there.
- Finance-session behaviour was owner-tested as admin; automation has not exercised the failure boundary or Watchlist edit write-back.

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-06 | Pass, 0 errors and 0 warnings (`npm run lint`), after the phone new-tab follow-up |
| Typecheck | 2026-11-06 | Pass (`npm run typecheck`), after the phone new-tab follow-up |
| Functions typecheck | 2026-11-06 | Pass (`deno check` via `npm run typecheck:functions`) for the earlier tree; not rerun for the phone new-tab fix, Deno absent |
| Tests | 2026-11-05 | 2,402 tests across 70 files pass (`npm test`) after the second review; lint 0/0, app typecheck and build pass |
| Build | 2026-11-06 | Pass (`npm run build`), after the phone new-tab follow-up |
| Ship-check | 2026-11-06 | 98/100, Beta, 0 blockers, 1 high: existing possible N+1 in `FinanceDataContext`; Semgrep and OSV not installed, so custom rules only |
| Graphify | 2026-11-05 | Pass (`graphify update .`: 2,232 nodes, 5,126 edges, 114 communities) |
| Money Hub browser | 2026-11-05 | Local dev:test stack, seed test admin, desktop 1280 and 375px phone (session-reported): London vs Berlin at £50,000 and 1.15 EUR/GBP gave London £3,293.30/month and Berlin €3,022.23/month on €57,500; New York with USD rate and user net; Berlin at €20,000 shows Midijob message and net input; no horizontal overflow at 375px; no Money Hub console errors. Local stack still lacks `finance_category_rules`. Not verified: dark theme, keyboard and screen reader, signed-in production |
| Tax code allowance (`5db86bd6`, deployed) | 2026-11-04 | `tax-code` tests, lint and typecheck pass; local browser verified `1063LX` → £10,630 and emergency note |
| Tax Calculator (session-reported) | 2026-11-05 | One-chart follow-up: lint 0/0, typecheck, 1,965 finance tests and build pass; local browser checked desktop dark and 375px light; signed-in production unverified |
| Production | 2026-11-03 | Prior anonymous home check only: no console errors, 30 REST reads; signed-in flows unverified |

## Next

1. Confirm the Pages deploy of the phone new-tab fix. Then, on a phone, open production, sign in, tap Connect Another Bank, confirm a new tab opens and reaches TrueLayer, choose Barclaycard, approve in the Barclaycard app, and confirm the card appears and the original tab refreshes; on desktop, the same via a new tab. Unverified until this runs.
2. Tax Calculator: check Standard and Yours signed in on production.
3. Money Hub: check it signed in on production (cross-currency comparison, Berlin and Amsterdam calculated figures, Hide Figures, a phone width), plus dark theme and keyboard/screen reader; then decide on scenario persistence, more calculated jurisdictions and folding `MONEY_HUB_BLUEPRINT.md` into `REHAUL_PLAN.md`.
4. Coordinate one committer across the shared checkout; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
5. Merchant logos: fix `popworld` (`popworld.cc` wrong icon) and check `revolution-bars` / `vue` in `supabase/functions/merchant-logo-cache/index.ts`, deploy, and run one manual sync.
6. Signed-in verification: Tax Calculator on production, Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits/watched toggles across leave-and-return, sign-out and Cash Flow (including demo Cash Flow reversed labels).
7. Owner: set hosted pension to salary sacrifice, record SLC's next balance and check the pending top-up; check `1063LX` breakdown in the HMRC app and whether taxable benefits starting November 2026 are payrolled. Cross-year holiday allocation still needs a split rule.
8. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave untouched branches alone (`claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02`, `origin/claude/net-take-home-tax-f2n71j`).

## Blockers

- Parallel sessions share one checkout: coordinate file ownership before committing. Browser verification requires a connected browser extension.
- Local stack still lacks the `finance_category_rules` migration (shows load toast locally).

## Open risks

- Warm-up sends ~30 reads on anonymous load, including the full watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; failed first read caches an empty library.
- Recurring "Show as suggestion again" deletes without confirmation; `MerchantAvatar` uses `rounded-[0.5rem]` and duplicates resolver lookup in `DashboardSurface` and `TransactionsTab`.
- Carried: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild missing composite-key objects; hosted sync, JWT config, `SITE_ORIGIN`, headers, cron/Edge/pg_net and HEIC uploads unverified; advisor warnings (`is_admin` callable by anon/authenticated, leaked-password protection off).
- Revolut linked 2026-11-06: first sync checked back to 2024-11-16 (not complete), 36 transactions, oldest 2026-07-10; owner to confirm whether the account predates July 2026.
- Student Loan approximation: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay. Local `supabase/seed.sql` has 2026/27 Plan 2 threshold at 28,470 vs 29,385 hosted, and a local test profile has `personal_pension_percent = 5`. Keep stash `finance-reconciliation-backup-2026-10-29`.
