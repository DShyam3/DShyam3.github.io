# Supabase directory

Project ref: `yvtiybyuifkiwyrnjebe` (Personal_Website, eu-west-2, Postgres 15).

## Layout

```
supabase/
  schemas/        Declarative schema, one file per collection. The readable
                  source of truth: to know what a table looks like, open its
                  file.
  migrations/     Versioned migrations. Currently one baseline; new changes are
                  generated from schemas/ and land here.
  functions/      Deno edge functions, deployed separately from the frontend.
  config.toml     Project link config. Committed -- holds only project_id.
```

The repo can rebuild this database from empty. `supabase db diff --linked`
reports **no schema changes**, meaning `migrations/` reproduces production
exactly.

## Schema files

| File | Contents |
|---|---|
| `00_extensions.sql` | extensions, `content_type` enum |
| `01_functions.sql` | `is_admin()`, the two watchlist trigger functions |
| `02_privileges.sql` | role grants (mostly Supabase defaults -- see S-10 in `REHAUL_PLAN.md`) |
| `03_realtime.sql` | the `supabase_realtime` publication |
| `10_books` … `19_creators` | one file per content collection |
| `20_watchlist.sql` | movies, shows, seasons, episodes, schedule, favourites, sync_log |
| `30_travel.sql` | visited countries + cities |
| `40_finance.sql` | the 19 `finance_*` tables |

Grouping follows the frontend collections, except where tables form one graph
joined by foreign keys (watchlist, travel, finance), which stay together. Files
run in lexicographic order, so numeric prefixes handle dependency order --
`is_admin()` must exist before any policy that references it.

Storage bucket policies and the pg_cron schedule are **not** in `schemas/`.
They live outside the `public` schema, are not covered by the schema diff, and
are maintained by hand in the baseline migration.

## Making a change

```bash
# 1. edit the relevant file in supabase/schemas/
# 2. generate the migration
npx supabase db diff -f describe_the_change
# 3. read the generated SQL -- it is a draft, not gospel
# 4. apply
npx supabase db push
```

`db diff` needs a running Docker daemon. It starts a throwaway Postgres
matching your remote's version, replays `migrations/` into it, and compares
that against the target. Your data never touches it.

Two known limits of the diff engine, both relevant here:

- **RLS policy renames and DML are not tracked.** This schema is mostly RLS
  policies, so read every generated migration before pushing.
- **Revoked privileges do not appear.** `pg_dump` emits `GRANT` but never
  `REVOKE`, so a revoked privilege shows up only as an absent grant. Section 4
  of the baseline restores these explicitly; anything similar in future needs
  adding by hand.

## History

The migration history was squashed to a single baseline on 2026-09-04
(`20260904130000_baseline.sql`).

Before that, the repo could not rebuild the database. Changes had been applied
through the dashboard without matching files, so replaying `migrations/` from
empty failed on `function public.is_admin() does not exist`. Timestamps in the
repo did not match the applied history, one applied migration had no file at
all, and several files had been applied without ever being recorded.

The baseline was dumped from production, verified with `db diff` (no schema
changes), and the twenty superseded versions were marked reverted so the local
and remote histories agree. Every superseded migration remains in git history;
their combined end state is what the baseline contains.

## Edge functions

Pushing to `main` does **not** deploy these. Each needs its own deploy:

```bash
npx supabase functions deploy <name>
```

| Function | Purpose | Auth |
|---|---|---|
| `tmdb-proxy` | Keeps the TMDB key server-side | Public, restricted to an endpoint allowlist |
| `truelayer-sync` | Open-banking pull for Finance | Verifies JWT + admin email |
| `watchlist-cron-sync` | Scheduled port of the browser sync | Service role key |

The cron job `watchlist-daily-sync` calls `watchlist-cron-sync` at 06:00 daily.
It reads a vault secret named `service_role_key`, which must exist on any fresh
project or the job will run but the function will reject the call.
