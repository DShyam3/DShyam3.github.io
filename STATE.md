# State

**Updated:** 2026-10-24 · **Branch:** `claude/compassionate-faraday-6b9xwn` (includes PR #7's branch `claude/friendly-feynman-phs5om`, merged at `97ee417`; no PR of its own yet) · **Deployed code:** `55c2341` (main, PR #6)

## In progress

Committed and pushed on this branch; verified on the local stack only; NOT applied to hosted.

- `20261024140000_merchant_logo_index_admin_only` (from PR #7): anon loses `finance_merchant_logos` and the bucket's public list; admin-only read. Local only.
- `20261024150000_authenticated_grants_least_privilege` (this branch): `authenticated` keeps SELECT, INSERT, UPDATE, DELETE on 48 public tables and gets nothing on `finance_truelayer_connection` or `finance_truelayer_oauth_states` (owner-approved; service_role only). Default privileges are an allowlist (`authenticated` four verbs, `anon` nothing) with a fail-closed post-check. `supabase/schemas/` reproduces the grants.
- Local stack (Supabase CLI 2.120.0, reset to 140000 then `migration up`), reported 2026-10-24: no public relation gives anon or authenticated TRUNCATE, REFERENCES or TRIGGER; 192/192 CRUD probes; PostgREST 24/24 (admin read and write allowed; admin 403 and service_role 200 on the TrueLayer tables; anon writes refused); profile-delete cascade into the TrueLayer tables works; post-check raises on 10 injected bad states; schema-only build in a fresh `supabase/postgres` container has 0 effective-grant mismatches and the same default ACL (its 9 build errors are the open schemas-rebuild item).
- Hosted read-only check, 2026-10-24: Postgres 15.8; all 50 targets exist and are owned by postgres; no non-owner grantors, PUBLIC entries, column ACLs or offenders outside the targets. Nothing that would make the push roll back.
- Hosted has `20261024120000` and `20261024130000` applied (2026-10-24, through `execute_sql` at the repo versions). `20261024140000` and `20261024150000` are not applied.

## Deployed

- `55c2341` (main, PR #6, paged-read benchmark): [Pages run 40083861946](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40083861946) succeeded, checked 2026-10-24 with `gh run list`. Live site not checked.
- Parser override 7.1.7 at `9f13ce77` via [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5): [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded; both CSS outputs matched the 6.1.4 baseline. Earlier: `8f6078e8`, `1395077f`, EDC `799d8358`.
- Hosted database: `20261013100000_inventory_wishlist_not_edc` live since 2026-10-20 (zero conflicts, validated constraint).
- Not deployed: schema repair `9534bfa` (six migration-only finance tables now in `supabase/schemas/40_finance.sql`). The admin-check benchmark (1,051 → 276 ms) is local only.

## Checks

| Check | Date | Result |
|---|---|---|
| Lint (`npm run lint`) | 2026-10-24 | 0 errors, 0 warnings (run for this rewrite) |
| Typecheck (`npm run typecheck`) | 2026-10-24 | Pass (run for this rewrite) |
| Tests / build | 2026-10-24 | 52 files / 1,006 tests pass; build passes (from session) |
| `typecheck:functions` | 2026-10-24 | PASS on all 14 files, but not the npm script as written: Deno 2.9.6 against deno std 0.168.0 served from localhost, `@supabase/supabase-js@2.39.8` from npm in place of esm.sh, because esm.sh and deno.land are blocked here (from session) |
| Local grants `140000` + `150000` | 2026-10-24 | Pass on local stack only; hosted untouched (from session) |
| Review (`reviewer`, Opus) | 2026-10-24 | Two passes; all findings addressed except unifying `20_watchlist.sql`'s older anon idiom (cosmetic) (from session) |
| ship-check | 2026-10-24 | 98/100; 9 findings (1 high potential N+1, 4 medium, 2 low, 2 info). No OSV engine, so the Zod advisory is not cleared (from session) |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-23 | 0 findings then; not current assurance (Zod advisory) |
| graphify | — | NOT run: install refused by the session's permission check; `graphify-out/` is gitignored |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded |

## Next

1. Owner, from this branch: `supabase db push --dry-run` (expect exactly `20261024140000` and `20261024150000`), then `supabase db push`. Not from main (it refuses: hosted's 120000 and 130000 are not on main). Do not run the `supabase migration repair --status reverted` it suggests. Not from `claude/wonderful-shannon-azbdhi` (a different 140000 under the same version; superseded; close and delete it). Do not apply 140000 by hand through `execute_sql`: it is not re-runnable, so a later push would re-run it and fail, and 150000 would never run.
2. After applying: verify read-only, then update SECURITY.md, delete the pending-apply line in REHAUL_PLAN.md, and update REHAUL_HISTORY.md.
3. Open a PR for this branch (it contains PR #7), or merge PR #7 first; verify CI.
4. Owner: uninstall the Strix GitHub App (https://github.com/settings/installations) and delete its trial-ended comment on PR #7.
5. Owner decision: guessable `<slug>.<ext>` merchant-logo keys. Private bucket with signed URLs, or unguessable keys (REHAUL_PLAN.md).
6. Still open from before: `finance_debt_observations` FK across profiles and its missing index; schemas cannot rebuild from empty; Zod 3.25.76 GHSA-mrhx-c7xc-m3w5, fix at ≥4.6.6; hosted finance benchmark; measure Watchlist and finance paths; devices, 200% zoom, live writes; graphify where installs are allowed; allow esm.sh and deno.land so `typecheck:functions` runs as written.

## Blockers / open risks

- Until `20261024150000` is applied, hosted `authenticated` keeps TRUNCATE and the other grants on the 48 tables, and an admin session can read TrueLayer bank tokens through PostgREST.
- Until `20261024140000` is applied, anon can read `finance_merchant_logos` (21 rows) and list the `merchant-logos` bucket. After it, the public object route still confirms a guessed `<slug>.<ext>` (Next 5).
- Sequence and function default privileges still grant anon and authenticated ALL (out of scope; anon cannot reach setval through PostgREST). `supabase_admin` default privileges are unaltered (no app table is owned by it).
- Parser major-version override is validated for this install, tests and CSS only.
- Unverified live or on devices: physical devices, true 200% zoom, live authenticated writes, finance load/save/reload, full ledger, recurring Paid/tick/untick.
- Finance: four reference tables delete-then-insert; debt observation queueing; logout/load/delete races; category changes during sync; unlimited token refresh; failed profile-switch load; recurring early-payment credit; old paid flags without last-paid dates. Finance reads unmeasured on hosted (276 ms at 5,000 rows locally vs 5 × 22 ms at 1,000).
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed; per-season and per-favourite reads unresolved. Other finance collections unpaged; duplicated src/Deno pagers must change together.
- Zod advisory open. The ship-check run had no OSV engine, so it is not evidence of a fix. Nine scanner findings open.
- CI: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
- Full list and reasoning: REHAUL_PLAN.md.
