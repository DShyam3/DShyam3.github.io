# State

Updated 2026-11-13 · Branch `claude/travel-section-mobile-ux-3qcp9c` · Head is the `docs(state)` commit on top of `a581059` (`git log -1`), pushed to origin. **Not merged to main, not deployed.** origin/main `1edb726`; the live site is still `e9134b91` (Pages run `43090835511`, 2026-11-11). Travel journal `261c193c` live.

## In progress

- **About fact cards and travel on phones** (`ed074b4`, `a581059`; on the branch, not deployed). The About overview's "At a glance" tiles and "Continue exploring" list give way to fact cards, each opening its section. Travel: legend, phone-sized flat map, Gibraltar ring, folded continents. Watchlist: `?category=favourites` opens Favourites. Files: `src/components/home/FactCards.tsx`, `fact-cards.ts` (+ test), `src/components/shared/FlagStrip.tsx`, `src/pages/Index.tsx`, `src/pages/Index.css`, `src/components/dot-matrix/DotMatrixGlobe.tsx`/`.css`, `src/features/travel/TravelPage.tsx`, `src/features/watchlist/WatchlistPage.tsx`, `WatchlistContext.tsx`. Favourite picks sit in `site_content` keys `favourite_film` / `favourite_series` (section `about`, content = tmdb_id), written by an admin-only Select. No schema change.
  - Reviewer (Opus) before commit: one bug (plural "seriess") and the main risks, fixed in `a581059`: pan-then-click selecting a country, a dotless ring too small on phones, a neighbour's dot recoloured, focus lost on back with a folded continent, continents counted over UN only, stuck Loading on a country-list failure, favourites cache refresh, design system (two gradient cards max, weights and sizes on the scale, legend swatches from the palette).
  - Verified 2026-11-13 (results as reported from the session): lint 0/0; typecheck and build pass; vitest 2,485 across 79 files. Headless Chromium on hosted-shaped stand-in data (Supabase and the live site are unreachable from the sandbox; dot map regenerated with `scripts/generate-dot-map.py`): iPhone 13 and 1440px, light and dark. Travel phone page 1,925px to ~890px tall; 2D map fills its box; Gibraltar ring centred on its cell's dot.
  - Unverified: real touch on iOS and Android (the pan-y vs drag decision at 6px, pinch, no stray click after a pan); Safari; the signed-in favourite picker writing to hosted `site_content` (never run); the Projects card (projects table empty); real flags, posters and covers (stubbed).
  - Open, left on purpose: constellation chips say "Travel · 24 countries" (all places) beside the card's 23/195 UN count; `?category=` stays in the URL after switching Watchlist tabs; `.travel-country-row--active` keeps the old goldenrod rgba; map colours live in `DOT_PALETTE` (TS), not CSS tokens; `useStackedLayout` is another hand-rolled matchMedia hook.
- **Travel globe focus** (`e9134b91`, deployed). Choosing a country turns and holds the globe; a city's journal rings its dot in gold; going back zooms out; idle spin returns after ~12s. Verified 2026-11-11 on the local stack and on production signed out. Unverified: real-time motion in a visible browser, reduced motion, light theme, a real phone, signed in.
- **Watchlist Library toolbar and News columns** (`cde866e2`, `0a029b5e`, `a82e1ff0`, `b7803983`, deployed). Headless only. Unverified: a real signed-in admin toolbar on an iPhone; Safari; a real trackpad swipe; the signed-in schedule buttons on cards; a real run of Sync on a phone.
- **Travel itinerary, import review and journal** (`11676b3a`, `261c193c`, deployed). Unverified: owner's signed-in view with real data (imports, trips, publish, photo upload, backup and restore); dark theme; real phone. Known: an unticked flight returns as new on re-import (REHAUL_PLAN 8.F).
- **Finance layout fixes** (`f6658a78`, `7e1a0a8f`, `c4bbe6b2`, deployed). Admin-only pages, unverified in a browser. Open from review: chart grid strokes `rgba(255,255,255,…)` vanish in light theme; `GoalsSurface.tsx` select SVG embeds `%23a1a1aa`.
- **Shipped, partly unverified**: Your Week and inspector width (`a2c5427c`, `e265562c`); episode scroll (`3f13901b`); phone detail drag (`4c3ed14a`); Redesign shell (`29630878`); Bank link (`e64741b2`, `13cc7cca`, `60de9ebf`; signed-in on a real phone and desktop unchecked); Money Hub and Tax Calculator (signed-in production unverified).

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint, typecheck, build | 2026-11-13 | On the branch at `a581059`: lint 0 errors, 0 warnings; typecheck and build pass. Not run: `typecheck:functions` and `ship-check` (no functions changed). `graphify update .` not run (graphify CLI not installed in this sandbox) |
| Tests | 2026-11-13 | Full suite: 2,485 across 79 files pass |
| Functions typecheck | 2026-11-10 | Pass, including `travel-photo`; no functions changed since |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high: possible N+1 in `FinanceDataContext`. Not rerun since |
| Travel, production | 2026-11-11 | Migrations `20261110190000`, `20261110190100` on hosted, RLS and grants read back; anonymous `/travel` renders; signed-in flows unverified |

## Next

1. Owner reviews the branch on a real phone: Travel (swipe the page over the map; drag the 2D map sideways; pick Gibraltar; fold and unfold continents; globe turns to a country, holds, and spins again after ~12s) and About (swipe the fact cards; signed in, pick a favourite film and series). Then merge to main and deploy.
2. Check the finance layout changes signed in on production: Budget, Cash Flow, Dashboard charts; Tax, Published Rates, Goals forms; holiday and debt dialogs.
3. Owner checks the signed-in Library toolbar on an iPhone, and News at 1280px with the inspector open on a laptop (a real trackpad swipe, Safari).
4. Owner signs in on production and checks Travel: re-imports the Flighty CSV, adds and publishes a trip, uploads one photo (no EXIF/GPS), runs an import and a backup. Then clear the open items in REHAUL_PLAN 8.F.
5. On a real iPhone: drag a collection card's detail sideways (should not move), then open a signed-in edit dialog. Open: `responsive.css` rules for `dialog-flush`, `collection-detail-dialog`, `watchlist-detail-with-seasons` match nothing in `src`; "Next up" pill wraps below 1560px.
6. Owner opens `/beliefs` signed in on the live site; checks the shell on a real phone (Add to Home Screen) and in dark theme. Then the public hub: Projects content and visibility per collection.
7. Bank link: on a phone, Connect Another Bank opens TrueLayer in a new tab; approve in the Barclaycard app; card appears and the original tab refreshes; then desktop.
8. Tax Calculator and Money Hub: signed-in check on production. Money Hub: cross-currency, Berlin and Amsterdam, Hide Figures, phone width.
9. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `supabase/functions/merchant-logo-cache/index.ts`; deploy; run one manual sync.
10. Signed-in checks: Student Loan, holiday booking, recurring undismiss, Home Brandfetch logos, Watchlist edits and watched toggles, Cash Flow.
11. Owner: set hosted pension to salary sacrifice; record SLC's next balance; check `1063LX` in the HMRC app; check whether benefits from November 2026 are payrolled.
12. Finish save/reload races and schema reproducibility (`schemas/` composite-key objects). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02` and `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout: coordinate file ownership and one committer; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified. Browser checks need a connected browser extension.
- Not merged: main lacks the About cards and travel phone work until item 1 is done.
- Left out of commits on purpose: `.claude/launch.json`; `SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md` (absent here).

## Open risks

- Hosted `site_content` rows `about_me_1` and `about_me_2` have `section` NULL, but ABOUT_READ filters `section = 'about'`, so About shows the `src/config/site.json` fallback; edits will not show until `section` is set.
- Warm-up sends about 30 anonymous reads, including the full Watchlist library (~7,600 episodes); payload unmeasured; `Save-Data` is Chromium-only.
- Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library. Recurring "Show as suggestion again" deletes without confirmation.
- Carried, unverified: four reference tables delete-then-insert; stalled token refresh; schemas-only rebuild misses composite keys; hosted sync, JWT config, headers, cron/Edge/pg_net, HEIC uploads; advisor warnings (`is_admin` callable by anon and authenticated); leaked-password protection off.
- Student Loan: pending income-linked interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026. Local seed has the 2026/27 Plan 2 threshold at 28,470, hosted 29,385.
