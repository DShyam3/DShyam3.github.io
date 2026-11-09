# State

Updated: 2026-11-09 · Branch: `feat/redesign-phase0` · Worktree: `/tmp/dhyan-redesign-phase0` · Base `e64741b2` (`origin/main`) · Nothing committed, pushed or deployed.

Phase 1 of the workspace redesign is in the worktree tree, uncommitted: full-width (`--page-max: 100vw`) adaptive workspace shell that is 2 columns by default (`WorkspaceRail` replacing `NavMenu` on `>=768px` with `Space Mono` section headings/labels and display-size toggle + full-width `<main>`, `data-inspector="closed"`) and opens the 3rd column (`WorkspaceInspector`, `data-inspector="open"` on `>=1280px`×`600px` or modal sheet below) only when a card, poster, country, timeline milestone, or 3D node is actively selected, collapsing back to 2 columns on `×` or `Escape`; plus `CommandDock` (`⌘K`), `Space Mono` mapped to `fontFamily.mono` in `tailwind.config.ts`, standalone PWA manifest, and Home `Overview` mode (`SemanticConstellation` 3D cluster graph, 4-tile "At a glance" strip, and "Continue exploring" record rows alongside `Experience & CV` and `Biography & Projects` tabs).

## Closed 2026-11-09 (in tree, uncommitted)

- **On-demand 3rd-column `WorkspaceInspector` (`data-inspector="open"` / `"closed"`) & `Space Mono` rail typography**: The workspace grid defaults to 2 columns (`WorkspaceRail` at `13.25rem` + full-width `<main>`) when idle (`!hasCustomTarget && !dockedDetail`). `WorkspaceRail` renders its `SECTIONS` heading and uppercase section labels in `Space Mono`, and `tailwind.config.ts` maps `fontFamily.mono` to `Space Mono`. Clicking any Collection or EDC card (`CardDetailDialog`), Watchlist item (`WatchlistDetailDialog`), Travel country (`TravelPage`), Home timeline milestone, or 3D cluster node (`Index`) opens `WorkspaceInspector` in the 3rd column on `>=1280px`×`600px` (or as a modal sheet below that size) instead of a centered popup dialog, and pressing `×` or `Escape` clears the selection and collapses the grid back to 2 columns.
- **Worktree font loading**: `vite.config.ts` adds the resolved `node_modules` path to `server.fs.allow`. The worktree's `node_modules` is a symlink to the main checkout, and Vite was refusing every `@fontsource` `.woff2`, so Doto and Space Mono both fell back to system Menlo on `:8081`. Both now return HTTP 200 (curl-checked). This only affects the dev server; `npm run build` bundles the fonts either way.

## In progress

- **Redesign Phase 1 (uncommitted in `/tmp/dhyan-redesign-phase0`, not pushed, not deployed)**: `AppShell`, `Header`, `Footer`, `WorkspaceRail`, `WorkspaceInspector`, `CommandDock`, `WorkspaceInspectorContext`, `SemanticConstellation`, `CardDetailDialog`, `WatchlistDetailDialog`, `TravelPage`, `Index.tsx`, `Index.css`, `index.css`, `tailwind.config.ts`, `src/theme/responsive.css`, `src/theme/surfaces.css`, and `public/manifest.webmanifest`.
- **Finance edits in main checkout (`/Users/dhyanshyam/Projects/DShyam3.github.io`, uncommitted)**: `useTrueLayer.ts` new-tab bank connection with `truelayer-oauth.test.ts`, `DebtFormDialog`, `PillSwitch`, and other surface edits from parallel sessions remain untouched in the main checkout.
- **Money Hub (`ea8b9640`) & Tax Calculator (`6308e148`, `8113b70d`, `cccfb9bd`, `1f43cf26`)**: live on `main`; signed-in production verification still open.

## Checks

| Check | Date | Evidence / result |
|---|---|---|
| Lint | 2026-11-09 | Pass, 0 errors and 0 warnings (`npm run lint` in `/tmp/dhyan-redesign-phase0`) |
| Typecheck | 2026-11-09 | Pass (`npm run typecheck` in `/tmp/dhyan-redesign-phase0`) |
| Functions typecheck | 2026-11-08 | Pass, 19 Deno files (`npm run typecheck:functions` in `/tmp/dhyan-redesign-phase0`) |
| Tests | 2026-11-09 | Pass, 2,406 tests across 70 test files (`npm test` in `/tmp/dhyan-redesign-phase0`) |
| Build | 2026-11-09 | Pass (`npm run build` in `/tmp/dhyan-redesign-phase0`) |
| Ship-check | 2026-11-05 | 96/100, Beta, 0 blockers, 1 high: existing possible N+1 in `FinanceDataContext`; `glob`/`minimatch` advisories remain |
| Browser | 2026-11-09 | Fonts confirmed served (HTTP 200) after the `server.fs.allow` fix. The 2-column idle state, `Space Mono` rail labels, and on-demand 3rd-column `WorkspaceInspector` (`CardDetailDialog`, `WatchlistDetailDialog`, `TravelPage` country selection, 3D cluster nodes) still need checking in a live browser |

## Next

1. Verify the 2-column default workspace grid, `Space Mono` section rail labels, and on-demand 3rd-column `WorkspaceInspector` (`data-inspector="open"` on selection, collapse to 2 columns on `×` or `Escape`) across desktop (`>=1280px`×`600px`) and mobile/tablet sheet viewports in a browser, then checkpoint-commit Phase 1 on `feat/redesign-phase0`.
2. Build Redesign Phase 2 on `feat/redesign-phase0`:
   - Polymorphic `entity_links` backlink table + RLS migration (`(SELECT public.is_admin())` for writes, public read for non-finance entities) and `@mention` autocomplete when linking records.
   - Port the `/assistant` SSE edge function and strict allowlist context builder (`assistant-context.ts`) from `codex/assistant-integration-2026-11-02`, wiring optional streaming synthesis into `CommandDock` while keeping local-first search and deterministic readouts working without an API key.
3. Reconcile and commit the separate uncommitted Finance UI work in `/Users/dhyanshyam/Projects/DShyam3.github.io` (`useTrueLayer.ts`, `DebtFormDialog`, `PillSwitch`) and verify signed-in production flows.

## Blockers

- Parallel sessions share `/Users/dhyanshyam/Projects/DShyam3.github.io` and `/tmp/dhyan-redesign-phase0`; coordinate one editor/committer before committing.
- Local Supabase stack still lacks the `finance_category_rules` migration.
