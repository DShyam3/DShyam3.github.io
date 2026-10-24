# State

**Updated:** 2026-10-24 · **Branch:** `main` (`claude/compassionate-faraday-6b9xwn` fast-forwarded into it and deleted) · **Code on main:** `f19051b`, deployed · **Hosted database:** `20261024150000`

## In progress

None. Main, GitHub Pages and the hosted database agree as of 2026-10-24.

## Deployed

- Hosted database: `20261024120000` through `20261024150000` applied 2026-10-24 with `supabase db push` from `a9d0d9f`; recorded in `supabase_migrations.schema_migrations`, hosted ends at `20261024150000`. `20261013100000_inventory_wishlist_not_edc` live since 2026-10-20 (zero conflicts, validated constraint).
- `f19051b` (main, pushed 2026-10-24 as a fast-forward of `claude/compassionate-faraday-6b9xwn`): [Pages run 40128546816](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40128546816) succeeded. Carries the grants migrations' files and schema sync, and the TrueLayer panel change ("Backfilled" / "Backfilling" pills replaced by detail-line text "History imported" / "Importing history · checked to <month>"; checked in a local browser at 1280px and 375px with fixture connections). Live site not checked.
- `1403bbe` (main, PR #7 merged by the owner): [Pages run 40119952121](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40119952121) succeeded. `55c2341` (PR #6): [Pages run 40083861946](https://github.com/DShyam3/DShyam3.github.io/actions/runs/40083861946) succeeded.
- Parser override 7.1.7 at `9f13ce77` via [PR #5](https://github.com/DShyam3/DShyam3.github.io/pull/5): [Pages run 39995955348](https://github.com/DShyam3/DShyam3.github.io/actions/runs/39995955348) succeeded; both CSS outputs matched the 6.1.4 baseline. Earlier: `8f6078e8`, `1395077f`, EDC `799d8358`.
- The admin-check benchmark (1,051 → 276 ms) is local only.

## Checks

| Check | Date | Result |
|---|---|---|
| Hosted post-apply verification | 2026-10-24 | Read-only after the owner's `supabase db push` (verified by coordinator): `140000` and `150000` recorded; no public relation gives anon or authenticated TRUNCATE, REFERENCES or TRIGGER; catalog as in SECURITY.md; anon and admin access simulated in SQL; security advisor: no new findings. Live: the owner's finance page showed all four TrueLayer connections synced at 20:40, after the 20:36 push (service_role path works). NOT checked live: merchant-logo images over HTTP |
| Lint (`npm run lint`) | 2026-10-24 | 0 errors, 0 warnings (run 2026-10-24) |
| Typecheck (`npm run typecheck`) | 2026-10-24 | Pass (run 2026-10-24) |
| Tests / build | 2026-10-24 | 52 files / 1,006 tests pass; build passes (from session) |
| `typecheck:functions` | 2026-10-24 | PASS on all 14 files, but not the npm script as written: Deno 2.9.6 against deno std 0.168.0 served from localhost, `@supabase/supabase-js@2.39.8` from npm in place of esm.sh, because esm.sh and deno.land are blocked here (from session) |
| Local grants `140000` + `150000` | 2026-10-24 | Pass on the local stack (Supabase CLI 2.120.0, reset to 140000, then `migration up`); then applied to hosted (see post-apply row) (from session) |
| Review (`reviewer`, Opus) | 2026-10-24 | Two passes; all findings addressed except unifying `20_watchlist.sql`'s older anon idiom (cosmetic) (from session) |
| ship-check | 2026-10-24 | 98/100; 9 findings (1 high potential N+1, 4 medium, 2 low, 2 info). No OSV engine, so the Zod advisory is not cleared (from session) |
| Audit (`security/AI-CHECKLIST.md`) | 2026-10-23 | 0 findings then; not current assurance (Zod advisory) |
| graphify | — | NOT run: install refused by the session's permission check; `graphify-out/` is gitignored |
| Larger-mode browser | 2026-10-20 | Wallet fits 640×400 / 375×844 without horizontal overflow |
| EDC local browser | 2026-10-19–20 | Owned selection persists; wishlist excluded |

## Next

1. Owner: check the live finance page (TrueLayer panel shows the new detail-line text) and open `https://yvtiybyuifkiwyrnjebe.supabase.co/storage/v1/object/public/merchant-logos/aldi.webp` and the finance page to confirm logo images still load live. Unverified until then.
2. Owner: delete `claude/wonderful-shannon-azbdhi` (superseded, unmerged) and `claude/friendly-feynman-phs5om` (merged as PR #7); uninstall the Strix GitHub App (https://github.com/settings/installations) and delete its trial-ended comment on PR #7.
3. Owner decision: guessable `<slug>.<ext>` merchant-logo keys. Private bucket with signed URLs, or unguessable keys (REHAUL_PLAN.md).
4. Dashboard: Postgres upgrade from `supabase-postgres-15.8.1.030` (`/settings/general`; the project goes offline for it); leaked-password protection (Pro plan and above); TOTP MFA. SECURITY.md has the details.
5. Still open from before: `finance_debt_observations` FK across profiles and its missing index; schemas cannot rebuild from empty; Zod 3.25.76 GHSA-mrhx-c7xc-m3w5, fix at ≥4.6.6; hosted finance benchmark; measure Watchlist and finance paths; devices, 200% zoom, live writes; graphify where installs are allowed; allow esm.sh and deno.land so `typecheck:functions` runs as written.

## Blockers / open risks

- Guessable logo keys: the public object route still confirms a guessed `<slug>.<ext>` (Next 3).
- Logo images over HTTP after `140000` are unverified live (Next 1).
- Sequence and function default privileges still grant anon and authenticated ALL (out of scope; anon cannot reach setval through PostgREST). `supabase_admin` default privileges are unaltered (no app table is owned by it).
- Security advisor, accepted or dashboard-only: Postgres patches outstanding; leaked-password protection and MFA off (SECURITY.md).
- Parser major-version override is validated for this install, tests and CSS only.
- Unverified live or on devices: physical devices, true 200% zoom, live authenticated writes, finance load/save/reload, full ledger, recurring Paid/tick/untick.
- Finance: four reference tables delete-then-insert; debt observation queueing; logout/load/delete races; category changes during sync; unlimited token refresh; failed profile-switch load; recurring early-payment credit; old paid flags without last-paid dates. Finance reads unmeasured on hosted (276 ms at 5,000 rows locally vs 5 × 22 ms at 1,000).
- Watchlist: cron CPU unmeasured; production sync-race fix unconfirmed; per-season and per-favourite reads unresolved. Other finance collections unpaged; duplicated src/Deno pagers must change together.
- Zod advisory open. The ship-check run had no OSV engine, so it is not evidence of a fix. Nine scanner findings open.
- CI: Node 20 Actions face Node 24 enforcement; ubuntu-latest moves to 26.
- Full list and reasoning: REHAUL_PLAN.md.
