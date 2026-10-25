# State

**Updated:** 2026-10-25 · **Branch:** `main` · **Code:** `07425e0c` (PR #8 merge), on Pages ([run 40177042983](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40177042983)) · **Hosted database:** `20261024170000` · **Local stack:** `20261024170000`

## In progress

None in the tree.

## Deployed and live (2026-10-25)

- Student-loan draw guard ([PR #8](https://github.com/DShyam3/DShyam3.github.io/pull/8), `767322b5`, merged 2026-10-25): the simulator and course-end inference skip draws with no real date or a non-finite amount. Deployed; not checked signed in.
- Hosted schema `20261024170000` applied with `supabase db push` (dry-run listed only it). `merchant-logos` allows PNG, JPEG, WebP; `site-assets` allows no SVG. Its three SVG objects still serve.
- Edge functions deployed from `main`; the only change since each last deploy is `34f9af5c`: `tmdb-proxy` v11 (verify_jwt true), `watchlist-cron-sync` v14 (verify_jwt true), `truelayer-sync` v46 (`--no-verify-jwt`, kept false: `config.toml` has no per-function setting).
- `rate_limits` has one `tmdb-proxy:` row from the probe; 183 old unprefixed rows age out.
- **Live, not checked signed in:** link and upload changes (`dad993b0`, `553b08e3`), local stack only. The owner has not signed in on the live site.
- `merchant-logo-cache` v13 on hosted (2026-10-24), verify_jwt true. Not yet run by a real TrueLayer sync.
- **On main, not checked live (signed out):** calendar, balance forecast, early-payment Paid, Student Loan "You borrowed", header fade, Travel columns, About bio, phone detail scrolling, stored-date changes (`6e146826`, `b02eb1d5`).

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Real runs on hosted | 2026-10-25 | `sync_log`: manual full Watchlist sync 08:47 UTC, success, 1,185 items, 54.7 s, on `watchlist-cron-sync` v14 after the key rotation. `truelayer-sync` v46 answered the signed-in Finance page 200 at 08:28. `tmdb-proxy` answers with the new key. `verify_jwt` read back: `truelayer-sync` false, others true |
| Hosted after deploy and `20261024170000` (session) | 2026-10-25 | HTTP: `tmdb-proxy?endpoint=movie/550` with the publishable key → 200; no auth → 401 on `tmdb-proxy`, `truelayer-sync`, `watchlist-cron-sync`; `Bearer undefined` → 401 on `truelayer-sync`; publishable key → 401 on `watchlist-cron-sync`. Grants unchanged; security advisor no new findings. Not run: an authenticated sync |
| Lint / application typecheck | 2026-10-25 | Pass; lint 0 errors, 0 warnings |
| Deno typecheck / build / graph | 2026-10-25 | Pass; graph refreshed |
| Full Vitest | 2026-10-25 | 1,347 tests / 56 files pass |
| Finance in London / Los Angeles | 2026-10-25 | 967 tests / 30 files pass in each timezone |
| Reviewer | 2026-10-25 | No blockers |
| Pinned ship-check | 2026-10-25 | 98/100 Beta; 8 findings: 1 high, 4 medium, 1 low, 2 info |
| Deno shared tests / local uploads | 2026-10-25 | Earlier session: 23 tests pass; sniffed PNG/PDF types stored correctly; objects removed |
| npm audit / security audit | 2026-10-24 | Earlier tree: 0 vulnerabilities; checklist MEDIUM from dashboard auth; DB checked locally |
| Signed-in finance, local | 2026-10-24 | Recurring tick/untick/due-day edit, 375px forecast, Borrowed empty-date guard pass; early payment unit-only |
| Hosted after `20261024160000` | 2026-10-24 | 0 unindexed FKs, grants unchanged, no new advisor findings; logo endpoint anon 401, public aldi.webp 200 |

## Next

1. Owner, signed in on the live site: calendar, Forecast at 375px, Paid (tick, untick, early payment, edit), Borrowed; one photo upload, the CV, a saved link.
2. After a real TrueLayer sync: check logos render (`merchant-logo-cache` v13 has not run yet), and confirm what the last `X-Forwarded-For` entry is at the edge.
3. Owner: delete the seven unused `site-assets` files (`github.svg`, `gmail.svg`, `linkedin.svg`, `favicon.ico`, `dot-matrix.json`, `countries.geojson`, `world-topo.json`); the app draws, bundles or downloads its own copies. Back up the bucket first. Keep `memoji.png`, `selfie.webp`, `dot-world-map.json`, `dot-city-map.json`.
4. Owner, dashboard: turn off public signup; leaked-password protection (Pro); TOTP; Postgres upgrade (brief downtime). Re-run the advisor. Delete Strix's trial-ended comments on PR #7 and PR #8 (the app was uninstalled by the owner on 2026-10-25).
5. Owner decisions: guessable logo keys, `finance_debt_observations` composite key, per-row saves. Then REHAUL_PLAN.md: Borrowed rules, security items left, schemas rebuild from empty, Node 24 CI.

## Blockers and open risks

- Guessable logo keys: the public object route still confirms a guessed `<slug>.<ext>`. `aldi.webp` returned 200 publicly on 2026-10-24. Owner decision.
- TMDB key: rotated 2026-10-25. The hosted secret changed at 08:45 UTC and its digest matches the local `.env`, not the exposed key's. If TMDB did not revoke the old key on regenerating, revoke it there.
- Unverified, not to be read as passed: what the last `X-Forwarded-For` entry is at the edge (only the probe's address seen); physical devices, 200% zoom, live signed-in flows and writes (uploads and saved links included), real HEIC files (tests use synthetic boxes), stored dates on a non-UK device.
- Finance: save-safety and races in REHAUL_PLAN.md. Hosted reads and per-row saves unmeasured; 1,000 distinct per-row edits take about 6 s locally.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed.
- Parser override validated for this install, tests and CSS only. CI Node 20 / Ubuntu transition not checked.
- Branches: `main`; `claude/affectionate-lamarr-f2d2cb` (worktree `.claude/worktrees/affectionate-lamarr-f2d2cb`); `codex/student-loan-draw-guard` merged as PR #8, still checked out in the main checkout and in a Codex worktree.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
