# State

**Updated:** 2026-10-25 · **Branch:** `main` · **Code on Pages:** `8e8c4c19` ([run 40202391722](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40202391722)) · **Hosted database:** `20261025090000` · **Local stack:** `20261025090000`

## In progress

None in the tree. Waiting on the owner: Next 1.

## Deployed and live (2026-10-25)

- Merchant logos have random names: `merchant-logo-cache` v15 writes `<uuid>.<ext>` (`7d2d1558`). The 41 existing logos were copied to random names and the index repointed: 41 rows, none guessable, all 41 new URLs 200 `image/webp`. The owner deleted the 41 old brand-named objects on 2026-10-25: the bucket holds only random names, and `aldi.webp`, `tesco.webp`, `zara.webp` return 400 with and without cache-busting.
- `finance_debt_observations` is keyed `(profile_id, debt_id)` onto `finance_debts (profile_id, id)` (`20261025090000`, applied with `supabase db push`; dry-run listed only it). Observations against shared default debts are refused. Hosted: one observation, intact.
- `tmdb-proxy` v13 keys its rate limit on the visitor (`cf-connecting-ip`, `eb86cfee`). `truelayer-sync` v48 uses the same helper for `X-PSU-IP`; its `verify_jwt` stays false.
- Edge functions on hosted: `tmdb-proxy` v13, `merchant-logo-cache` v15, `truelayer-sync` v48, `watchlist-cron-sync` v14. `verify_jwt` was read back at 08:47 UTC, before v15 and v48: `truelayer-sync` false, the others true.
- Live, signed in, read-only (2026-10-25): bills calendar (October, six bills, none ticked); Forecast at 375px (no overflow, lowest £20.00 today, none below zero); Student Loan card ("You borrowed" £40,758 as entered, no NaN or Invalid Date); logos render in Spending → Transactions.
- Self-hosted fonts (`eaf8aecd`, pushed straight to `main`): Doto and Space Mono from exact `@fontsource` 5.3.0 pins via `src/theme/fonts.ts`; the CSP allows no Google font host; font files are never inlined. Checked live, signed out: both families load from `dshyam3.github.io`, no request to any Google host.
- Student-loan draw guard ([PR #8](https://github.com/DShyam3/DShyam3.github.io/pull/8), `767322b5`, merged 2026-10-25): the simulator and course-end inference skip draws with no real date or a non-finite amount. Deployed; the Student Loan card above is its read-only live check.
- Hosted storage: `merchant-logos` allows PNG, JPEG, WebP; `site-assets` allows no SVG (`20261024170000`). Its seven unused files were deleted by the owner 2026-10-25 after a size-checked local backup; the four the site loads still serve.
- Link and upload changes (`dad993b0`, `553b08e3`): local stack only. The live pass was read-only, so no upload, CV or saved link was tried on the live site.
- Not checked live: early-payment Paid, header fade, Travel columns, About bio, phone detail scrolling, stored-date changes (`6e146826`, `b02eb1d5`).

## Checks

| Check | Date | Result |
| --- | --- | --- |
| Logo names, debt key, visitor rate limit (`8e8c4c19`) | 2026-10-25 | `npm run lint` 0 errors, 0 warnings; `npm run typecheck` pass; both run on this tree (`claude/decisions`, docs head `6f46ef95`, code as `8e8c4c19`). From the session, not re-run here: `typecheck:functions`, Deno `_shared` 29 pass, Vitest 1,347 / 56 files, build. Reviewer (Opus) three passes, all findings fixed; the last small fixes not re-reviewed |
| Live probes (`tmdb-proxy` v13) | 2026-10-25 | Three probes from one machine → one key, three hits (IPv4); spoofed `cf-connecting-ip` → 403 at Cloudflare; `truelayer-sync` no auth and `Bearer undefined` → 401; `merchant-logo-cache` no auth → 401; the 41 new logo URLs 200; after the owner's deletion, old names 400 (CDN included) |
| Self-hosted fonts (`eaf8aecd`) | 2026-10-25 | On `85435953` plus the fix: lint 0 errors, 0 warnings; typecheck; build (no Google font host in `dist`); Vitest 1,347 / 56 files. Reviewer no blockers (two comment fixes applied). Deploy run 40202232000 success. Live, signed out: fonts same-origin, no Google requests, CSP `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`. Not run: ship-check, Deno (no functions touched), a payslip import |
| Real runs on hosted | 2026-10-25 | `sync_log`: manual full Watchlist sync 08:47 UTC, success, 1,185 items, 54.7 s, on `watchlist-cron-sync` v14 after the key rotation (TMDB key rotated 2026-10-25; the old one is revoked). `truelayer-sync` answered the signed-in Finance page 200 at 08:28 (v46). Not run: an authenticated sync on v48 |
| Deno typecheck / build / graph | 2026-10-25 | Pass; graph refreshed |
| Finance in London / Los Angeles | 2026-10-25 | 967 tests / 30 files pass in each timezone (earlier tree; not re-run) |
| Pinned ship-check | 2026-10-25 | 98/100 Beta; 8 findings: 1 high, 4 medium, 1 low, 2 info. Before the 2026-10-25 changes; not re-run |
| npm audit / security audit | 2026-10-24 | Earlier tree: 0 vulnerabilities; checklist MEDIUM from dashboard auth; DB checked locally |

## Next

1. Owner, dashboard: turn off public signup (still on: hosted `auth/v1/settings` gave `disable_signup: false`, 2026-10-25); leaked-password protection (Pro); TOTP; Postgres upgrade (brief downtime). Re-run the advisor. Strix is uninstalled; its comments on PR #7 and PR #8 are left by choice.
2. Remaining REHAUL_PLAN.md items: Borrowed rules, security items left, schemas rebuild from empty, Node 24 CI.

## Blockers and open risks

- Unverified, not to be read as passed: live writes (Paid tick, untick and early payment; photo upload; the CV; a saved link), local stack only; the IPv6 /64 path (unit-tested, not probed); a signed-in run of `truelayer-sync` v48 and `merchant-logo-cache` v15; physical devices, 200% zoom, real HEIC files (tests use synthetic boxes), stored dates on a non-UK device.
- Finance: save-safety and races in REHAUL_PLAN.md. Hosted reads unmeasured. Per-row saves left as they are by decision (REHAUL_HISTORY.md, 2026-10-25).
- Visitor IPs still go off-site for images: flagcdn.com (flags), image.tmdb.org (posters), Google Books (thumbnails). Not changed; owner decision.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed.
- Parser override validated for this install, tests and CSS only. CI Node 20 / Ubuntu transition not checked.
- Branches: `main`; `claude/affectionate-lamarr-f2d2cb` (worktree `.claude/worktrees/affectionate-lamarr-f2d2cb`); `codex/student-loan-draw-guard` merged as PR #8, still checked out in the main checkout and in a Codex worktree.
- Full outstanding list and reasoning: REHAUL_PLAN.md.
