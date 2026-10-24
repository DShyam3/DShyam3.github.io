# State

**Updated:** 2026-10-24 · **Branch:** `main` · **Code:** `87a96be9`, pushed (`4a62564c..87a96be9`, 13 commits) · **Hosted database:** `20261024160000`

## In progress

None in the tree. Local stack is out of sync with hosted (see Blockers).

## Deployed, and not

- Pages for `87a96be9` (main): [Pages run 40130002065](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40130002065) succeeded (`gh run view`, 2026-10-24). Live `/travel` loads anonymously with no console errors; nothing signed in checked.
- Hosted database: `20261024120000` through `20261024160000` applied 2026-10-24 with `supabase db push`, recorded in `supabase_migrations.schema_migrations` (head `20261024160000`). `20261024160000` adds the five finance foreign-key indexes; all five are valid and ready. `20261013100000_inventory_wishlist_not_edc` live since 2026-10-20.
- `merchant-logo-cache` deployed to hosted as v13 on 2026-10-24 (was v12, 2026-09-29), `verify_jwt` true. v13 carries the read-every-ledger-page fix (`2a2b82d5`) and the 2026-09-30 orphan cleanup (`1e4e2628`). Not yet run by a real TrueLayer sync (it runs fire-and-forget after one).
- **On main, not checked live:** bills calendar, balance forecast, per-period recurring Paid with early payment, Student Loan "You borrowed", header social-link fade, Travel UN and city columns, About whole bio on desktop, phone collection detail as one scroller.

## Checks

| Check | Date | Result |
|---|---|---|
| `npm run lint` | 2026-10-24 | 0 errors, 0 warnings; re-run on `87a96be9` |
| `npm run typecheck` | 2026-10-24 | Pass; re-run on `87a96be9` |
| `npm run typecheck:functions` | 2026-10-24 | Pass as written, Deno 2.7.5, esm.sh and deno.land reachable (from session) |
| Vitest | 2026-10-24 | 54 files, 1,282 tests pass (from session) |
| `npm run build` | 2026-10-24 | Pass (from session) |
| `npm audit` | 2026-10-24 | 0 vulnerabilities (from session) |
| Reviewer (Opus), salvage and student-loan commits | 2026-10-24 | No blockers; invalid-date draws, runner duplication and logo-cache comment fixed (from session) |
| Anonymous browser, `vite preview` | 2026-10-24 | Travel renders hosted data with the new columns; no console errors (from session) |
| Hosted, read-only, before the 160000 apply | 2026-10-24 | anon SELECT only (20 tables); authenticated SELECT, INSERT, UPDATE, DELETE; no TRUNCATE, REFERENCES or TRIGGER for either (from session) |
| Hosted after `20261024160000` and function deploy | 2026-10-24 | Performance advisor 0 unindexed foreign keys (was 5); unused-index 21 (was 16, the new indexes); grants unchanged; security advisor no new findings; anon POST to `merchant-logo-cache` with no auth header → 401; `aldi.webp` public URL → 200 `image/webp` (from session) |
| graphify update | 2026-10-24 | Ran (from session) |
| ship-check | 2026-10-24 | NOT re-run on `87a96be9`. Last run on `f19051b`: 98/100, 9 findings, before zod was removed |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-23 | 0 findings then; not re-run |
| Signed-in finance | — | NOT run. New finance features unverified live |

## Next

1. Owner, signed in on the live site: the finance features above, including bills calendar and Forecast at 375px, recurring Paid tick, untick, early payment and edit, and Student Loan "You borrowed". Logos render after a sync (v13 unrun so far).
2. Owner: uninstall the Strix GitHub App (https://github.com/settings/installations) and delete its trial-ended comment on PR #7. Dashboard: Postgres upgrade, leaked-password protection, TOTP MFA. Confirm public signup is off (SECURITY.md recommends it; not checked today).
3. Owner decision: guessable merchant-logo keys (REHAUL_PLAN.md, Database follow-ups).
4. Owner decision: `finance_debt_observations` cross-profile foreign key (composite key).
5. Owner decision: the three remaining worktrees and branches (Blockers); local stack reset.
6. Then, all in REHAUL_PLAN.md: finance save design for per-row edits, the save-safety and race list, schemas rebuild from empty, the Borrowed rules, CI runtime.

## Blockers and open risks

- Guessable logo keys: the public object route still confirms a guessed `<slug>.<ext>`. One object, `aldi.webp`, returns 200 publicly (2026-10-24); signed-in logo rendering is unverified.
- Local stack carries a hand-applied `20261024120000` (policy rewrite and five indexes) that `schema_migrations` does not record. `supabase db reset` when nothing local is worth keeping; owner call.
- Worktrees and branches, owner decision: `fix/readiness-followups` (uncommitted, superseded; removal refused by the session's permission check); `fix/tablet-touch-ux` (12 uncommitted files from 2026-09-15, 52 commits behind main, never reviewed); `claude/affectionate-lamarr-f2d2cb` (site assistant v1, 6 commits, blocked on a model key).
- Zod: removed in `2cdb02f8`, not upgraded. The scanner has not been re-run since.
- "Borrowed" has three rules that can disagree (REHAUL_PLAN.md).
- Unverified, live or on devices: physical devices, 200% zoom, live authenticated writes, finance load, save and reload, full ledger, the Next 1 item.
- Finance: save-safety and race list (REHAUL_PLAN.md). Hosted finance reads unmeasured (276 ms at 5,000 rows locally vs 5 × 22 ms at 1,000). 1,000 distinct per-row edits take about 6 s locally; hosted not measured.
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed; favourite-facts sync not measured. Removing a 500-episode show got ~20 ms slower locally after the admin-check migration (per-row trigger; performance/README.md); not planned.
- Parser major-version override is validated for this install, tests and CSS only.
- Security advisor items accepted or dashboard-only: Postgres patches, leaked-password protection, MFA (SECURITY.md).
- CI: Node 20 Actions face Node 24 enforcement and `ubuntu-latest` moves to 26. Earlier handoff, not checked today.
- Full list and reasoning: REHAUL_PLAN.md.
