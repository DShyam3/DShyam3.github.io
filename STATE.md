# State

Updated 2026-11-20. Branch `main`, head `ec1fd147`, pushed to `origin/main`.

Uncommitted in the tree:
- Travel hex review fixes, 5 files: `src/components/dot-matrix/` `DotMatrixGlobe.tsx`, `hexDetail.ts`, `hexDetail.test.ts`, `hexLevels.ts`, `hexPatchWorker.ts`. Not committed, not deployed.
- Watchlist: Franchises page dims titles marked Not interested (`EntryList.tsx`, `useDiscovery.ts`, `WatchlistFranchises.tsx`, untracked `useDismissedSuggestions.ts`). Not committed, not deployed. Browser-verified signed-out on the 8082 preview only (dimmed row, chip reads Not interested); the signed-in owner path and Discover's own dismiss after the hook move are covered by lint/typecheck/tests only. Commit separately from the hex diff, by path. When committing the hex diff, stage it by path.

## Pushed, still open (other sessions)

- `/dev` dashboard, API/cron telemetry, Discover franchise retry fixes, Franchises expansion, Watchlist News layout (`5296949c`, `a9e161c1`, `ec1fd147`): pushed, awaiting a live browser check after the Pages deploy.
- Edge functions deployed and `20261120201500_api_usage_metrics.sql` applied remotely (`yvtiybyuifkiwyrnjebe`).
- Open: Marvel as one group (needs a new `tmdb-proxy` universe lookup); Revolut bank access needs renewing.

## Travel hexes

- Shipped in `5296949c`: projection picker, Home constellation fix, first zoom-dependent hex levels.
- Uncommitted: the review fixes. The worker builds each patch once and stops when zoomed out; built geometry lives on the GPU only, with caps of 200 (level 4) and 60 (level 5); level cross-fades land in one step under reduced motion; a level's lookup restyles patches; a remounted worker prepares its levels again; going back to a fading level swaps; the outline is judged at the finer cell's patch. New tests: every level code exists in `public/countries.json`; Antarctica has more than 900 level-3 cells.
- Browser-verified locally (dev preview, not live): levels 4 and 5 draw on the globe and flat map; hover names the right country at level 5 (Spain/Portugal, Ivory Coast/Ghana/Nigeria); no task over 50 ms while zooming in; the draw loop sleeps after zooming out; a projection switch while zoomed in works; console clean apart from other sessions' watchlist HMR errors.
- Earlier, before the review fixes: `vite preview` loaded the worker and the r4/r5 files and drew level 4 over Italy.
- Not verified: phone or touch pinch at 32x; a real high-refresh monitor; the live site with these fixes; GPU memory on phones.
- Decision recorded in `REHAUL_HISTORY.md` ("Hex levels are cut into patches built in a worker", 2026-11-20).
- Undecided, not plan items: a hover label naming the state/province and largest town (needs Natural Earth admin-1 and populated places in the generator); a hex-size control (-/+ with a "45 km hexes" readout, and Auto/120/45/17 km presets).

## Checks (2026-11-20, on the tree with the uncommitted diffs above)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npx vitest run` | pass, 119 files / 2,889 tests |
| `npm run build` | pass; `hexPatchWorker-*.js` emitted |
| `graphify update .` | pass |
| `npm run typecheck:functions` | last pass 2026-11-20 (earlier run); not re-run on this tree |
| `npm run ship-check` | not run; last 93/100 (`1a38256c`) |

## Next

1. Review the 5-file hex diff with `reviewer` (Opus), then commit it by path. Not yet run.
2. Verify on a phone: pinch to 32x, GPU memory with level-5 patches, frame rate on a high-refresh screen.
3. Browser-verify `/dev` and Discover on live once Pages deploys (other session).
4. Verify the OMDb weekly refresh (~2026-11-25).

## Blockers

- The other session's uncommitted Watchlist files must not be swept into the hex commit.
- Revolut bank access renewal.
