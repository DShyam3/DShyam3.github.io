Updated 2026-11-27. `origin/main` at `c6f410b1` (collapsible Discover sections), live on Pages via deploy `46068774982`. Synced with anon default privileges, travel map fixes, Ponytail setup and audit fixes.

## Closed

- **Watchlist Discover sections collapsible** (`c6f410b1`, on `origin/main`, live on Pages via deploy `46068774982`; not checked on Pages). Each of COMING SOON, HAVE YOU ALREADY WATCHED? and YOU MIGHT LIKE has an `aria-expanded` heading button with a chevron. Open or closed is remembered per section in localStorage. The body stays mounted (hidden) so Discover data keeps loading. A section shown alone in the picker is always open. Undo of "None of these" focuses the section if its button is hidden. FEATURES.md updated in the same commit.
- **Ponytail setup & whole-repo audit fixes** (`5791ffeb`, live on Pages via deploy `46063005569`; all 8 modified Edge Functions deployed to hosted Supabase). Ponytail skills in `.agents/skills/ponytail*`, ruleset in `AGENTS.md`. Edge Function error handling, finance insert-before-delete and debt fixes, dead code removed, `date-fns` call sites replaced (kept as a `react-day-picker` peer).
- **Cleaned card images** (`64aa9de3`, live on Pages via deploy `46042232214` attempt 2).

## Travel (pushed)

- All three map looks mark visited cities and outline visited-country borders and coastlines. Topographic and Satellite refine through 120, 45, 17 and 6 km hexes. Full-resolution imagery loads on demand. Reduced motion applies view changes immediately and disables idle rotation.
- Local desktop Chrome: max frame gaps before → after were 367 → 17 ms (appearance switch), 200 → 17 ms (zoom in), 33 → 17 ms (zoom out), 17 → 17 ms (globe/flat). Phone frame timing and real iPhone/iPad gestures are unverified.

## Last checks

| Check | Commit | Date | Result |
|---|---|---|---|
| `npm run lint` | `c6f410b1` | 2026-11-27 | 0 errors, 0 warnings |
| `npm run typecheck` | `c6f410b1` | 2026-11-27 | Passed |
| `npm run build` | `c6f410b1` | 2026-11-27 | Passed |
| `impeccable detect src/` | `c6f410b1` | 2026-11-27 | 0 anti-patterns (1 advisory, pre-existing) |
| Live-page impeccable scan | `c6f410b1` | 2026-11-27 | 20 findings, identical to a baseline scan of `dd930681`; pre-existing |
| `npm run typecheck:functions` | `5791ffeb` | 2026-11-27 | Passed (no Edge Function change since) |
| `npm run test:functions` (Deno) | `5791ffeb` | 2026-11-27 | 124 passed, 0 failed |
| `npm test` (Vitest) | `5791ffeb` | 2026-11-27 | 147 files, 3,245 passed (not re-run for `c6f410b1`) |

## Still open / not verified

- **Discover collapsible (`c6f410b1`):** unverified: layout with real Discover data loaded (the dev server on 8089 had no TMDB CORS, so only failure states were seen); Undo focus fallback (needs Likely seen data); real devices. Verified on a dev server: click/Space/Enter toggle, `aria-expanded` and hidden body, focus ring, reload persistence, picker-alone forces open, 2400px two-column grid, 44px touch target under touch emulation, no React warnings.
- **Discover order on owner data:** browser check not run (REHAUL_PLAN.md item 6).
- **Ponytail audit follow-ups:** Monolith splits (#18) and `src/lib/finance/llm.ts` removal were intentionally deferred.
- **Travel & Inventory:** real-device iPhone/iPad checks of map pinch zoom and touches.
- **Other surfaces:** live owner-signed-in checks of `/watchlist/franchises`, `/watchlist/facts`, dead-link failures, and manual TV sync.
- **Hosted migration drift:** hosted records seven versions the repo lacks, so `supabase db push` refuses until repaired (owner's call; REHAUL_PLAN.md database follow-ups).
- **Live on Pages, not checked signed in:** cleaned card images, image pruning and the Finance profile-switch notice.

## Next

1. Check Discover collapse on Pages signed in with real data, including the Undo focus fallback.
2. Verify map appearance on iPhone/iPad; open Inventory and Links signed in on Pages.

## Blockers

None. Floorplan refresh was skipped in this worktree (`floorplan/` is gitignored and lives in the main checkout); run it there. `graphify update .` ran.
