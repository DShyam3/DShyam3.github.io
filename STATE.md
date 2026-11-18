# State

Updated 2026-11-18 · `main` (pushed on top of `238ab556`).

## Deployed & landed on `main`

- **Sovereign Folio colour & matte surface pass (no layout changes):**
  - `src/index.css`: replaced `:root` (warm rag parchment `#EBE4D5`, archival cream cards, Tudor claret `#6B1D2B` primary, antique brass `#96702D` trim) and `.dark` (obsidian-plum `#151218`, matte panels, parchment ink `#EDE3CF`, burnished antique brass `#C49B50` primary/trim, parchment active ribbon `--ribbon`). Mapped the 5 route slots (`sage`/`sky`/`lavender`/`peach`/`rose`) to matte enamel Indicolite, Gulf Blue, Tyrian Purple, Saffron Orange, and Tudor Crimson; updated `--chart-1..5`, `--positive`, `--destructive`, `.hud-corners`, and tightened `--radius` to `6px`.
  - `src/theme/surfaces.css`: removed radial colour-fog washes and glass blur from shell, cards, nav, dialogs, and travel map; replaced with matte opaque panels, double-framed antique brass focal cards, solid 3px enamel route stripes, and parchment/ink active nav ribbons.
  - `src/components/dot-matrix/DotMatrixGlobe.tsx`, `DotMatrixGlobe.css`, `src/pages/Index.css`: updated globe `DOT_PALETTE` and active/visited highlights to antique brass, saffron, and matte Indicolite.
  - `index.html`, `public/manifest.webmanifest`: updated `theme-color` / `background_color` to `#151218`.
  - `DESIGN_SYSTEM.md`, `src/theme/README.md`: updated palette and radii documentation.

## Deployed & landed on `main` (prior session)

- Watchlist loading, caching, update/resync, and nightly sync performance pass (`selectAllPages`, `library-query.ts`, `useTMDB.ts`, `useDiscovery.ts`, `WatchlistContext.tsx`, `tmdb-proxy`, `watchlist-cron-sync`).

## Checks (2026-11-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `graphify update .` | pass |
| `npm run typecheck:functions` | not rerun this pass (no edge function edits; passed prior session) |
| Browser visual check (Sovereign Folio light + dark) | **not yet run** |
| Edge functions deploy (`tmdb-proxy`, `watchlist-cron-sync`) | **not yet deployed** (awaiting user confirmation for hosted mutation `--yes`) |

## Next

1. Visually inspect the Sovereign Folio theme locally in Dark and Light mode (About, Travel, Watchlist, Finance) and tweak any contrast or surface edge cases before committing.
2. Deploy `tmdb-proxy` and `watchlist-cron-sync` to Supabase (`npx supabase functions deploy tmdb-proxy watchlist-cron-sync --remote=yvtiybyuifkiwyrnjebe`).
3. Verify GitHub Pages deploy once committed/pushed, and check nightly show scores after 2026-11-19 06:00 UTC.

## Still unverified & blockers

- **Unverified:** Sovereign Folio visual rendering in browser (dark, light, phone, signed-in finance); hosted Edge Function deploy for `tmdb-proxy` (v19) and `watchlist-cron-sync` (v22); production browser checks for the latest Watchlist features and performance pass.
- **Blockers:** Untracked drafts (`SITE_PLAN.md`, etc.) and `.claude/launch.json` in local main checkout; worktrees `.claude/worktrees/caught-up` and `.claude/worktrees/affectionate-lamarr-f2d2cb`.
