# State

Updated 2026-11-11 · Branch `main` · Head `11676b3a`, in sync with origin/main, nothing unpushed. Deployed: Pages run `43019229579` succeeded 2026-11-11 12:20Z at `11676b3a`; that push also carried `e265562c`, `f6658a78`, `7e1a0a8f`, `c4bbe6b2`, `b00074e8`, `dbcd640b`. Travel journal `261c193c` live.

## In progress

- **Travel itinerary and import review** (`11676b3a`, deployed): import preview in date order; re-import hides saved, unchanged rows behind "Show N already saved"; a status chosen at review is not a change, a newly cancelled source journey is. Rows are one line, struck through when cancelled; unassigned flights fold to "N flights · first–last year"; details open in the inspector or phone sheet, where the owner assigns, edits, deletes. Places: flown and planned flights per country, top three airports, first and last flight; cancelled excluded; only exact uppercase codes match. Import has "Mark selected completed" and "Cancelled at source".
  - Verified before commit: lint 0/0, typecheck, build, full suite; local stack as seed admin with synthetic rows. Signed-out production check after deploy (2026-11-11): `/travel` renders; Germany shows no flight rows and the airport table chunk is never requested; Trips & memories shows "Published journeys will appear here."; only console error is the known Pages deep-link 404.
  - Unverified: owner's signed-in view on production with real data (re-import, folded log, a country's flight rows); dark theme; real phone. Known: an unticked flight comes back as new on every re-import (REHAUL_PLAN 8.F, Later).
- **Watchlist Library toolbar** (another session, uncommitted): `WatchlistPage.tsx`, `TmdbSearchDialog.tsx`, and its FEATURES.md sentence ("On a phone, the Add and Sync buttons show only their icons…"), which must go in with this commit. Below `sm` Add and Sync show icons; search drops below the category picker under about 410px. No overflow at 320–640px, headless Chrome, signed out with stand-in buttons (2026-11-11). Unverified: real signed-in toolbar on a phone.
- **Your Week and inspector width** (`a2c5427c`, `e265562c`, deployed): headless Chrome, anonymous, hosted data, 1280–2740px with inspector open (2026-11-11): no overflow. Unverified: signed-in admin placement, phone selector, month agenda below md, dark theme, real phone.
- **Finance layout fixes** (`f6658a78`, `7e1a0a8f`, `c4bbe6b2`, `b00074e8` docs, deployed): reviewer-fixed; still unverified in a browser (admin-only pages). Open from review: chart grid strokes `rgba(255,255,255,…)` vanish in light theme (Budget, Cash Flow, Dashboard); `GoalsSurface.tsx` select SVG embeds `%23a1a1aa`; debt borrowing inputs h-10 beside a 44px button.
- **Shipped, partly unverified**: episode scroll `3f13901b` (2026-11-10 tests; wheel, trackpad, touch, phone sheet unchecked). Phone detail drag `4c3ed14a` (anonymous, 390 and 1440px; real iPhone and signed-in dialogs unchecked). Redesign shell `29630878` (anonymous 2026-11-10; dark theme, phone, Add to Home Screen, screen reader, signed-in unchecked). Known and left: ⌘K opens behind the splash on `/`; an Inventory row with unknown category stays hidden after a palette pick; Watchlist posters and EDC cards show no broken-image notice; manifest and `theme-color` dark while the site opens light; Finance date fields default to UTC "today".
- **Travel journal**: `261c193c` live; signed-out production checked. Unverified on production: signed-in trip publish, photo upload, imports, backup and restore; dark theme; real phone. Codex's `/private/tmp/dhyan-redesign-phase0` holds pre-port copies; do not port them again.
- **Public hub**: "A year in hours" (no stored data); Beliefs admin-only (`20261110120000`, hosted); Projects (`bbc219f5`, `20261110140000` hosted). Unverified: `/beliefs` admin view, Projects add and edit, dark theme, phone. Open: Biography edit form; Thoughts stored rows; per-collection visibility; new Home/About; Tools/Homelab; Thoughts merge with Beliefs.
- **Bank link** (`e64741b2`, `13cc7cca`, `60de9ebf`; run `42301589737`): Connect Another Bank opens TrueLayer in a new tab. Checked against mocks only. Unverified live: desktop round trip, cross-tab refresh, Safari, phone app-to-app (Barclaycard).
- **Money Hub** (`ea8b9640`) and **Tax Calculator** (`6308e148`, `8113b70d`, `cccfb9bd`, `1f43cf26`): deployed; signed-in production unverified. Tax Calculator failure boundary and Watchlist edit write-back unchecked.

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-11 | 0 errors, 0 warnings; run on the tree that also held the uncommitted Watchlist edits |
| Typecheck, build | 2026-11-11 | Both pass; same tree |
| Tests | 2026-11-11 | Full suite: 2,467 across 77 files pass; same tree |
| Functions typecheck | 2026-11-10 | Pass, including `travel-photo`; no functions changed since |
| Migration `20261110120000` | 2026-11-10 | On hosted; anonymous REST 401 (42501), `books` still 200, policy and grant read-back |
| Travel, production | 2026-11-10 | Migrations `20261110190000`, `20261110190100` on hosted; RLS and grants read back; `travel-photo` probes pass; no admin upload run |
| Shell browser | 2026-11-10 | Local at 1440, 900, 390, 375px; anonymous on hosted data; seed admin locally; no console errors (session-reported) |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high: possible N+1 in `FinanceDataContext`. Not rerun since |
| Graphify | 2026-11-11 | `graphify update .` on the current tree |
| Production | 2026-11-11 | Anonymous `/travel` after deploy `11676b3a`: renders, no flight rows or airport chunk signed out, only the deep-link 404; signed-in flows unverified |

## Next

1. Owner signs in on production, re-imports the Flighty CSV, and checks the hidden-saved preview, "Mark selected completed", the folded flight log, a flight's detail in the side panel, and a country's flight rows with real data.
2. Check the finance layout changes signed in on production: admin-only pages (Budget, Cash Flow, Dashboard charts; Tax, Published Rates, Goals forms; holiday and debt dialogs).
3. Commit the Watchlist toolbar fix on its own (with its FEATURES.md sentence); deploy; owner checks the signed-in toolbar on an iPhone.
4. Decide the 1280px News columns: with the inspector open, the five News columns are ~118px and Out Now, Upcoming and Updates render one character per line (pre-existing). Options: fewer columns, or an overlay inspector at that width.
5. Owner signs in on production and checks Travel: add and publish a trip, one photo upload (no EXIF/GPS), an import and a backup. Then clear the open items in REHAUL_PLAN 8.F.
6. On a real iPhone: drag a collection card's detail sideways (should not move), then open a signed-in edit dialog. Open: `responsive.css` rules for `dialog-flush`, `collection-detail-dialog`, `watchlist-detail-with-seasons` match nothing in `src`; DESIGN_SYSTEM.md still describes them; "Next up" pill wraps below 1560px (predates the fix).
7. Owner opens `/beliefs` signed in on the live site; check the shell signed in on production, on a real phone (including Add to Home Screen) and in dark theme. Then the public hub: Projects content from the owner, and visibility controls per collection.
8. Bank link: on a phone, sign in, tap Connect Another Bank, confirm a new tab reaches TrueLayer, approve in the Barclaycard app, confirm the card appears and the original tab refreshes; then the same on desktop.
9. Tax Calculator and Money Hub: check signed in on production. Money Hub: cross-currency, Berlin and Amsterdam figures, Hide Figures, phone width. Then decide scenario persistence and more calculated jurisdictions.
10. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `supabase/functions/merchant-logo-cache/index.ts`; deploy; run one manual sync.
11. Signed-in checks: Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits and watched toggles across leave-and-return, sign-out, Cash Flow.
12. Owner: set hosted pension to salary sacrifice; record SLC's next balance and check the pending top-up; check `1063LX` in the HMRC app; check whether benefits from November 2026 are payrolled. Cross-year holiday allocation needs a split rule.
13. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02` and `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout: coordinate file ownership and one committer; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified. Browser checks need a connected browser extension.
- Uncommitted: Watchlist toolbar files and its FEATURES.md sentence (another session); `.claude/launch.json` (modified); untracked `SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`.

## Open risks

- Warm-up sends about 30 anonymous reads, including the full Watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library. Recurring "Show as suggestion again" deletes without confirmation.
- Carried, unverified: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild misses composite keys; hosted sync, JWT config, headers, cron/Edge/pg_net, HEIC uploads; advisor warnings (`is_admin` callable by anon and authenticated); leaked-password protection off. Revolut linked 2026-11-06: first sync reached 2024-11-16 only; owner to confirm whether the account predates July 2026.
- Student Loan: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026. Local seed has the 2026/27 Plan 2 threshold at 28,470, hosted 29,385. Keep stash `finance-reconciliation-backup-2026-10-29`.
