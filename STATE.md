# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **Incremental >1,000-line sub-module splits (Floorplan Health 15 → 10 large files)**: Split `holidays.ts`, `uk-tax-calculator.ts`, and `student-loan.ts` into strict downward DAGs with pure facades (767/767 finance tests passing); split `WatchlistPage.tsx` (→ 996 lines), `FinancePage.tsx` (→ 970 lines), `DotMatrixGlobe.tsx` (→ `globeHelpers.ts`), `WatchlistContext.tsx` (→ `watchlist-sync-helpers.ts`), `FinanceDataContext.tsx` (→ `finance-data-helpers.ts`), `TaxIncomeSurface.tsx` (→ `tax-income-helpers.ts`), `TransactionsTab.tsx` (→ `transactions-tab-helpers.ts`), and `BudgetSurface.tsx` (→ `budget-surface-helpers.ts`). All checks green, reviewed by `reviewer` (`pro` / Opus).
- **UI craft, motion, Apple SF Symbols & Floorplan cleanup pass**: Extracted 49 genuine Apple SF Symbols 7.3 Dualtone/Hierarchical SVG components (`src/components/ui/sf-symbols.tsx`) wired into `src/components/ui/icon.tsx`, `FactCards.tsx`, `SemanticConstellation.tsx`, `Header.tsx`, `ThemeToggle.tsx`, `NavMenu.tsx`, `WorkspaceRail.tsx`, `CommandDock.tsx`, `WorkspaceInspector.tsx`, and `WatchlistNav.tsx`. Unified `Sonner` toasts, `Vaul` mobile drawer, `cmdk` command dock, `@number-flow/react` animated figures, motion tokens (`src/theme/motion.css`), `/links` icon resolver (`src/collections/link-icons.ts`), and 4 streaming SVG logos. Lean 19-skill roster + automatic `floorplan` refresh and end-of-task skill gate in `AGENTS.md`. Deleted `DotMatrixIcon.tsx`, `toast.tsx`, `toaster.tsx`, `use-toast.ts`, `typography.ts`, and `design/redesign-phase0/`; uninstalled 21 unused npm packages; moved shared finance types to `src/lib/finance/types.ts` (0 upward imports).
- Discover as taste data, step 2 (`fc16742f`, migration `20261122201711_watchlist_not_seen` applied to hosted).

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run src/collections/link-icons.test.ts src/config/route-meta.test.ts` | pass |
| `npm run build` | pass |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns |
| `node .agents/skills/floorplan/scripts/refresh.mjs .` | pass |
| `graphify update .` | pass |
| `npm run typecheck:functions` & `test:functions` | pass (44 pass) |

## Not verified (carry forward)

- Live browser verification of UI craft, Apple SF Symbols, `Vaul` drawer, `cmdk` dock, and large file module splits.
- Signed-in owner view of Discover taste steps 1 and 2 and live Wikidata cache reads on cold load.
- Launch checklist manual checks open: Check 1 (phone), 5 (PageSpeed), 6 (`umami.disabled`), 10 (private window).

## Next

1. Signed-in owner check of Discover steps 1 & 2 and UI craft / SF Symbols on live.
2. Fresh signed-out live load: confirm Wikidata cache reads and 06:20Z run on 2026-11-23.
3. Re-find `/dev` status board (`src/pages/Dev.tsx`), run `reviewer`, and commit separately.

## Blockers

- Uncommitted `/dev` files in shared checkout must stay separate.
- Local DB drifted (`supabase db reset` restores it). Revolut bank access renewal.
