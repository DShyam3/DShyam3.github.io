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
| `10_books` … `18_site_content` | one file per content collection |
| `20_watchlist.sql` | movies, shows, seasons, episodes, schedule, favourites, sync_log, triggers |
| `30_travel.sql` | visited countries + cities |
| `40_finance.sql` | the 19 `finance_*` tables |
| `90_privileges.sql` | schema-level grants and default privileges only |
| `91_realtime.sql` | the `supabase_realtime` publication |

Each collection file is self-contained: table, constraints, indexes, RLS
policies, grants, and any revokes.

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
# 2. generate the migration -- ALWAYS pass --schema public
npx supabase db diff -f describe_the_change --schema public
# 3. READ the generated SQL. See the warning below.
# 4. apply
npx supabase db push
```

`db diff` needs a running Docker daemon. It starts a throwaway Postgres
matching your remote's version, replays `migrations/` into it, and compares
that against your `schemas/` files. Your data never touches it.

### Always pass `--schema public`

Without it, the diff also covers `storage`. Nothing in `schemas/` describes
storage, so the differ concludes the storage policies should not exist and
generates a `drop policy` for every one of them. That would break public image
and CV serving *and* remove the admin-only write protection.

This actually happened while dropping the `creators` table. The generated
migration was discarded, not pushed.

### Read every generated migration

The same discarded migration also contained:

```sql
grant select on table "public"."finance_truelayer_connection" to "anon";
```

…and the same for every other finance table. The cause: `pg_dump` emits `GRANT`
but never `REVOKE`, so the schema files did not record privileges this database
had deliberately taken away, and the differ "helpfully" tried to restore them.
Those revokes are now stated explicitly at the bottom of `40_finance.sql`,
`20_watchlist.sql` and `30_travel.sql`.

The lesson generalises: **the differ proposes, you dispose.** Two known limits
that matter for this schema in particular:

- RLS policy renames and DML are not tracked, and this schema is mostly RLS.
- Revoked privileges never appear on their own; state them by hand.

### File ordering matters

Schema files run in filename order, so anything that depends on a table must
sort after it:

- `01_functions.sql` holds functions only. The two watchlist **triggers** live
  in `20_watchlist.sql`, because `CREATE TRIGGER` needs its table to exist.
- Per-table `GRANT`s live in each collection file, not in a shared privileges
  file -- so deleting a collection removes everything about it at once, and
  grants can never run before their table.
- `90_privileges.sql` keeps only schema-level grants and default privileges.

### Migration timestamps

The baseline is stamped `20260904130000`. `db diff` names new migrations with
the current wall-clock time, so anything generated before 13:00 on 2026-09-04
sorted *before* the baseline and `db push` refused it. If that happens, rename
the file to a later timestamp rather than passing `--include-all`.

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
