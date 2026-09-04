# Supabase directory

Project ref: `yvtiybyuifkiwyrnjebe` (Personal_Website, eu-west-2).

## Current layout

```
supabase/
  schemas/        Declarative schema, one file per collection. This is the
                  readable source of truth: to know what a table looks like,
                  open its file. Verified byte-for-byte against production
                  (491 statements, identical set).
  migrations/     CLI-managed migrations. Filename version matches the applied
                  migration history exactly. Everything new goes here.
  functions/      Deno edge functions, deployed separately from the frontend.
  *.sql           Legacy flat files, pre-dating the migrations/ directory.
                  Historical record only -- see "Known drift" below.
  config.toml     Currently only project_id.
```

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

Storage bucket policies are **not** here -- they live in `storage.objects`,
outside the dumped `public` schema, and stay as hand-written migrations.

## Known drift

The flat `*.sql` files in this directory were applied ad hoc through the
dashboard and MCP rather than through `supabase db push`, so they do not line up
with the applied migration history:

- Timestamps differ. `20260724_secure_content_tables_rls.sql` was applied as
  version `20260817221404`.
- One applied migration has no file here at all
  (`20260817221725_revoke_anon_select_truelayer_connection`).
- Four files were never applied as migrations:
  `20260716_finance_relational_schema.sql`,
  `20260718_add_truelayer_table.sql`,
  `20260718_add_account_id_to_transactions.sql`,
  `20260725_schedule_watchlist_sync.sql`.

**Do not run the flat files.** They are kept for provenance until the history is
reconciled.

Everything from `20260904110337_secure_storage_object_policies` onward lives in
`migrations/` and is correctly versioned.

### The migrations folder cannot yet rebuild the database

`supabase db diff` builds a shadow database by replaying `migrations/` from
empty. That currently fails on the very first file:

```
Applying migration 20260904110337_secure_storage_object_policies.sql...
ERROR: function public.is_admin() does not exist (SQLSTATE 42883)
```

`is_admin()` was created by a legacy migration that only exists in the remote
history, not in `migrations/`. Until a baseline migration fills that gap,
`db diff` and `db reset` do not work, and generated migrations are unavailable.

`supabase/schemas/` is still accurate and useful on its own -- it was dumped
straight from production -- it just is not yet wired to the diff tooling.

## Applying changes

Until the declarative baseline lands, new changes go in `migrations/` with a
timestamp matching what the server records.

After the baseline, the workflow becomes:

```bash
# edit the relevant file in supabase/schemas/
npx supabase db diff -f describe_the_change   # generates the migration
npx supabase db push                          # applies it
```

`db diff` needs a running Docker daemon -- it starts a shadow Postgres to
compute the difference.

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
