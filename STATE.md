# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **UI craft, motion, Apple SF Symbols & Floorplan cleanup pass**: Extracted 49 genuine Apple SF Symbols 7.3 Dualtone/Hierarchical SVG components (`src/components/ui/sf-symbols.tsx`) wired into `src/components/ui/icon.tsx`, `FactCards.tsx`, `SemanticConstellation.tsx`, `Header.tsx`, `ThemeToggle.tsx`, `NavMenu.tsx`, `WorkspaceRail.tsx`, `CommandDock.tsx`, `WorkspaceInspector.tsx`, and `WatchlistNav.tsx`. Unified `Sonner` toasts, `Vaul` mobile drawer, `cmdk` command dock, `@number-flow/react` animated figures, motion tokens (`src/theme/motion.css`), `/links` icon resolver (`src/collections/link-icons.ts`), and 4 streaming SVG logos. Lean 19-skill roster + automatic `floorplan` refresh and end-of-task skill gate in `AGENTS.md`. Deleted `DotMatrixIcon.tsx`, `toast.tsx`, `toaster.tsx`, `use-toast.ts`, `typography.ts`, and `design/redesign-phase0/`; uninstalled 21 unused npm packages; moved shared finance types to `src/lib/finance/types.ts` (0 upward imports).
- Discover as taste data, step 2 (`fc16742f`, migration `20261122201711_watchlist_not_seen` applied to hosted): Likely seen reads the whole watch history; Not seen is its own answer. Decisions: `REHAUL_HISTORY.md`, 2026-11-22.
- Step 1 (`ec6881fa`, migration `20261122192738_watchlist_dismissal_reasons`) and Wikidata nightly cache (`f618f259`, migration `20261122195334`, `tmdb-proxy` v26, `watchlist-cron-sync` v31) live.

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run src/collections/link-icons.test.ts src/config/route-meta.test.ts` | pass (9/9; 126 files / 2,975 pass at `fc16742f`) |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns |
| `node .agents/skills/floorplan/scripts/refresh.mjs .` | pass |
| `graphify update .` | pass |
| `npm run typecheck:functions` & `test:functions` | pass at `f618f259` (44 pass) |
| `npm run ship-check` | last 93/100 (`1a38256c`) |

## Not verified (carry forward)

- Live browser verification of UI craft, Apple SF Symbols, `Vaul` drawer, `cmdk` dock, and custom `franchise` override / `tv-spinoffs` v2 / Franchises merged cards / Favourites tab / Coming soon priority.
- Signed-in owner view of Discover taste steps 1 and 2 (`REHAUL_PLAN.md` "Discover as taste data" item 4) and live Wikidata cache reads on cold load.
- Same-day seed-list gap on show add/hide/stop; sibling-franchise query timeout; 400-show proxy cap; scheduled 06:00-06:20Z sync advancing `synced_at`.
- Launch checklist manual checks open: Check 1 (phone), 5 (PageSpeed), 6 (`umami.disabled`), 10 (private window).
- Travel hexes not verified on phone (pinch to 32x, GPU memory, frame rate) or live.

## Next

1. Signed-in owner check of Discover steps 1 & 2 and UI craft / SF Symbols on live; then `REHAUL_PLAN.md` "Discover as taste data" items 1-3.
2. Fresh signed-out live load: confirm Wikidata cache reads and 06:20Z run on 2026-11-23.
3. Re-find `/dev` status board (`src/pages/Dev.tsx`, `src/features/dev/api-status.ts`), run `reviewer`, and commit separately.

## Blockers

- Uncommitted `/dev` files in shared checkout must stay separate.
- Local DB drifted (`supabase db reset` restores it). Revolut bank access renewal.
