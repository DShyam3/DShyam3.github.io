Updated 2026-11-28. Branch `main`, one local commit ahead of `origin/main` (the 4px spacing grid, not pushed). Uncommitted in tree: Travel Section 26.52 (a copy is also in `stash@{0}`, see Still open).

## Closed

- **Idle-Spin Zoom-Out (`Section 26.52`)** (local, uncommitted): after 12 s idle the globe eases its tilt back to the equator and its zoom back to `1.0x` whole-world view, exponentially. Vitest, lint, typecheck, build and graphical audits green.
- **4px spacing grid: guard + shell** (committed locally, not pushed): ratchet test `src/theme/spacing-grid.test.ts` with `spacing-grid-baseline.json` fails any new off-grid spacing; legacy counts may only go down. Shell (`WorkspaceRail`, `Header`, `NavMenu`, `CommandDock`, `WorkspaceInspector`, `Footer`, `surfaces.css`, `responsive.css`, `index.css`) computes 0 off-grid values at 1024x768; mobile menu checked at 375px. Rule recorded in `DESIGN_SYSTEM.md`.
- **4px spacing grid: home page** (committed locally, not pushed): home selectors in `src/pages/Index.css` and `src/pages/Index.tsx` on the grid. Home measures 5 of 381 spacing values off-grid in the browser (was 218 of 435), all from shared `src/components/ui` primitives. Mobile 375px checked: no overflow, 44px tabs.
- **Watchlist Discover sections collapsible** (`c6f410b1`, live via deploy `46068774982`; not checked on Pages). Each section has an `aria-expanded` heading button with a chevron; open/closed remembered in localStorage; body stays mounted (hidden) so data keeps loading; a picker-alone section is always open.
- **Ponytail setup & whole-repo audit fixes** (`5791ffeb`, live via deploy `46063005569`; 8 Edge Functions deployed to hosted Supabase). Ponytail skills in `.agents/skills/ponytail*`, ruleset in `AGENTS.md`. Edge Function error handling, finance insert-before-delete and debt fixes, dead code removed, `date-fns` call sites replaced.
- **Cleaned card images** (`64aa9de3`, live via deploy `46042232214` attempt 2).

## Watchlist (pushed)

- **HAVE YOU ALREADY WATCHED? no longer ends empty** (`a486dcae`, live via deploy `46070577186`; decision in `REHAUL_HISTORY.md`, 2026-11-27). Franchise cards also count released films saved but not watched: `Seen it` marks the film watched, `Not seen` answers no, stopped films count as answered. Reviewed by `reviewer` (Opus); its two bugs and four of five risks fixed.
- **Started franchises only** (`adf3cb0b`, live via deploy `46136844637`; not checked on Pages): saved films are asked about, and `Not seen` offered, only in a franchise with a title watched or a series in progress and not stopped.
- **`Not seen` reads `Haven’t seen it`** (`912be21e`, live via deploy `46139260367`; not checked on Pages): pairs with `Seen it` on franchise rows, Likely seen tiles, the footer and the reset dialog.

## Travel (pushed)

- All three map looks mark visited cities and outline visited-country borders and coastlines. Topographic and Satellite refine through 120, 45, 17 and 6 km hexes. Full-resolution imagery loads on demand. Reduced motion applies view changes immediately and disables idle rotation.
- Eight map appearance styles, zoom-preserving live-location H3 hex highlighting, refined Topographic elevation legend labels, latitude-corrected 6x6 slippy-tile streaming, deep-zoom satellite blending, AWS Terrarium DEM relief streaming, surface color-scale legends.
- Local desktop Chrome max frame gaps, before → after: 367 → 17 ms (appearance switch), 200 → 17 ms (zoom in), 33 → 17 ms (zoom out), 17 → 17 ms (globe/flat). Phone frame timing and real iPhone/iPad gestures unverified.

## Last checks

| Check | Ref | Date | Result |
|---|---|---|---|
| `npm run lint` | spacing work | 2026-11-28 | 0 errors, 0 warnings |
| `npm run typecheck` / `npm run build` | spacing work | 2026-11-28 | Passed |
| `npm test` (Vitest) | spacing work | 2026-11-28 | 148 files, 3,255 pass in a clean worktree of HEAD plus the spacing commit only (149 / 3,259 in the shared tree). Use `--testTimeout=60000`: at 5s, heavy compute tests (hexDetail, hexMapData, hexRegions, holidays, uk-tax-calculator) time out under parallel load; all pass serially |
| `yes \| npx --yes impeccable detect src/` | spacing work | 2026-11-28 | 0 anti-patterns (1 pre-existing advisory) |
| `npm run typecheck:functions` | spacing work | not run | no `supabase/functions` changes |
| lint / typecheck / typecheck:functions / build | Travel task | 2026-11-28 | Passed, 0 errors, 0 warnings |
| `npm test` (Vitest) | Travel task | 2026-11-28 | 147 files, 3,245 pass |
| Travel / dot-matrix tests | Travel task | 2026-11-28 | 13 files, 90 pass |
| `npm run test:functions` (Deno) | `5791ffeb` | 2026-11-27 | 124 pass, 0 fail |
| `npm run typecheck:functions` | `5791ffeb` | 2026-11-27 | Passed |
| lint / typecheck / build / impeccable | `c6f410b1` | 2026-11-27 | 0/0, passed, passed, 0 anti-patterns (1 advisory). Live-page scan: 20 findings, same as baseline `dd930681`, pre-existing |
| `npm test` (Vitest) | Discover fix on `c6f410b1` | 2026-11-27 | 147 files, 3,251 pass |

## Still open / not verified

- **Stash:** `stash@{0}` (autostash from the ~12:35 `git pull --rebase --autostash`) is kept as a backup; the index was unstaged with `git reset -q` on 2026-11-28 and every file is back to plain uncommitted. Drop the stash only once each session has confirmed its work is in the tree.
- **Spacing guard vs uncommitted Travel work:** the baseline holds `DotMatrixGlobe.css` at its committed 13. The uncommitted Section 26.52 edits add 4 off-grid values (`gap: 0.425rem`, `padding: 0.2rem 0.55rem`, `gap: 0.225rem`), so `src/theme/spacing-grid.test.ts` fails in this tree until they snap to 4px (0.5rem, 0.25rem 0.5rem, 0.25rem).
- **Spacing grid:** 819 off-grid values in 105 files remain: finance 493 in 43 files (no longer blocked; its uncommitted work landed in `2ebd1bbf`), `components/ui` 25, travel half of `Index.css` 20. CSS `round()` gutters need Chrome 125+ / Safari 15.4+ / Firefox 118+; older browsers drop the gutter to 0 (untested). Signed-in pages and real devices not checked.
- **Discover collapsible (`c6f410b1`):** unverified with real Discover data (dev server on 8089 had no TMDB CORS, so only failure states were seen); Undo focus fallback needs Likely seen data; real devices. Discover order on owner data is also unchecked (REHAUL_PLAN.md item 6). Verified on a dev server: click/Space/Enter toggle, `aria-expanded`, focus ring, reload persistence, picker-alone forces open, 2400px two-column grid, 44px touch target, no React warnings.
- **Discover empty-section fix (`a486dcae`, live):** on Pages signed out, Likely seen filled after about 2 minutes (call pacer's rate); saved-film cards with `Seen it` / `Not seen` seen on Pages, writes not exercised. Focus loss when a card's last answer removes it is not fixed. The console 404 was `GET /rest/v1/image_cache`, before that table existed on hosted Supabase (last seen 2026-11-27 11:16 UTC).
- **Freeze report (2026-11-28):** owner saw page and Chrome tab switching freeze. Signed out on Pages, Discover had no long task over 99 ms in 70 s; with the full library (1,949 titles, 14,167 episodes) `libraryLookup` takes 17 ms, taste profile 11 ms. Mac at load average 115 (Codex, WindowServer, Antigravity, a VM). Signed-in paths unmeasured; owner to check Chrome's Task Manager next time.
- **Ponytail audit follow-ups:** Monolith splits (#18) and `src/lib/finance/llm.ts` removal intentionally deferred.
- **Real devices and signed-in checks:** iPhone/iPad map pinch zoom and touches; live owner-signed-in checks of `/watchlist/franchises`, `/watchlist/facts`, dead-link failures, manual TV sync, Inventory and Links. Cleaned card images, image pruning and the Finance profile-switch notice are live on Pages, not checked signed in.
- **Hosted migration drift:** hosted records seven versions the repo lacks, so `supabase db push` refuses until repaired (owner's call; REHAUL_PLAN.md database follow-ups).

## Next

1. Check Discover collapse on Pages signed in with real data, including the Undo focus fallback.
2. Verify map appearance on iPhone/iPad; open Inventory and Links signed in on Pages.
3. Continue 4px migration: `src/components/ui` primitives (Button sm), then non-finance features, then finance.

## Blockers

None blocking. The index state above needs an owner decision before anyone commits. Floorplan refresh was skipped in this worktree (`floorplan/` is gitignored and lives in the main checkout); run it there. `graphify update .` ran.
