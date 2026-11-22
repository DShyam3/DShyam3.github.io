# State

Updated 2026-11-22. Branch `main`, synced with `origin/main`.

## Closed

- **Local & hosted DB in sync**: `supabase db reset` replayed all 106 migrations cleanly through `20261122201711_watchlist_not_seen.sql`; verified 0 pending migrations on hosted (`yvtiybyuifkiwyrnjebe`).
- **Live manual launch checks**: Owner completed real-phone pass (Check 1), mobile PageSpeed Insights (Check 5), `umami.disabled` (Check 6), and signed-in Discover/Finance spot-checks.
- **Live browser audit fixes (`f84abd5e`, `11b868e4`)**: Fixed `WorkspaceInspector` mobile Vaul close (`data-vaul-no-drag`), ORB-blocked VS Code icon rewrite, `WatchlistLayout` child `<Suspense>` boundary, wider desktop `WorkspaceRail` (`14.5rem`), `SemanticConstellation` label clamping, `NativeSelect` `appearance-none`, and `"Southmapton, UK"` → `"Southampton, UK"` in hosted `site_content`.
- **`/dev` status board & History rework (`11b868e4`)**: Reviewed by `reviewer` (Pro); all findings fixed; 16/16 unit tests pass.
- **UI Craft & Floorplan Audit (`ba5b34d2` → `5310b3e9`)**: Apple SF Symbols 7.3, shared Sovereign Folio dashboard primitives (`chart.tsx`, `metric-tile.tsx`, `bar-list.tsx`, `tracker.tsx`), mobile Vaul drawers, `layoutId` pills, smooth disclosure, dead-code/21-package cleanup, and large-file splits (15 → 10).

## Checks (2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` & `npm run build` | pass |
| `npx vitest run` (`api-status`, `link-icons`) | pass (21/21) |
| `yes \| npx --yes impeccable detect src/` | pass, 0 anti-patterns |
| `supabase db reset` (local) | pass (all migrations through `20261122201711`) |
| `graphify update .` & `floorplan` refresh | pass |

## Still open

- Confirm Wikidata nightly cache run at `06:20Z` on `2026-11-23`.
- Renew Revolut bank consent in TrueLayer when convenient.
- Optional backlog (`REHAUL_PLAN.md`): `watchlist-cron-sync` open items (10 b–d) and Watchlist design questions (item 9).
