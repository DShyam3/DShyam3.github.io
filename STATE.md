# State

Updated 2026-11-24. Branch `main` on top of `e030d81d` ("Seen it offers the rating"). Also updated hosted `finance_settings` payday schedule for Dhyan (`monthly_date`, day `29`).

## Closed (recent)
- **Travel map touch preview** (`src/components/dot-matrix/DotMatrixGlobe.tsx`, `src/features/travel/TravelPage.tsx`, `src/pages/Index.css`): first touch tap previews the country (or hex in Cities mode) in the readout bar without opening the inspector drawer; tapping the same target again or tapping the `Open` button opens it; tapping ocean clears the preview. Mouse/trackpad keeps hover + single-click. Prompt gated on `(hover: hover) and (pointer: fine)` so iPads show `TAP TO EXPLORE`. Checks green (`lint`, `typecheck`, `build`, `impeccable detect src/`); not yet verified on real iPad hardware.
- **Seen it offers the rating** (`e030d81d`, on `origin/main`): Seen it on a Discover tile keeps the tile in place and asks for the rating; verified on local Supabase stack only, not yet seen on live site or checked as owner.
- **Wildcards** (`12e24973`, pushed, deployed in run `45474511099`). Some YOU MIGHT LIKE tiles are well-loved titles from a genre outside the usual, labelled `Wildcard · <Genre>`, at most one per five other tiles. Live bundle grep only. Signed-out local production check only. Decision in `REHAUL_HISTORY.md` (2026-11-23).
- **Route error screen** (`70cf978f`, deployed in run `45275294640`). A page outside Finance that fails to render shows a full-screen message. Verified on a local production build only; live bundle contains the messages.
- **Hosted migration name match** (`70cf978f`, no database change). `20261122221500_watchlist_atomic_prune.sql` renamed to `20261122222356_watchlist_atomic_prune.sql` to match hosted history (md5 of statements matched).
- **Stale-chunk reload** (`4c0439d7`, deploy run `45240037699`). Verified locally only.
- **Discover dislikes count** (`8d8ca5fc`, deploy run `45188378499`). Migration `20261123135113_watchlist_dismissal_facts` applied to hosted; 1,694 answers, 0 without facts. Decision in `REHAUL_HISTORY.md`.
- **Discover steps 1–3** (`ec6881fa`, `fc16742f`, `fbe288dd`, live via `00527d91`). Migrations `20261122192738` and `20261122201711` applied to hosted.
- **Watchlist atomic prune and cron sync** (`1a69f6d8`), UI polish (`734971af`, `ce7706cb`).

## Still open (not verified)
- **Travel map touch preview**: pushed to `main`; needs real iPad hardware check (tap-to-preview, second-tap-to-open, `Open` button hit target, ocean tap to clear, and trackpad hover).
- **Seen it offers the rating**: on `origin/main`; not seen on the live site; reviewer fixes not re-reviewed.
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
1. **Commit and ship "Seen it offers the rating"** when the owner says so. Fetch origin first; check for peer sessions on this tree.
2. **Signed-in owner browser check** (REHAUL_PLAN Discover item 1): steps 1–3, dislikes, the taste line from the whole library, and Seen it's rating offer on a Discover tile.

## Blockers
- Item 2 needs the owner's signed-in session; no agent can perform it.
