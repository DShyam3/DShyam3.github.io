# State

Updated 2026-11-10 · Branch `main` · Head `e1356fcc`, pushed and deployed (Pages run `42890907000`). The Travel journal `261c193c` is live, with docs `94d9bb24`, `6d045bbc` and `e1356fcc` pushed. Earlier: phone drag fix `4c3ed14a` (Pages run `42885566379`); Beliefs `1af8c1b9` and `102a003c` (Pages run `42877079287`). The working tree also holds uncommitted work from this session and others.

## In progress

- Travel journal: shipped, and checked signed out on production. All four `travel_*` reads 200; the itinerary read omits `source_key`/`source_name`; Trips & memories shows "Published journeys will appear here."; country search "japa" lists Japan as "✓ Visited", "zzzz" shows "No matching countries. Your visited map is unchanged.", count stays 24/250. The TravelPage chunk returned 503 once right after deploy (CDN), then 200 on reload. The console 404 is the Pages deep-link fallback, unchanged. Codex's worktree `/private/tmp/dhyan-redesign-phase0` still holds the pre-port copies under old migration names; do not port them again.
- Travel, unverified on production: anything signed in (adding and publishing a trip, a photo upload, imports, backup and restore; the owner must check the stored photo has no EXIF/GPS); dark theme; real phone. Open items: REHAUL_PLAN 8.F.
- Phone detail drag fixed (`4c3ed14a`, deployed) and checked anonymously at 390px and 1440px. Not checked: a real iPhone, signed-in dialogs, dark theme, most of the ~47 dialogs. Unverified for unopened dialogs: a wide dialog is now clipped rather than scrolled.
- Redesign shell (`85a6f70b`, `4b08d53d`; deployed in `29630878`): workspace rail, inspector, ⌘K palette, phone header and footer, home-screen icons. Checked anonymously 2026-11-10. Unverified: dark theme; real phone and Add to Home Screen; screen reader; signed-in production. Known and left: ⌘K opens behind the splash on `/`; an Inventory row with an unknown category stays hidden after a palette pick; Watchlist posters and EDC cards show no broken-image notice; manifest and `theme-color` are dark while the site opens light; Finance date fields default to "today" in UTC (GoalsSurface, CreditReportsSection, TransfersSurface, CashFlowSurface, TransactionsTab).
- Public hub: "A year in hours" moved to Thoughts (`/thoughts/year-in-hours`, no stored data). Beliefs is admin-only in the database (`20261110120000`, applied to hosted; anonymous REST 401; `CollectionPage.tsx` gate deployed). Unverified: the admin's own `/beliefs` view. Projects (`bbc219f5`): public `/projects`, migration `20261110140000` applied to hosted; anonymous read 200, insert 401. Unverified: admin add and edit in a browser, dark theme, phone width. Still open: Biography has no edit form; Thoughts has no stored rows; visibility controls per collection; new Home/About; Tools/Homelab; Thoughts merge with Beliefs.
- Bank link (`e64741b2`, `13cc7cca`, `60de9ebf`; Pages run `42301589737`): "Connect Another Bank" opens TrueLayer in a new tab. Checked only with Playwright against mocks. Unverified live: desktop round trip, cross-tab refresh, Safari, phone app-to-app (Barclaycard).
- Money Hub (`ea8b9640`) and Tax Calculator (`6308e148`, `8113b70d`, `cccfb9bd`, `1f43cf26`): deployed; signed-in production unverified. Money Hub has 41 cities and six calculated jurisdictions; open: scenario persistence, more jurisdictions. Tax Calculator's failure boundary and Watchlist edit write-back are unchecked.
- Other sessions in this tree, uncommitted and not ours: nine finance files, `.claude/launch.json`, a two-line `REHAUL_HISTORY.md` edit, and `SITE_PLAN.md` (untracked; proposes the site's order of work, not folded into `REHAUL_PLAN.md`).

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-10 | 0 errors, 0 warnings, on the current tree including the travel port |
| Typecheck, build | 2026-11-10 | Both pass, current tree |
| Functions typecheck | 2026-11-10 | Pass, current tree, including `travel-photo` |
| Tests | 2026-11-10 | Full suite: 2,455 tests across 76 files pass, current tree |
| Migration `20261110120000` | 2026-11-10 | `supabase db push` to hosted production; verified by anonymous REST (401, 42501), `books` still 200, policy and grant read-back |
| Travel, production | 2026-11-10 | Migrations `20261110190000`, `20261110190100` applied to hosted (`supabase db push`); RLS on all four tables and grants read back. Local: migrations apply cleanly, `supabase/tests/travel_journal.sql` passes via psql. `travel-photo` deployed; probes: preflight 200 echoing the site origin, POST without auth 401, anon key 401, foreign origin 403, GET 405. No admin upload run. Live signed-out page check: see In progress |
| Shell browser | 2026-11-10 | Local preview at 1440, 900, 390 and 375px; anonymous on hosted data and signed in as the seed admin locally. Palette, focus trap and return, inspector sheet, link add and delete, phone detail drag. No console errors (session-reported) |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high: possible N+1 in `FinanceDataContext`. Not rerun for the shell, the phone fix or Travel |
| Graphify | 2026-11-10 | Pass, `graphify update .` on the current tree |
| Production | 2026-11-03 | Prior anonymous home check only: no console errors, 30 REST reads; signed-in flows unverified |

## Next

1. Owner signs in on production and checks Travel: add and publish a trip, one photo upload (the stored file has no EXIF/GPS), an import and a backup. Then clear the open items in REHAUL_PLAN 8.F.
2. On a real iPhone, open a collection card's detail on the live site and drag it sideways (should not move), then open a signed-in edit dialog. Open: `responsive.css` rules for `dialog-flush`, `collection-detail-dialog` and `watchlist-detail-with-seasons` match no element in `src`, and DESIGN_SYSTEM.md still describes those dialogs; an episode's "Next up" pill wraps in the 310px inspector (predates the fix).
3. Owner opens `/beliefs` signed in on the live site. Check the shell signed in on production, on a real phone (including Add to Home Screen), and in dark theme. Then the public hub: Projects' content from the owner, and visibility controls per collection.
4. Supabase dashboard: leaked-password protection is still off.
5. Bank link: on a phone, open production, sign in, tap Connect Another Bank, confirm a new tab reaches TrueLayer, approve in the Barclaycard app, and confirm the card appears and the original tab refreshes; on desktop, the same.
6. Tax Calculator and Money Hub: check signed in on production. Money Hub: cross-currency, Berlin and Amsterdam figures, Hide Figures, phone width. Then decide scenario persistence and more calculated jurisdictions.
7. Coordinate one committer across the shared checkout. Keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
8. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `supabase/functions/merchant-logo-cache/index.ts`; deploy; run one manual sync.
9. Signed-in checks: Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits and watched toggles across leave-and-return, sign-out, Cash Flow.
10. Owner: set hosted pension to salary sacrifice; record SLC's next balance and check the pending top-up; check `1063LX` in the HMRC app; check whether benefits from November 2026 are payrolled. Cross-year holiday allocation needs a split rule.
11. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02` and `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout: coordinate file ownership before committing. Browser verification needs a connected browser extension.

## Open risks

- Warm-up sends about 30 reads on anonymous load, including the full Watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library.
- Recurring "Show as suggestion again" deletes without confirmation.
- Carried, unverified: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild misses composite-key objects; hosted sync, JWT config, headers, cron/Edge/pg_net and HEIC uploads; advisor warnings (`is_admin` callable by anon and authenticated).
- Revolut linked 2026-11-06: first sync reached 2024-11-16 only, not complete. Owner to confirm whether the account predates July 2026.
- Student Loan: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026 under net pay. Local seed has the 2026/27 Plan 2 threshold at 28,470 against 29,385 hosted. Keep stash `finance-reconciliation-backup-2026-10-29`.
