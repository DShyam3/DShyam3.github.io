# State

Updated 2026-11-11 · Branch `main` · Head `0a029b5e`, in sync with origin/main, nothing unpushed. Last deploy: Pages run `43035136467` succeeded 2026-11-11 14:07Z at `0a029b5e`. Travel journal `261c193c` live.

## In progress

- **Watchlist Library toolbar and News columns** (`cde866e2`, `0a029b5e`, deployed). Toolbar: below `sm` Add and Sync show icons; search drops below the category picker under about 410px. News: five columns get an `11rem` floor at 1280px+ wide and 600px+ tall, and scroll sideways (no snap; columns release x overscroll so a swipe over one reaches the row) where five do not fit; cards under `13rem` and Updates rows under `15rem` stack; the last column clicked stays in view on resize.
  - Headless Chrome, signed out, light theme, stand-in buttons on the toolbar. Toolbar: no overflow at 320–640px. News: 1280 with inspector open gives 176px columns and scrolls; 1600 fits five; inspector closed at 1280 gives 183px, no scroll; phone 393px, no overflow. Production after deploy, signed out at 1280: opening the inspector from Upcoming leaves it fully in view, a sideways wheel over a column moves the row and stays, a height-only resize leaves it.
  - Unverified: real signed-in admin toolbar on an iPhone; Safari; real macOS overlay scrollbars (headless reserves 15px); a real trackpad swipe (headless wheel events scroll sideways); Larger display mode; dark theme; signed-in admin view with schedule buttons on cards.
  - Open, reviewer nits, not fixed: below `sm` the Sync button hides its progress label while syncing, so sighted phone users see only the spinner; icon-only Add is 40px beside a 48px Sync with a mouse (touch targets stay 44px via the coarse-pointer rule).
- **Travel itinerary and import review** (`11676b3a`, deployed): import preview in date order; re-import hides saved, unchanged rows behind "Show N already saved"; a status chosen at review is not a change, a newly cancelled source journey is. Unassigned flights fold to "N flights · first–last year"; details open in the inspector or phone sheet. Country rows: flown and planned flights, top three airports, first and last flight; cancelled excluded.
  - Verified before commit: lint, typecheck, build, full suite; local stack as seed admin with synthetic rows. Signed-out production check after deploy (2026-11-11): `/travel` renders; no flight rows or airport chunk signed out; only console error is the known Pages deep-link 404.
  - Unverified: owner's signed-in view on production with real data; dark theme; real phone. Known: an unticked flight comes back as new on every re-import (REHAUL_PLAN 8.F, Later).
- **Your Week and inspector width** (`a2c5427c`, `e265562c`, deployed): headless Chrome, anonymous, 1280–2740px with inspector open (2026-11-11): no overflow. Unverified: signed-in admin placement, phone selector, month agenda below md, dark theme, real phone.
- **Finance layout fixes** (`f6658a78`, `7e1a0a8f`, `c4bbe6b2`, `b00074e8` docs, deployed): reviewer-fixed; still unverified in a browser (admin-only pages). Open from review: chart grid strokes `rgba(255,255,255,…)` vanish in light theme (Budget, Cash Flow, Dashboard); `GoalsSurface.tsx` select SVG embeds `%23a1a1aa`; debt borrowing inputs h-10 beside a 44px button.
- **Shipped, partly unverified**: episode scroll `3f13901b` (wheel, trackpad, touch, phone sheet unchecked). Phone detail drag `4c3ed14a` (real iPhone and signed-in dialogs unchecked). Redesign shell `29630878` (dark theme, phone, Add to Home Screen, screen reader, signed-in unchecked). Known and left: ⌘K opens behind the splash on `/`; an Inventory row with unknown category stays hidden after a palette pick; Watchlist posters and EDC cards show no broken-image notice; manifest and `theme-color` dark while the site opens light; Finance date fields default to UTC "today".
- **Travel journal**: `261c193c` live; signed-out production checked. Unverified on production: signed-in trip publish, photo upload, imports, backup and restore; dark theme; real phone. Codex's `/private/tmp/dhyan-redesign-phase0` holds pre-port copies; do not port them again.
- **Public hub**: "A year in hours" (no stored data); Beliefs admin-only (`20261110120000`, hosted); Projects (`bbc219f5`, `20261110140000` hosted). Unverified: `/beliefs` admin view, Projects add and edit, dark theme, phone. Open: Biography edit form; Thoughts stored rows; per-collection visibility; new Home/About; Tools/Homelab; Thoughts merge with Beliefs.
- **Bank link** (`e64741b2`, `13cc7cca`, `60de9ebf`; run `42301589737`): Connect Another Bank opens TrueLayer in a new tab. Checked against mocks only. Unverified live: desktop round trip, cross-tab refresh, Safari, phone app-to-app (Barclaycard).
- **Money Hub** (`ea8b9640`) and **Tax Calculator** (`6308e148`, `8113b70d`, `cccfb9bd`, `1f43cf26`): deployed; signed-in production unverified. Tax Calculator failure boundary and Watchlist edit write-back unchecked.

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint, typecheck, build, graphify | 2026-11-11 | At `0a029b5e`: lint 0/0; typecheck and build pass; `graphify update .` run; not run: typecheck:functions, ship-check |
| Tests | 2026-11-11 | At `0a029b5e`: `src/features/watchlist` 6 files, 190 pass; full suite 2,467 / 77 files, before the News change |
| Functions typecheck | 2026-11-10 | Pass, including `travel-photo`; no functions changed since |
| Migration `20261110120000` | 2026-11-10 | On hosted; anonymous REST 401 (42501), `books` still 200 |
| Travel, production | 2026-11-10 | Migrations `20261110190000`, `20261110190100` on hosted; RLS and grants read back; no admin upload run |
| Shell browser | 2026-11-10 | Local at 1440, 900, 390, 375px; anonymous on hosted data; no console errors (session-reported) |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high: possible N+1 in `FinanceDataContext`. Not rerun since |
| Production | 2026-11-11 | Anonymous `/travel` after deploy `11676b3a`: renders; signed-in flows unverified |

## Next

1. Owner signs in on production, re-imports the Flighty CSV, and checks the hidden-saved preview, "Mark selected completed", the folded flight log, a flight's detail in the side panel, and a country's flight rows.
2. Check the finance layout changes signed in on production: Budget, Cash Flow, Dashboard charts; Tax, Published Rates, Goals forms; holiday and debt dialogs.
3. Owner checks the signed-in Library toolbar on an iPhone, and News at 1280px with the inspector open on a laptop (a real trackpad swipe, Safari).
4. Owner signs in on production and checks Travel: add and publish a trip, one photo upload (no EXIF/GPS), an import and a backup. Then clear the open items in REHAUL_PLAN 8.F.
5. On a real iPhone: drag a collection card's detail sideways (should not move), then open a signed-in edit dialog. Open: `responsive.css` rules for `dialog-flush`, `collection-detail-dialog`, `watchlist-detail-with-seasons` match nothing in `src`; DESIGN_SYSTEM.md still describes them; "Next up" pill wraps below 1560px.
6. Owner opens `/beliefs` signed in on the live site; check the shell signed in, on a real phone (including Add to Home Screen) and in dark theme. Then the public hub: Projects content, and visibility controls per collection.
7. Bank link: on a phone, sign in, tap Connect Another Bank, confirm a new tab reaches TrueLayer, approve in the Barclaycard app, confirm the card appears and the original tab refreshes; then the same on desktop.
8. Tax Calculator and Money Hub: check signed in on production. Money Hub: cross-currency, Berlin and Amsterdam figures, Hide Figures, phone width. Then decide scenario persistence and more calculated jurisdictions.
9. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `supabase/functions/merchant-logo-cache/index.ts`; deploy; run one manual sync.
10. Signed-in checks: Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits and watched toggles across leave-and-return, sign-out, Cash Flow.
11. Owner: set hosted pension to salary sacrifice; record SLC's next balance and check the pending top-up; check `1063LX` in the HMRC app; check whether benefits from November 2026 are payrolled. Cross-year holiday allocation needs a split rule.
12. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02` and `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout: coordinate file ownership and one committer; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified. Browser checks need a connected browser extension.
- Uncommitted (2026-11-11): `STATE.md` (this rewrite); left out of commits on purpose: `.claude/launch.json`, untracked `SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`. No travel files are uncommitted in the tree.

## Open risks

- Warm-up sends about 30 anonymous reads, including the full Watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library. Recurring "Show as suggestion again" deletes without confirmation.
- Carried, unverified: four reference tables delete-then-insert; category edits during sync; stalled token refresh; schemas-only rebuild misses composite keys; hosted sync, JWT config, headers, cron/Edge/pg_net, HEIC uploads; advisor warnings (`is_admin` callable by anon and authenticated); leaked-password protection off. Revolut linked 2026-11-06: first sync reached 2024-11-16 only; owner to confirm whether the account predates July 2026.
- Student Loan: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026. Local seed has the 2026/27 Plan 2 threshold at 28,470, hosted 29,385. Keep stash `finance-reconciliation-backup-2026-10-29`.
