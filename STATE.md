# State

Updated 2026-11-24. origin/main at `666dd03a` (Travel map touch preview, another session), after `e030d81d` (Seen it offers the rating). The main checkout is clean at `666dd03a`.

## Closed (recent)
- **Travel map touch preview** (`666dd03a`, pushed by another session; its deploy was still running when this was written). First touch tap previews the country (or hex in Cities mode) in the readout bar without opening the drawer; a second tap or `Open` opens it; tapping ocean clears it. That session also reports updating the hosted `finance_settings` payday schedule (`monthly_date`, day `29`); not verified here.
- **Seen it offers the rating** (`e030d81d`, pushed to main; Pages run `45482255622` succeeded; live entry bundle `/assets/index-DoJocr5-.js` contains "Seen it — rate the show?" and the "Skip: " label, checked by curl grep). Seen it on a Discover tile keeps the tile in place and asks for the rating. Rating or skipping lets it go and the next tile takes its place. Verified on the LOCAL Supabase stack only (`npm run dev:test`, port 5173, signed in as the seeded local test admin, tmdb-proxy served locally). Not seen on the live site. Not checked as the owner. Reviewer (Opus) fixes not re-reviewed.
- **Wildcards** (`12e24973`, deployed run `45474511099`). Some YOU MIGHT LIKE tiles are well-loved titles from a genre outside the usual, labelled `Wildcard · <Genre>`, at most one per five other tiles. Live bundle grep only. Signed-out local production check only. Decision in `REHAUL_HISTORY.md` (2026-11-23).
- **Route error screen** (`70cf978f`, run `45275294640`). A page outside Finance that fails to render shows a full-screen message. Local production build only.
- **Hosted migration name match** (`70cf978f`, no database change). `20261122221500_watchlist_atomic_prune.sql` renamed to `20261122222356_watchlist_atomic_prune.sql` to match hosted history.
- **Stale-chunk reload** (`4c0439d7`, run `45240037699`). Verified locally only.
- **Discover dislikes count** (`8d8ca5fc`, run `45188378499`). Migration `20261123135113_watchlist_dismissal_facts` applied to hosted. Decision in `REHAUL_HISTORY.md`.
- **Discover steps 1–3** (`ec6881fa`, `fc16742f`, `fbe288dd`, live via `00527d91`). Migrations `20261122192738` and `20261122201711` applied to hosted.
- **Watchlist atomic prune and cron sync** (`1a69f6d8`), UI polish (`734971af`, `ce7706cb`).

## Checks (2026-11-24, on the tree that became `e030d81d`)
| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | 0 anti-patterns |
| `impeccable` against running `/watchlist` | 3 reported (header blinking cursor, 2 nested cards) on the signed-out Following panel. Not from this change |
| `npx vitest run` | 132 files / 3,066 tests pass in 7 runs. One earlier run had 2 failing tests that did not reproduce; names not captured. Recorded as flaky and unexplained, unverified |
| `npm run typecheck:functions` | not run (no `supabase/functions` change) |
| `npm run ship-check` | not run |
| `graphify update .`, floorplan refresh / recent-work / build | run in the main checkout at `666dd03a` |

## Still open (not verified)
- **Seen it offers the rating**: not seen on the live site; not checked as the owner; reviewer fixes not re-reviewed.
- **Travel map touch preview**: needs a real iPad check (tap to preview, second tap to open, `Open` hit target, ocean tap to clear, trackpad hover). Reported by the session that built it.
- **Wildcards**: not seen in a browser on the live site, not checked signed in as the owner. Reviewer fixes not re-reviewed.
- **Route error screen on Pages**: live, but not seen triggered there.
- **Stale-chunk reload on GitHub Pages**: verified locally only. Needs a tab opened before a deploy, observed after it.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) renders AppShell in its fallback. Can throw a second time if Finance fails while a Watchlist detail is docked. Pre-existing, not fixed.
- **Local Supabase stack**: checked and clean. It was at `20261122201711`; `supabase migration up --local` applied `20261122222356` and `20261123135113`, so it is now at `20261123135113`. It never recorded `20261122221500`. Other local stacks unknown; fix one with `supabase db reset` or `supabase migration repair --local --status reverted 20261122221500`.
- **Signed-in owner browser check** of Discover steps 1–3 and dislikes: not done. Only the visitor view was checked.
- **Discover order on the owner's data**: not run since the walk stall fix (`48bdbdcf`).
- **Wikidata nightly cache run** (`06:20Z`, 2026-11-23, `f618f259`): not verified.
- **Revolut bank consent** in TrueLayer: renew when convenient.

## Next
1. **Signed-in owner browser check** (REHAUL_PLAN Discover item 1): steps 1–3, dislikes, the taste line from the whole library, and Seen it's rating offer on a Discover tile.

## Blockers
- Item 1 needs the owner's signed-in session; no agent can perform it.
