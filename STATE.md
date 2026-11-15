# State

Updated 2026-11-15 · Branch `main` · Head `2f853367` = origin/main, plus this docs commit. Last code deploy: Pages run `43758421998` succeeded 20:32Z at `2f853367` (Quickest season removed), over `19832e6` Travel green selected dot, `47b2ed6` Quickest to finish skips shows still airing, `0f9294b` one trailer button.

## In progress

**Payslips: Calendar year grouping** (committed to `main`, not pushed or deployed; `src/lib/finance/payslip.ts`, `payslip.test.ts`, `PayslipsSection.tsx`)
- Lint 0/0, typecheck, build, payslip tests 34/34 (also under TZ Auckland and Los Angeles). Reviewer (Opus): nothing blocking; fixed the Group by row wrapping on phones, fold state shared between tax and calendar 2025, a timezone-fragile test, the FEATURES student-loan wording; added tested `inCalendarYear`. Verified local dev, seed admin: desktop, Calendar year shows 2026 and 2025 with headline "· 2026", Tax year unchanged; 375px, the pills wrap whole and folding tax year 2025/26 leaves calendar 2025 open.
- Unverified: production with real payslips; light theme; a real phone.

**Batch of fixes, 2026-11-11, UNCOMMITTED** (27 modified files, plus new `src/collections/facets.ts` and `facets.test.ts`, both need `git add`)
- Finance: hand-added transactions save the picked local day; chart grid, axes and reference lines on theme tokens. ⌘K on the splash opens the palette; a palette pick of an unlisted-category Inventory row reveals it.
- Verified (local dev, anonymous, hosted): ⌘K on the splash; palette pick of "Airpods Pro 2". Unverified: the reveal in a browser (unit tests only); Finance fixes (admin-only); light and dark; real phone.
- Still open: `%23a1a1aa` select chevrons in `GoalsSurface.tsx`, `BudgetSurface.tsx`, `BudgetPresetField.tsx`, `calendar.tsx`; debt inputs `h-10` beside a 44px button; `BudgetSurface.tsx` ~371/419 donut tooltip shows "£1.00", not from rows; FilterBar "All (0)" over a revealed wishlist row.

**Watchlist: inspector, trailers, time-to-finish sort** (`ab8f8d2`, `3f5d473`, `b6cc1e4`, `e8a5c94`, `9ac0837`, `0f9294b`, `47b2ed6`, `dcd8a4f`, deployed). The inspector follows the window across 1280px/600px (live `useMediaQuery`), one copy, focus back to the opener. A detail has one trailer button, playing the selected season's trailer (the show's for specials or a season without one); the selection lives in the dialog, defaults to `currentSeasonNumber`, is pinned on any watch toggle, and is tied to the title (News and Your Week reuse one dialog). One time sort, the owner's ask: "Quickest to finish" for shows, "Shortest first" for films; Quickest season, never asked for, is gone. A show with a season mid-run (`airingSeason`) sorts after every timed show, as "S4 still airing". Hosted trailers: 847/891 movies, 303/312 shows, 304/716 seasons (the rest have no TMDB season video).
- Production, signed out, 1440 and 375: inspector resize and sheet; One-Punch Man (S1 watched) opens on S2, switches to S3; sort offers Title, Latest releases, Quickest to finish; under it Tulsa King reads "S4 still airing": 265 timed, then 13 airing, then 9 up to date.
- Unverified: sort hold and the season pin while marking episodes watched (signed in); signed-in add of a new title gets its trailer; Safari; real phone rotation; Home at the breakpoint.

**About fact cards and travel on phones** (`c53bdc9`, `c7b8404`, `e2e3cb5`, `523e67f`, deployed). Fact cards replace About's "At a glance" and "Continue exploring"; Travel gains a legend, phone-sized flat map, folded continents; `?category=favourites` opens Favourites. Favourite picks in `site_content` keys `favourite_film` / `favourite_series`. Verified headless on stand-in data (iPhone 13, 1440px, light and dark); 2,507 tests at `523e67f`.
- Follow-up 2026-11-15 (`DotMatrixGlobe.tsx` only; `4debf50`, `19832e6`, deployed by Pages run `43757501831`): the ring is gone; a selected city, or a dotless place's grid-square dot (Gibraltar), is drawn in the site's green with a faint glow, at the size it would have anyway (a selected city at least city-sized); no dot changes size (a larger selected dot and a desktop globe-dot enlargement were both reverted at the owner's request). Borders 0.3 alpha at world zoom (was 0.15), up to 0.6 zoomed; phone border width 0.6. Lint 0/0, typecheck, build, 2,522 tests across 81 files; headless light and dark at 1440px and iPhone 13. Unverified: a real phone and Safari. Known: on a laptop in the light theme the whole-world globe's gold is faint (small dots, as before).
- Unverified: real touch on iOS and Android (pan vs drag at 6px, pinch), Safari, the signed-in favourite picker writing to hosted `site_content`, the Projects card (table empty), real flags and posters.
- Open on purpose: Travel chip counts all places where the card counts UN states; `?category=` stays after switching Watchlist tabs; `.travel-country-row--active` keeps an old rgba; map colours in `DOT_PALETTE` (TS), not tokens; `useStackedLayout` is a hand-rolled matchMedia hook (could use `useMediaQuery`).

**Shipped, partly unverified:** Travel globe focus (`e9134b91`); Library toolbar and News columns (`cde866e2`, `0a029b5e`, `a82e1ff0`, `b7803983`, headless only); Travel itinerary, import review and journal (`11676b3a`, `261c193c`); Finance layout fixes (`f6658a78`, `7e1a0a8f`, `c4bbe6b2`); Your Week, episode scroll, phone detail drag, Redesign shell, Bank link, Money Hub and Tax Calculator.

## Checks

| Check | Date | Result |
|---|---|---|
| Payslip calendar year | 2026-11-15 | Lint 0/0; typecheck, build; payslip tests 34/34; full suite 2,532 tests, 82 files, on the whole working tree. Graphify updated. Local dev only |
| Watchlist (`3f5d473` .. `dcd8a4f`) | 2026-11-12 to 15 | Each commit's staged tree alone in a scratch copy: typecheck, lint 0/0, build; 2,522 tests at `dcd8a4f`; deno check and hosted migration `20261111223000`, `watchlist-cron-sync` v16 for trailers |
| About and travel (`523e67f`) | 2026-11-13 | Lint 0/0; typecheck and build pass; 2,507 tests across 81 files |
| Batch tests | 2026-11-11 | 2,473 across 79 files once; 1–2 perf tests over 5,000ms under load. Not a clean run |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high (possible N+1, `FinanceDataContext`). Not rerun |

## Next

1. Owner on a real phone, production: Travel (swipe over the map, drag the 2D map, pick Gibraltar and a city: one green dot each, no ring; borders readable at world zoom; fold continents, globe holds then spins after ~12s) and About (swipe fact cards; signed in, pick a favourite film and series, reload). Delete stale `claude/travel-section-mobile-ux-3qcp9c` on GitHub (local copy deleted; the session's git service refuses remote branch deletes).
2. Signed in on production: time-to-finish order and the shown season both hold while marking episodes watched; add a title and see its trailer at once; a trailer in Safari and on an iPhone; inspector sheet on a phone.
3. Commit the batch (its owner session), with `REHAUL_PLAN.md`'s trailer-note removal; then BST transaction day, Finance charts light and dark, Goals chevrons on production.
4. Finance signed in: Budget, Cash Flow, Dashboard charts; Tax, Published Rates, Goals forms; holiday and debt dialogs.
5. Travel signed in: re-import the Flighty CSV, add and publish a trip, upload a photo, run an import and a backup; then `REHAUL_PLAN.md` 8.F.
6. Real iPhone: collection card detail drag; signed-in edit dialog; "Next up" pill below 1560px. `/beliefs` signed in, phone, dark; public hub Projects and per-collection visibility.
7. Bank link on a phone (Barclaycard app), then desktop and Safari. Tax Calculator and Money Hub signed in.
8. Merchant logos: fix `popworld`; check `revolution-bars` and `vue` in `merchant-logo-cache/index.ts`; deploy; one manual sync.
9. Signed in: Student Loan, holiday booking, recurring undismiss, Brandfetch logos, Watchlist edits, Cash Flow. Owner: hosted pension to salary sacrifice; SLC balance; `1063LX`; November 2026 benefits payrolled?
10. Save/reload races and schema reproducibility (`schemas/` composite keys). Leave `claude/affectionate-lamarr-f2d2cb`, `codex/assistant-integration-2026-11-02`, `origin/claude/net-take-home-tax-f2n71j` alone.

## Blockers

- Parallel sessions share one checkout and cloud sessions push to `main`: fetch first, one committer; keep `backup/pre-rebase-2026-11-03` until signed-in production is verified.
- Uncommitted: the batch, its `vite.config.ts` `data-exclude-search` hunk, `SeasonEpisodeList.tsx` comment and data-attribute removals, other sessions' `FEATURES.md` and `REHAUL_PLAN.md` edits. Left out on purpose: `.claude/launch.json`, `SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`.

## Open risks

- Hosted `site_content` `about_me_1`/`about_me_2` have `section` NULL, so About shows the `site.json` fallback until it is set.
- Warm-up sends ~30 anonymous reads, including the full Watchlist library; payload unmeasured. Watchlist background re-read can overwrite a concurrent edit; a failed first read caches an empty library.
- Carried, unverified: four reference tables delete-then-insert; stalled token refresh; schemas-only rebuild misses composite keys; hosted JWT, headers, cron/pg_net, HEIC uploads; advisor warnings; leaked-password protection off.
- Student Loan: pending interest accrues on the rebuilt balance, not SLC's; a phantom £12 lands October 2026. Keep stash `finance-reconciliation-backup-2026-10-29`.
