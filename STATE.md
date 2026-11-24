# State

Updated 2026-11-24. Branch `main`; readable dot-matrix numbers commit `df5a4cfb` is pushed to `origin/main`. Separate Watchlist, Supabase, Dev, and launch-config edits remain uncommitted in this checkout; none are claimed as shipped.

## Closed (pushed)
- **Readable numbers in dot-matrix UI** (`df5a4cfb`). Numeric runs in shared `DotMatrixText` labels, command-menu counts, travel itinerary headings, the footer clock, and Home travel fact counts use Space Mono. The local Chrome render showed clear section numbers and counts before the final command-menu and itinerary edits; the final tree passed static checks. No post-deploy or real-device check was done.

## Last checks (2026-11-24, worktree changed concurrently afterward)
| Check | Result |
|---|---|
| `npm run lint` | pass, 0 errors and 0 warnings |
| `npm run typecheck` | pass |
| `npm run typecheck:functions` | pass |
| `npm run build` | pass; Vite reports a large-chunk advisory |
| Bundled `impeccable detect --json --changed` | `[]`, no findings |
| `yes \| npx --yes impeccable detect src/` | not verified: npm registry DNS failed |
| `npm run ship-check` | ran; 90/100 and launch blocker reported for a generated airport-code string that matched the AWS-key pattern. The flagged line was checked and contains airport codes; other findings were not reviewed here |
| `graphify update .`; floorplan refresh, recent-work, build | pass; floorplan retains warnings and unmapped files from other work |

## Still open / not verified
- The number change is pushed but has not been seen on the live site or on a real phone/tablet. Other direct Doto labels may still contain numbers; the local render covered the shared labels, clock and Home fact counts, while the final command-menu and itinerary edits passed static checks only.
- The separate Watchlist, Supabase, Dev, and launch-config worktree edits are in progress, not shipped or verified by this handoff.
- **Seen it offers the rating:** not seen live as the owner; reviewer fixes not re-reviewed.
- **Travel map touch preview:** needs a real iPad check of first/second tap, Open target, ocean clear and trackpad hover.
- **Wildcards:** live bundle checked previously, but not seen in an owner-signed-in browser; reviewer fixes not re-reviewed.
- **Route error screen on Pages:** live, but not seen triggered there.
- **Stale-chunk reload on Pages:** checked locally only; needs an old tab observed across a deploy.
- **FinanceHostBoundary** (`src/features/finance/FinanceSession.tsx`) can throw again if Finance fails while a Watchlist detail is docked; pre-existing.
- **Local Supabase stack:** previously at `20261123135113`. Other local stacks may still carry the old `20261122221500` migration name. Current uncommitted migration has not been applied or verified here.
- The reported hosted `finance_settings` payday schedule (`monthly_date`, day `29`) was not verified here.
- An earlier `npx vitest run` passed 132 files / 3,066 tests after two failures in a prior run did not reproduce; the flake remains unexplained. No test run was made for the current worktree.
- Signed-in owner check of Discover steps 1–3, dislikes and taste line is outstanding. Discover order on the owner's data has not been checked since `48bdbdcf`.
- Wikidata nightly cache run (`06:20Z`, 2026-11-23) remains unverified. Revolut bank consent in TrueLayer needs renewal when convenient.

## Next
1. Finish and verify the separate Watchlist and Supabase edits before shipping that worktree.
2. Check the number change on a real device and after deployment.
3. Run the signed-in owner Discover check from `REHAUL_PLAN.md` item 1.

## Blockers
- Owner-specific Discover checks require the owner's signed-in session.
