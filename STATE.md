# State

**Updated:** 2026-09-25 · **Branch:** `feat/watchlist-news-finance-transfers` · **HEAD:** `771b2a9a` (= `origin/main`)

## Shipped 2026-09-25 in `771b2a9a` — pushed to `main`, Pages deploy succeeded (behaviour in `FEATURES.md`)

- **Middle-card layout:** one framed scroller per route; toolbars pin only where they fit; Travel workspace mode (fixes unreachable Travel content at 768–1023px); payday in the Tax & Income summary; nested caps released. Public routes browser-checked; Finance NOT checked signed in. Left: `REHAUL_PLAN.md` Part 2, "Layout containment — what is left".
- **Cash Flow:** tested ledger engine; Sankey shares headline totals, table below 768px. Owner decision: ledger only.
- **Transfers:** Home/Budget spending excludes confirmed transfers (`useSpendingLedger()`) with failure notices; one-sided candidates; pair dismissal/restoration; bank category evidence; explicit profile projections; DML-only grants.
- **Home ↔ Transactions:** rows link by `?tx=<id>`; sync history popovers show runs, bank status, consent expiry, next nightly and a manual trigger.
- **Guidance:** costly debt beside spare cash (≥10% APR, no student loans/mortgages, ≥£25/yr, needs an emergency goal); utilisation >30%; entered card limits never overwritten with null. Figures only.
- **Watchlist:** responsive layouts, Standard/Larger, episode rails, full-width News, shared Watch Next query, validated episode writes, Your Week week/month navigation and suggestions. No new calendar migration.
- **Transactions performance:** 100 rows at a time (filters, search, select-all and review keys still cover every row); Possible transfers 5+5 before "Show all"; dark-mode hover fix; arrow-only sync icon. Owner measured 1,207ms click-to-popover (963ms long task, 18,656 nodes) before.
- **Footer and shared layout:** equal-gap footer (tablet credit stacks, desktop one row, phone hidden); minmax columns, flush headers, in-row menus.
- **Generalisation (UK-only public version):** payslip reader label forms, never derives "other deductions" (92 tests); today's tax year defaults; generic UK templates; UK bank colours, TrueLayer bank names/logos; site identity in `src/config/site.json`; CORS/OAuth origins from `SITE_ORIGIN` (fail closed); synced name/colour/fee persist.

## Live state / deployment ordering

- Client `771b2a9a` is live on GitHub Pages (deploy run 36113603257 success). Every migration in the tree is applied live (checked with `list_migrations` before the push). Live home page checked after deploy: head tags resolved, CSP and analytics present, no console errors. Finance not checked signed in.
- Edge functions are NOT deployed by the push: `truelayer-sync` is still v40 (broken, below); tmdb-proxy, merchant-logo-cache and watchlist-cron-sync run their pre-`SITE_ORIGIN` versions.
- Deployed: Finance Wealth/Income (SLC billing, payslip tax-year income, 2020–2026 rate editor, inline debt balances, half-day leave, Breakdown Rates); migrations `20260923100000`, `…110000`, `…120000`.
- Applied live 2026-09-24: `20260924100000` transfer review, `…120000` sync log, `…130000` card limit, `…140000` single-leg transfers.
- v40 (owner, 2026-09-24 18:21 UTC, `--no-verify-jwt`, read back): provider category and credit limit, bank TRANSFER → Transfers, existing categories preserved, no `annual_fee`, and the first name/emoji/colour change -- which BROKE the sync (see below).

## Checks

| Check | Date | Result |
|---|---|---|
| Lint / typecheck / build / vitest / graphify | 2026-09-25 | Pre-push on `771b2a9a`: lint 0 errors, 0 warnings; vitest 44 files, 840/840; build pass |
| typecheck:functions / deno test `_shared` / ship-check | 2026-09-25 | Pre-push: pass; deno 12/12 (earlier "13" was a miscount); ship-check 98/100 Beta, 0 critical, 1 high, 4 medium |
| Browser, layout | 2026-09-25 | Signed out: Travel 900×1000, 1440×900, 1280×560; Books, Inspiration, Watchlist 768×1024, 390×844, 844×390, 1440×900; About, Auth 1440×900. No horizontal overflow; every Travel country reachable. Toolbar pin checked on load only (a hidden pane pauses ResizeObserver) |
| Browser, earlier | 2026-09-24 | Home head tokens, no console errors; calendar month view with real data at 768×1024 and 1024×768. Finance never checked signed in |
| Reviewer, generalisation | 2026-09-24 | 13 findings fixed with regression tests; fixes NOT re-reviewed. Owner chose to ship `771b2a9a` without a second pass |
| Reviewer, layout | 2026-09-25 | 7 findings, 6 fixed; fixes NOT re-reviewed. Left: header/footer `bg-background` hides part of the canvas wash (predates layout) |
| Live DB / function | 2026-09-24 | Migrations in sync; new tables RLS + Admin Only, authenticated DML only, anon none; sync log SELECT only; verify_jwt false (checked at v36) |

## Blockers

- `SITE_ORIGIN` set by owner 2026-09-25 (digest matches `https://dshyam3.github.io`). Live functions do not read it yet; it takes effect when the four functions are next deployed from the tree, which is now safe.
- Live default templates: 15 `finance_recurring_templates` (Netflix, Hulu, Apple, Audible, Copilot, ASPCA, Spotify…) and 32 budget items in 5 categories (Phone O2, Sky, Crunchyroll, Paramount+, contact lenses). Replacing them is a live data change awaiting owner approval.

## Open / unverified

- Finance in the new layout (income summary, compensation header, Transactions panes, released caps): not checked signed in.
- Home View All renders inline and needs a product decision.
- Sync: manual run 2026-09-24 18:57 BST (4 banks, 0 new); card limits and Transfers mapping unchecked in data; pre-mapping TRANSFER rows stay Wants. First logged Nightly run due 2026-09-25 05:00 UTC.
- **Nightly run 2026-09-25 05:00 UTC failed** (`finance_sync_log`: error, "Could not write synced accounts"; Postgres log: `null value in column "name" of relation "finance_bank_accounts" violates not-null constraint`). v40 omitted `name` for existing accounts; an upsert checks NOT NULL before the conflict. No data lost: the run stopped before any write and source cursors only advance after writes. Fix is committed in `771b2a9a` (existing accounts send their stored name/emoji/colour back) but NOT deployed -- every sync fails until it is. Deploying it is safe now that `SITE_ORIGIN` is set. Not yet proven by a successful run.
- Cash Flow real data unverified (unpaid bills excluded, months without income show £0; Sankey checked with fixtures only); Recurring Burn still uses tax-settings income.
- Watchlist compact posters and signed-in writes unverified (mocked tests and live reads only). Updates has duplicate React keys (plan's review table).
- Student loan: landing lag and refund direction unconfirmed; 22 Sep £51,017.83 balance unrecorded; Plan 2 2027–28 thresholds lack a gov.uk source; every `bank_rate_percent` is null.
- Public version: multi-user decision, template rows, T212/Kraken-only import, dated student-loan fallbacks, owner refs in README/SECURITY — `REHAUL_PLAN.md` Part 2.

## Next

1. URGENT: owner deploys `truelayer-sync` from `771b2a9a` (`--no-verify-jwt`) and runs one manual sync to prove the account write works; then the other three functions, so they read `SITE_ORIGIN`.
2. In progress (owner approved 2026-09-25): optional `provider` column on `finance_budget_items` and `finance_recurring_bills`, and a migration cleaning the live shared templates (Phone (O2)→Phone, Eye (Contact Lens)→Optical, Video Entertainment = Netflix, Prime Video, Disney+, Apple TV+, Sky, NOW, Paramount+, Discovery+, YouTube Premium, Crunchyroll; recurring amounts £0; drop Hulu, ASPCA, Copilot; old rows backed up); code defaults to match. Nothing applied until the owner sees both migrations.
3. Owner, signed in on the live site: manual sync, bank connect, Finance admin, Tax & Income, Transactions, Goals. `reviewer` over the unreviewed fixes.
4. Confirm SLC terms and refund direction, then the 8.H categorisation review queue.

**Commit, push or open a PR only when requested.**
