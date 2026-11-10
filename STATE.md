# State

Updated 2026-11-10 · Branch `main` · HEAD is the merge of origin/main `da272fc6` (phone bank-link fixes) into the redesign shell (`85a6f70b`, `4b08d53d`, docs `7d7d8bc5`). The merge was made to be pushed the same day; the shell's deploy and live behaviour are **not confirmed in this file** — check `git status -sb` and the Pages run.

## In progress

- Redesign shell merged locally: `main` fast-forwarded `e64741b2` to `85a6f70b` (7 commits, formerly `feat/redesign-phase0`). Adds the workspace rail, inspector, ⌘K palette, one-row phone header and footer, focus return, home-screen icons, logo and broken-image handling. FEATURES.md and this file updated 2026-11-10.
- Shell unverified: dark theme; real phone and "Add to Home Screen"; screen reader; a real Enter keypress opening the palette from a button; Watchlist episode ticks and image-collection cards signed in; Larger display mode; signed-in production.
- Shell known and left: ⌘K opens the palette behind the opening splash on `/`; an Inventory row with an unknown category stays hidden after a palette pick; Watchlist posters and EDC cards show no broken-image notice; manifest and `theme-color` are dark (`#080b0a`) while the site opens light; Finance date fields default to "today" in UTC, the wrong day 00:00–01:00 in British Summer Time (GoalsSurface, CreditReportsSection, TransfersSurface, CashFlowSurface, TransactionsTab).
- Bank link (`e64741b2`, then `13cc7cca` and review follow-up `60de9ebf`, deployed via Pages run `42301589737`): "Connect Another Bank" opens TrueLayer consent in a new tab on computers, phones and tablets (via `/finance?connect_bank=1` plus a one-minute connect intent); the first bank stays in the same tab. Checked only by Playwright emulation against mocks. Unverified on the live site: desktop round trip, cross-tab refresh, Safari, phone app-to-app (Barclaycard).
- Money Hub (`ea8b9640`, deployed): 41 cities, six calculated jurisdictions. Unverified: signed-in production, dark theme, keyboard and screen reader. Open: scenario persistence, more calculated jurisdictions.
- Tax Calculator (`6308e148`, `8113b70d`, `cccfb9bd`, `1f43cf26`, deployed): signed-in production unverified. Finance-session behaviour was owner-tested as admin; the failure boundary and Watchlist edit write-back are unchecked.
- Other sessions in this tree, uncommitted and not ours: nine finance files, `.claude/launch.json`, and a two-line `REHAUL_HISTORY.md` edit.
- `SITE_PLAN.md` (untracked) proposes the site's order of work; it is not folded into `REHAUL_PLAN.md`.
- Branch `feat/redesign-phase0` is fully merged. Its worktree `/private/tmp/dhyan-redesign-phase0` holds an unknown writer's uncommitted travel journal work (untracked `TRAVEL_BLUEPRINT.md`, `src/features/travel/TravelJournal*.tsx`, `journal-*.ts`, `supabase/schemas/31_travel_journal.sql`, `supabase/functions/travel-photo/`, and edits to that worktree's `REHAUL_PLAN.md` and `STATE.md`). Deliberately not merged; it does not typecheck there (missing `./journal-summary`).

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-10 | 0 errors, 0 warnings (session-reported; clean checkout of `85a6f70b`, not this tree) |
| Typecheck | 2026-11-10 | Pass, `npm run typecheck` (session-reported, same checkout) |
| Functions typecheck | 2026-11-10 | Pass, `npm run typecheck:functions` (session-reported, same checkout) |
| Tests | 2026-11-10 | 2,414 tests across 71 files pass, `npm test` (session-reported, same checkout) |
| Build | 2026-11-10 | Pass, `npm run build` (session-reported, same checkout) |
| Shell browser | 2026-11-10 | Local preview at 1440, 900 and 375px; anonymous on hosted data and signed in as the seed admin on the local stack. Palette keys, focus trap and return, inspector sheet, add and delete a link with a dead icon URL (notice on card and detail), no console errors from the shell (session-reported) |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high: possible N+1 in `FinanceDataContext`. Not rerun for the shell |
| Graphify | 2026-11-05 | Pass, `graphify update .` (2,232 nodes, 5,126 edges, 114 communities). Not rerun for the shell |
| Production | 2026-11-03 | Prior anonymous home check only: no console errors, 30 REST reads; signed-in flows unverified |

## Next

1. Confirm the push of this merge deployed (Pages run), then check the shell on the live site.
2. After deploy: check the shell signed in on production, on a real phone (including Add to Home Screen), and in dark theme.
3. Supabase dashboard: leaked-password protection is still off.
4. Bank link: on a phone, open production, sign in, tap Connect Another Bank, confirm a new tab reaches TrueLayer, approve in the Barclaycard app, and confirm the card appears and the original tab refreshes; on desktop, the same.
5. Tax Calculator and Money Hub: check signed in on production. Money Hub: cross-currency, Berlin and Amsterdam figures, Hide Figures, phone width. Then decide scenario persistence and more calculated jurisdictions.
6. Coordinate one committer across the shared checkout. Keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
7. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `supabase/functions/merchant-logo-cache/index.ts`; deploy; run one manual sync.
8. Signed-in checks: Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits and watched toggles across leave-and-return, sign-out, Cash Flow.
9. Owner: set hosted pension to salary sacrifice; record SLC's next balance and check the pending top-up; check `1063LX` in the HMRC app; check whether benefits from November 2026 are payrolled. Cross-year holiday allocation needs a split rule.
10. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02` and `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout: coordinate file ownership before committing. Browser verification needs a connected browser extension.
- Local stack still lacks the `finance_category_rules` migration (shows a load toast locally).

## Open risks

- Warm-up sends about 30 reads on anonymous load, including the full Watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library.
- Recurring "Show as suggestion again" deletes without confirmation.
- Carried, unverified: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild misses composite-key objects; hosted sync, JWT config, `SITE_ORIGIN`, headers, cron/Edge/pg_net and HEIC uploads; advisor warnings (`is_admin` callable by anon and authenticated).
- Revolut linked 2026-11-06: first sync reached 2024-11-16 only, not complete. Owner to confirm whether the account predates July 2026.
- Student Loan: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay. Local seed has the 2026/27 Plan 2 threshold at 28,470 against 29,385 hosted. Keep stash `finance-reconciliation-backup-2026-10-29`.
