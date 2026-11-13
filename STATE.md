# State

Updated 2026-11-13 · Branch `main` · Head `0f9294b2` = origin/main, plus this docs commit. Last code deploy: Pages run `43516229768` succeeded 22:06Z at `0f9294b2` (one trailer button), over `e8a5c94` inspector resize, `9ac0837` Quickest season and poster, `523e67f` About fact cards and phone travel.

## In progress

**Batch of fixes, 2026-11-11, UNCOMMITTED** (27 modified files, plus new `src/collections/facets.ts` and `facets.test.ts`, both need `git add`)
- Finance: hand-added transactions save the picked local day; chart grid, axes and reference lines on theme tokens. ⌘K on the splash opens the palette; a palette pick of an unlisted-category Inventory row reveals it.
- Verified (local dev, anonymous, hosted): ⌘K on the splash; palette pick of "Airpods Pro 2". Unverified: the reveal in a browser (unit tests only); Finance fixes (admin-only); light and dark; real phone.
- Still open: `%23a1a1aa` select chevrons in `GoalsSurface.tsx`, `BudgetSurface.tsx`, `BudgetPresetField.tsx`, `calendar.tsx`; debt inputs `h-10` beside a 44px button; `BudgetSurface.tsx` ~371/419 donut tooltip shows "£1.00", not from rows; FilterBar "All (0)" over a revealed wishlist row.

**Inspector, Watchlist trailers and time-to-finish sort** (`ab8f8d2`, `3f5d473`, `b6cc1e4`, deployed). Production, signed out: inspector switches cards in every order; Ahsoka's title trailer plays at 1440px (YouTube may show a pre-roll ad), Season 2 trailer in the 375px sheet; live CSP `frame-src https://www.youtube-nocookie.com`; Quickest season orders as on local. Hosted trailers: 847/891 movies, 303/312 shows, 304/716 seasons (8 equal the show's; the rest have no TMDB season video, and show-level video names rarely name a season).
- **Follow-ups `e8a5c94`, `9ac0837`** (deployed): narrowing past 1280px/600px with a title open hid it and the card could not reopen it; `inspectorSheetOpen` is now derived from a live `useMediaQuery` (new `src/hooks/use-media-query.ts`, also behind `useIsMobile`), the column renders the detail only while the sheet is shut, and the sheet returns focus to the selection's opener. Quickest season leaves out a next season with an episode dated after today ("S4 still airing", ranked before nothing left); undated rows are ignored (hosted has none). The detail poster lost its bordered, tinted frame. Reviewer (Opus): one doc bug, five risks, three nits, all fixed. Verified 2026-11-13, local dev, hosted, signed out: resize both ways with one copy and focus kept; Travel at 375. Production, signed out, 1440 and 375: poster unframed; Ahsoka moves into the sheet on narrowing, one copy, Escape returns focus to its card; Quickest season shows the same 7 still airing with none finishable after them.
- **One trailer button `0f9294b`** (deployed). The per-season button is gone; the top one plays the selected season's trailer (the show's for specials or a season without one). Selection now lives in the dialog, defaults to `currentSeasonNumber` (first numbered season not fully watched, else the last), is pinned on any watch toggle, and is tied to the title, since News and Your Week hand one open dialog the next title (reviewer (Opus) caught that carry-over; fixed, plus five nits). Verified local dev, hosted, signed out, 1440 and 375: specials and films get the title trailer, reopen resets, a pick on Rings of Power does not reach Tulsa King on News. Production, signed out, 1440: One-Punch Man (S1 watched) opens on S2 and switches to S3; Tulsa King opens on S4.
- Unverified: sort hold and the season pin while marking episodes watched (signed in); signed-in add of a new title gets its trailer; Safari; real phone rotation; Home at the breakpoint.

**About fact cards and travel on phones** (`c53bdc9`, `c7b8404`, `e2e3cb5`, `523e67f`, deployed). Fact cards replace About's "At a glance" and "Continue exploring"; Travel gains a legend, phone-sized flat map, Gibraltar ring, folded continents; `?category=favourites` opens Favourites. Favourite picks in `site_content` keys `favourite_film` / `favourite_series`. Verified headless on stand-in data (iPhone 13, 1440px, light and dark); 2,507 tests at `523e67f`.
- Unverified: real touch on iOS and Android (pan vs drag at 6px, pinch), Safari, the signed-in favourite picker writing to hosted `site_content`, the Projects card (table empty), real flags and posters.
- Open on purpose: Travel chip counts all places where the card counts UN states; `?category=` stays after switching Watchlist tabs; `.travel-country-row--active` keeps an old rgba; map colours in `DOT_PALETTE` (TS), not tokens; `useStackedLayout` is a hand-rolled matchMedia hook (could use `useMediaQuery`).

**Shipped, partly unverified:** Travel globe focus (`e9134b91`); Library toolbar and News columns (`cde866e2`, `0a029b5e`, `a82e1ff0`, `b7803983`, headless only); Travel itinerary, import review and journal (`11676b3a`, `261c193c`); Finance layout fixes (`f6658a78`, `7e1a0a8f`, `c4bbe6b2`); Your Week, episode scroll, phone detail drag, Redesign shell, Bank link, Money Hub and Tax Calculator.

## Checks

| Check | Date | Result |
|---|---|---|
| `0f9294b` | 2026-11-13 | Staged tree alone in a scratch copy: typecheck, lint 0/0, 2,522 tests (81 files), build. graphify updated |
| `e8a5c94`, `9ac0837` | 2026-11-13 | Each staged tree alone on `76ddb494`, in a scratch copy: typecheck, lint 0/0, build pass; 2,507 then 2,513 tests (81 files). graphify updated on the working tree |
| About and travel (`523e67f`) | 2026-11-13 | Lint 0/0; typecheck and build pass; 2,507 tests across 81 files |
| Trailers (`3f5d473`) | 2026-11-12 | Staged tree alone: typecheck, lint, deno check, watchlist tests, build. Hosted: migration `20261111223000` applied, `watchlist-cron-sync` v16, sync runs succeed |
| Batch tests | 2026-11-11 | 2,473 across 79 files once; 1–2 perf tests over 5,000ms under load. Not a clean run |
| Ship-check | 2026-11-06 | 96/100, Beta, 0 blockers, 1 high (possible N+1, `FinanceDataContext`). Not rerun |

## Next

1. Owner on a real phone, production: Travel (swipe over the map, drag the 2D map, Gibraltar, fold continents, globe holds then spins after ~12s) and About (swipe fact cards; signed in, pick a favourite film and series, reload). Delete stale `claude/travel-section-mobile-ux-3qcp9c` on GitHub.
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
