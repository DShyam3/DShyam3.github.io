Updated 2026-11-28. `origin/main` at `adf3cb0b` (Discover started-franchises follow-up, live on Pages via deploy `46136844637`). Synced with anon default privileges, travel map fixes, Ponytail setup and audit fixes.

## Closed

- **Watchlist Discover sections collapsible** (`c6f410b1`, on `origin/main`, live on Pages via deploy `46068774982`; not checked on Pages). Each of COMING SOON, HAVE YOU ALREADY WATCHED? and YOU MIGHT LIKE has an `aria-expanded` heading button with a chevron. Open or closed is remembered per section in localStorage. The body stays mounted (hidden) so Discover data keeps loading. A section shown alone in the picker is always open. Undo of "None of these" focuses the section if its button is hidden. FEATURES.md updated in the same commit.
- **Ponytail setup & whole-repo audit fixes** (`5791ffeb`, live on Pages via deploy `46063005569`; all 8 modified Edge Functions deployed to hosted Supabase). Ponytail skills in `.agents/skills/ponytail*`, ruleset in `AGENTS.md`. Edge Function error handling, finance insert-before-delete and debt fixes, dead code removed, `date-fns` call sites replaced (kept as a `react-day-picker` peer).
- **Cleaned card images** (`64aa9de3`, live on Pages via deploy `46042232214` attempt 2).

## Watchlist (pushed)

- **HAVE YOU ALREADY WATCHED? no longer ends empty** (`a486dcae`, on `origin/main`, live on Pages via deploy `46070577186`; decision in `REHAUL_HISTORY.md`, 2026-11-27). For the owner, franchise cards also count released films saved but not watched: `Seen it` marks the saved film watched, `Not seen` answers no, stopped films count as answered. An empty Likely seen grid on screen pages on through the widely watched pool. Reviewed by `reviewer` (Opus); its two bugs and four of five risks fixed.
- **Started franchises only** (`adf3cb0b`, live on Pages via deploy `46136844637`; not checked on Pages): saved films are asked about, and `Not seen` offered, only in a franchise with a title watched or a series in progress and not stopped (`franchiseStarted`), after Pages showed merely saved collections (Open Season, 0 of 4) filling the section.
- **`Not seen` buttons read `Haven’t seen it`** (committed, not pushed): the owner found `Not seen` beside the `Not started` badge unclear, so the answer now pairs with `Seen it` on franchise rows and Likely seen tiles, in the footer and in the reset dialog.

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
| `npm test` (Vitest) | Discover fix on `c6f410b1` | 2026-11-27 | 147 files, 3,251 passed |
| lint / typecheck / build / impeccable | Discover fix on `c6f410b1` | 2026-11-27 | 0/0, passed, passed, 0 anti-patterns (1 advisory) |

## Still open / not verified

- **Discover collapsible (`c6f410b1`):** unverified: layout with real Discover data loaded (the dev server on 8089 had no TMDB CORS, so only failure states were seen); Undo focus fallback (needs Likely seen data); real devices. Verified on a dev server: click/Space/Enter toggle, `aria-expanded` and hidden body, focus ring, reload persistence, picker-alone forces open, 2400px two-column grid, 44px touch target under touch emulation, no React warnings.
- **Discover empty-section fix (`a486dcae`, live):** on Pages signed out, Likely seen filled after about 2 minutes (the call pacer's rate); the owner saw the saved-film cards with `Seen it` / `Not seen` on Pages, but their writes were not exercised. Focus loss when a card's last answer removes the card is not fixed. The console 404 was `GET /rest/v1/image_cache` before that table existed on hosted Supabase (last 2026-11-27 11:16 UTC).
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
