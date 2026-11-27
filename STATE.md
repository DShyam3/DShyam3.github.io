Updated 2026-11-27. `origin/main` is at `5c53774b`; local `main` is one commit ahead with the anon default privileges change, not pushed.

## Closed

- **Travel map double-coastline bugfix** (`64aa9de3` / uncommitted follow-ups): Fixed `hasLand` and `appendLevelDraws` in `src/components/dot-matrix/hexLevels.ts` so pure-sea resolution-2 sub-patches of coastal resolution-1 patches no longer fall back to drawing coarser parent patches with opaque backdrops, eliminating the double-coastline border artifact at `res 6` (`6 km`). Verified in local Chrome across all map looks.
- **Cleaned card images** (`64aa9de3`, on Pages via deploy `46042232214` attempt 2).

## Local work

- **Pruning unused image copies** (`5c53774b`, on Pages via deploy `46042232214` attempt 2): the owner's browser clears, once a day, index rows and bucket files no card has shown for two days (`src/lib/images/prune.ts`, `src/collections/image-sources.ts`), under one lock with every store; rows with lost files are dropped so they are copied again; any copy that fails to load falls back to the original on every card. Reviewed twice by `reviewer` (Opus): 6 + 3 findings fixed; the last 3 fixes not re-reviewed. Verified on the local stack only (backdated data: prune, picture change, lost file, recovery). No migration; the function is unchanged.
- **Finance profile-switch stale rows** (`d6f78cd1`, on Pages via deploy `46042232214` attempt 2; the live Finance chunk carries the new notice text): a table that fails to load after a switch is emptied and named in a notice with Try again instead of showing the previous profile's rows; side lists and empty states follow. Files: `src/features/finance/unloaded-tables.ts` (+test), `FinanceDataContext.tsx`, `FinancePage.tsx`, `BankAccountsSection.tsx`, `NetWorthTrend.tsx`, `PayslipsSection.tsx`, `DashboardSurface.tsx`, `ForecastSurface.tsx`. Committed from a temporary index with only this fix's hunks; another session's hunks in `FinanceDataContext.tsx`, `FinancePage.tsx` and `ForecastSurface.tsx` stay uncommitted in the tree. The commit's own content passed typecheck, lint, build and 3,204 tests in a clean worktree. Reviewed twice by `reviewer` (Opus), all findings fixed. Verified on the local stack by revoking read on bank accounts and budget tables (grants restored). Not verified: the whole-profile notice after a load that throws, real devices, hosted.
- **anon default privileges** (committed on local `main`, **not pushed**; **applied to hosted at `20261127182933`** via `execute_sql`, md5-checked, recorded in `schema_migrations`; local stack applied by hand, unrecorded): `supabase/migrations/20261127182933_anon_default_privileges.sql`, `supabase/schemas/90_privileges.sql`, `src/integrations/supabase/default-privileges.test.ts`. Reviewed by `reviewer` (Opus), 4 findings fixed, fixes not re-reviewed. REHAUL_PLAN.md security LOW closed.

## Last checks (2026-11-27)

| Check | Result |
|---|---|
| Lint / frontend typecheck / Deno check / build | Passed (`0` errors, `0` warnings). |
| Travel & dot-matrix tests | 12 files, 86 passing tests. |
| Browser verification (local Chrome) | Verified single clean coastline at 6 km across Classic, Topographic and Satellite mosaic without coarser border ghosting. |
| Impeccable / Ship-check | Impeccable source scan 0 anti-patterns (1 advisory); ship-check 90/100. |
| Image prune (`5c53774b` checked out clean, with `d6f78cd1` beneath) | Lint 0/0, typecheck, Deno check, Vitest 144 files / 3,220 pass, build. Earlier full-tree run: impeccable 0 anti-patterns. |
| Profile-switch fix (2026-11-27) | Lint 0/0 repo-wide; `unloaded-tables` 14 tests and 220 finance tests passed before another session's in-progress edits; full Vitest 3,230 passed earlier in the task. Typecheck now fails only in other sessions' in-progress files (`save-safety.ts` missing `@/lib/in-chunks`, `watchlist/import-match.ts`, `lib/images/prune.ts`). |
| anon default privileges (2026-11-27) | Lint 0/0, typecheck 0, Vitest 147 files / 3,245 pass; migration re-applied locally (no-op), each post-check shown to raise; signed-out REST reads 200; hosted: defaults and sequences verified, signed-out reads 200. |

## Recent shipped work

- Links metadata, daily dead-link checking, likely seen language-aware paging, Payslip parser fixes, and cleaned card images are in Git / on `origin/main`.

## Still open / not verified

- **Travel & Inventory:** Real-device iPhone/iPad checks of map pinch zoom and touches.
- **Live on Pages, not checked signed in:** cleaned card images, image pruning and the profile-switch notice. Only the signed-out home page was opened (no console errors).
- **Other surfaces:** Live owner-signed-in checks of `/watchlist/franchises`, `/watchlist/facts`, Dead-link failures, and manual TV sync.
- **Hosted migration history drift:** hosted records seven versions the repo lacks, so `supabase db push` refuses until repaired (owner's call).

## Next

1. Verify map appearance on iPhone/iPad; open Inventory and Links signed in on Pages.
2. Complete live owner-signed-in checks.

## Blockers

None. The billing lock is cleared; deploy `46042232214` (attempt 2, `5c53774b`) built and deployed on 2026-11-27.
