# State

Updated 2026-11-20 · `main` at `2f1601b8`, pushed to `origin/main`. `2f1601b8` is deployed (Pages run 44789914433 succeeded; the live CSS carries the 26rem Travel track). Uncommitted edits to `DiscoverySection.tsx` and `useDiscovery.ts` are from another session, not this round; inspect before attributing.

## Pushed, this round

- `2f1601b8` Travel globe and flat map (`DotMatrixGlobe.tsx`, `src/theme/responsive.css`):
  - Zoom, pan, fly-to and spring-back ease per unit of time (`easeOver`, tuned to 60 Hz), so they no longer run 2–4x fast on 120/240 Hz screens. Rotation momentum friction is still per frame; touch pinch is unchanged.
  - Wheel zoom is about 7% per 100 px notch (was 10%), exponential and symmetric in and out; Firefox line and page deltas are converted to pixels; one event is capped at 240 px.
  - At 2200px+ wide and 600px+ tall (not centred wide mode), `.travel-layout` uses `26rem minmax(0, 1fr)`. The list keeps its width and the map fills the rest; the ~1000px gap is gone.
  - Verified locally: 60 Hz preview, three notches ease and the draw loop sleeps after ~0.96 s; emulated 5120×1440, list 416px, map 4314px, no gap.
  - Unverified: feel on a real 120/240 Hz monitor; the user's 49" screen; phone. The zoom-feel complaint is addressed in code, not yet confirmed by the user.

## Pushed earlier, still open

- `1a38256c` Travel hex-map performance (WebGL2 globe and flat map, canvas 2D fallback, redraw only while moving). Files and decision in `REHAUL_HISTORY.md`. Deployed (Pages run 44706048460 succeeded).
  - Unverified: real-time fps on a visible, focused window (preview rAF was throttled, so frame costs came from calling the draw loop directly); Travel enter/exit lag (never timed); touch and pinch on a real phone; shader compile on drivers other than this Mac's Chrome.
  - Known, left as is: in WebGL mode the stars sit above the cells during the 500 ms morph; border width multiplies by dpr twice; a country selected within ~2 s of a drag can let leftover momentum turn the globe off it.
- `2977e585` Travel H3 res-3 hexagon map (12,390 cells, 234 countries/territories). Live Pages deployment was not separately confirmed.
- `34e104f7` Watchlist person filmography, Cool facts tab, News layout, Discover cap and watched search (`Seen it` dating). Browser checks still open.
- `c6cb54c7` CollectionCard stall fix and `franchise` column; `20261120074000_watchlist_franchise.sql` applied on `yvtiybyuifkiwyrnjebe`.
- Dot-matrix UI chrome (`8886fe3c`). Browser verification remains open.

## Landed elsewhere, checks still open

- Travel double-flash and Finance latency fixes: pushed and user-verified live.
- About wide-screen layout (`76a56f9a`): browser-verified locally at 2560×1080 and 1440×900; live deploy not confirmed.
- Payslip (`d5120557`) and row-logo (`234eeba2`) changes pushed. Reimbursement migration `20261119150000_payslip_reimbursement_links.sql` recorded as applied on `yvtiybyuifkiwyrnjebe`; linked table access, RLS and signed-in behaviour unverified. PDF imports capture summary figures only, so reimbursement lines need manual entry.
- `feat/watching-mid-season`: signed-out preview checked; signed-in shelves not.
- OMDb first pass completed 2026-11-19 (films 1,064/1,070; series 393/395).

## Checks (2026-11-20, `2f1601b8`, as reported by the landing session)

| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `vitest` `src/components/dot-matrix` + `src/lib/equalEarth.test.ts` | pass, 3 files / 13 tests |
| `graphify update .` | pass |
| `npm run typecheck:functions` | not run (no functions changed) |
| full `vitest run` | not run this round; last full run 2026-11-20 at `1a38256c`: 115 files / 2841 tests |
| `npm run ship-check` | not run this round; last 93/100, **Do not launch yet** (2026-11-20, `1a38256c`) |
| Browser | local preview at 60 Hz and emulated 5120×1440 only; real 120/240 Hz, 49" and phone not run |

## Next

1. Check zoom feel on a 120/240 Hz screen and the 49" display, and the wide layout on the real monitor.
2. Hex-map unverified items above, on the live site and a phone. Check the first weekly OMDb refresh around 2026-11-25 in `sync_log`.
3. Browser-check Discover's watched search (film, series, All; desktop and phone), Library Add, and Watchlist shelves, signed in.
4. Browser-check reimbursement entry, suggestions, unlink, stale links and the ledger marker; test leave year 2049.
5. Carry forward ship-check findings; exit code zero does not grant launch approval. Revolut bank access needs renewing (2026-11-19 Finance sync).

## Blockers

None recorded. Real-device checks depend on the user's hardware.

## Unverified carried context

- Signed-in admin and show creator/cast flows remain open. Untracked drafts (`SITE_PLAN.md`, `google_implementation_redesign.md`, `gpt_implementation redesign.md`), `.claude/launch.json` stale `caught-up-worktree` entry and `.claude/worktrees/affectionate-lamarr-f2d2cb` carried forward without re-checking ownership.
