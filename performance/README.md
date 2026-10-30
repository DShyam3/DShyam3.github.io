# Performance measurements

Two local runners, plus read-only measurements of the hosted project.

Run from the repository root with Node 22+, the Supabase CLI and the seeded local
stack running. Set `BENCHMARK_PASSWORD` to the local test password recorded in
`supabase/seed.sql` before running:

```sh
node --experimental-strip-types scripts/benchmark-paged-reads.mjs > /tmp/paged-reads.json
node --experimental-strip-types scripts/benchmark-saves-and-tv.mjs > /tmp/saves-and-tv.json
```

The rest of this section describes the paged-read runner. The saves runner
follows the same rules through `scripts/local-stack.mjs`, which obtains keys from
`supabase status`, refuses non-loopback HTTP endpoints and counts REST requests;
it is described under *Saves and TV imports* below.

The runner obtains keys from `supabase status`, refuses non-loopback HTTP endpoints,
creates a unique disposable profile and movie/transaction fixtures, and removes
those fixtures in `finally`. Setup/cleanup use the local service role; measured
movie reads use anon and finance reads use the seeded test administrator. The
seed credentials are local test credentials from `supabase/seed.sql`; the runner
reads the password only from `BENCHMARK_PASSWORD`, never from a committed literal.
Never point this script at production. Do not run `db reset` against an existing
local dataset just to obtain the seeded account. If interrupted by process kill,
use the printed unique marker/profile to remove only that run's local fixtures.

It imports the real `selectAllPages` helper and mirrors the movie-grid and
transaction projections/order from their contexts. Recheck these query shapes
when either context changes. Fixture filters isolate the run; the transaction
query uses one private profile and does not include shared/default rows.

One warm-up and five measured sequential reads run for each table at 100, 1,000
and 5,000 rows. The runner verifies complete results, records actual REST request
counts, and checks that all its fixture rows and profile have been removed.
Timings include HTTP, database/RLS work, JSON parsing and helper aggregation;
setup/cleanup are excluded. The fixtures contain short synthetic values and are
not a representative production ledger or media library.

## Baseline: 2026-10-24

Node v22.23.1, local Docker Supabase. Raw samples and run metadata are in
[paged-reads-2026-10-24.json](paged-reads-2026-10-24.json).

| Read | Rows | Requests per read | Median ms | Min–max ms |
| --- | ---: | ---: | ---: | ---: |
| Movies, anonymous | 100 | 1 | 5.14 | 3.57–6.49 |
| Movies, anonymous | 1,000 | 1 | 6.78 | 6.27–7.69 |
| Movies, anonymous | 5,000 | 5 | 44.04 | 42.12–45.00 |
| Transactions, authenticated | 100 | 1 | 9.06 | 8.84–9.46 |
| Transactions, authenticated | 1,000 | 1 | 34.83 | 33.98–37.47 |
| Transactions, authenticated | 5,000 | 5 | 702.78 | 698.86–734.46 |

These reads paginate rather than querying once per row. The finance timing grows
faster than row count; much of that was the per-row admin check, measured below.
The original local table counts were restored (0 movies, 20 transactions).

## Admin check once per statement: 2026-10-24

`public.is_admin()` is SECURITY DEFINER with a pinned search_path, so Postgres
cannot inline it, and every admin policy called it bare: once for each row
tested. Migrations `20261024120000` (88 public-schema policies) and
`20261024130000` (the 14 admin policies on `storage.objects`) wrap it as
`(SELECT public.is_admin())`, which `EXPLAIN` shows as `InitPlan 1`, evaluated
once per statement. Both were applied to hosted on 2026-10-24, where `EXPLAIN`
shows the same `InitPlan 1`; the timings below are from the local stack only.

Same runner, two runs back to back on one local stack, before and after applying
the two migrations. This is a 4-vCPU cloud container on Node v22.22.0, not the
machine above, so compare within this table only. Raw samples:
[bare](paged-reads-2026-10-24-admin-check-bare.json),
[wrapped](paged-reads-2026-10-24-admin-check-wrapped.json).

| Read | Rows | Requests per read | Bare median ms | Wrapped median ms |
| --- | ---: | ---: | ---: | ---: |
| Movies, anonymous | 100 | 1 | 6.79 | 6.08 |
| Movies, anonymous | 1,000 | 1 | 12.57 | 9.88 |
| Movies, anonymous | 5,000 | 5 | 62.10 | 59.55 |
| Transactions, authenticated | 100 | 1 | 9.02 | 6.48 |
| Transactions, authenticated | 1,000 | 1 | 60.85 | 22.07 |
| Transactions, authenticated | 5,000 | 5 | 1,051.11 | 276.29 |

Anonymous movie reads pass through public-read policies with no admin check, so
they are the control. The second run was faster across the board: the control
dropped by up to about 20% (1,000 movies, 12.57 to 9.88), and finance at 100
rows by a similar amount. Only the finance 1,000- and 5,000-row drops clearly
exceed that. The wrapped finance read still grows faster than row count (276 ms
at 5,000 rows against 5 × 22 ms at 1,000); this runner does not isolate the
rest.

Storage reads were not timed. For storage the check was access, not speed: on
the local stack, before and after, anon and a signed-in non-admin could not
list, download, sign a URL for, upload, update or delete a `finance-documents`
object, and the administrator could do all six. On hosted, with the roles
simulated inside a rolled-back transaction, anon and a non-admin read none of
the bucket's objects and could not upload; the administrator read all of them
and could.

Statements that touch no rows lose nothing: the InitPlan runs lazily, and
`EXPLAIN ANALYZE` of a select, an update and a storage list that touch no rows
shows it as `never executed`. A one-row statement calls it once per clause, as
before. One case did pay, in a separate run: the per-row trigger in a TV removal
made 500 episode deletes about 20 ms slower (*Saves and TV imports*, below). Why
that trigger's `UPDATE` runs the InitPlan when the no-row statements here do not
has not been established.

Not measured: React providers/rendering, shared/default-row reads, favourite-facts
sync, external TMDB, cron CPU, concurrent edits, cold database caches, or
production/network latency after the migrations. The broad N+1 scanner finding
and full workflow performance verification remain open.

## Saves and TV imports: 2026-10-24

`scripts/benchmark-saves-and-tv.mjs` mirrors the request shapes of `saveRows` in
`FinanceDataContext` (deletes, updates grouped by identical patch, and
`ON CONFLICT DO NOTHING` inserts, each in sequential chunks of 100, using the
app's own `inChunks`), of the TV branch of `addToWatchlist` and of
`removeWatchlistItem` in `WatchlistContext` (without the TMDB calls, and without
the full library refetch the app runs after an import), and of the Watchlist
grid's nested TV library read at roughly the hosted library's size. Recheck these
shapes when either context changes. It follows the paged-read runner's rules:
a unique disposable profile, local service role for setup/cleanup only, anon or
the seeded administrator for the measured requests, one warm-up and five
measured runs, request counts and fixture cleanup verified.

Local stack, medians of five runs in ms, before and after the admin-check
migration:
[saves-and-tv-2026-10-24-bare.json](saves-and-tv-2026-10-24-bare.json),
[saves-and-tv-2026-10-24-wrapped.json](saves-and-tv-2026-10-24-wrapped.json).

| Case | Rows | Requests | Before | After |
| --- | ---: | ---: | ---: | ---: |
| Finance insert | 1,000 | 10 | 112.02 | 102.00 |
| Finance update, one patch for all rows | 1,000 | 10 | 119.99 | 91.88 |
| Finance update, a different patch per row | 100 | 100 | 619.36 | 651.87 |
| Finance update, a different patch per row | 1,000 | 1,000 | 5,926.91 | 5,974.45 |
| Finance delete | 1,000 | 10 | 107.40 | 100.75 |
| TV import, 1 season × 10 episodes | 10 | 3 | 17.04 | 18.91 |
| TV import, 5 × 10 | 50 | 11 | 21.63 | 24.08 |
| TV import, 20 × 25 | 500 | 41 | 44.37 | 50.51 |
| TV removal, 20 × 25 | 500 | 4 | 33.82 | 53.96 |
| TV library read, anonymous | 300 shows, 750 seasons, 8,625 episodes | 1 | 88.17 | 55.95 |
| TV library read, authenticated | same | 1 | 61.33 | 56.47 |

Writes are bound by request count, not by the policy. The one per-row pattern is
an update where every row's patch differs: saves group rows by identical patch, so
a bulk recategorise is ten requests per thousand rows, but a thousand distinct
edits are a thousand sequential requests, about 6 ms each locally and one network
round trip each in production. TV imports grow with season count (one show row,
then a season row and an episode batch per season, in parallel), not with episode
count.

TV removal is the one case the migration made slower, by about 20 ms for 500
episodes; an unrecorded repeat run gave 52 ms again. Deleting an episode fires
`tr_update_season_watched` once per row, and each firing runs its own `UPDATE` on
`tv_show_seasons` under the caller's RLS. A bare `is_admin()` was tested only on
rows that passed the trigger's `watched IS DISTINCT FROM` filter, which in a delete
is usually none; the wrapped call ran once per firing, so 500 firings cost 500
calls (about 0.03 ms each; 27 ms against 11 ms for the
episode delete in `EXPLAIN ANALYZE`). The same applies to any multi-row episode
change made through the Data API. The cron sync uses the service role and is
unaffected. The anonymous library read's policy is `USING (true)`, so its
before/after difference is run-to-run noise (the bare run ranged from 59 to
136 ms).

A real TV import costs more than these rows show: after the writes, the app
refetches the movies, the nested TV library and the favourites, at least three
more requests (the library read alone is about 56 ms locally and averages 114 ms
of hosted database time), plus the TMDB calls.

## Hosted, read-only, before the admin-check migrations: 2026-10-24

From the hosted project's `pg_stat_statements` (cumulative since 2025-01-20, so
each row is the whole history of one query shape) and `EXPLAIN ANALYZE` of reads
run as the signed-in admin, before `20261024120000` was applied there. Nothing was
written. Times are database execution only: no network, PostgREST or browser.

| Query shape | Calls | Mean ms | Max ms |
| --- | ---: | ---: | ---: |
| Finance ledger page, the app's `profile_id = X OR is_default` read | 125 | 230.1 | 541.0 |
| TV library with seasons and all episode columns (`*`) | 2,076 | 173.6 | 616.3 |
| TV library, grid projection | 420 | 114.4 | 427.2 |
| TV shows with seasons only | 1,237 | 25.1 | 113.6 |
| Movies page | 2,098 | 34.5 | 279.7 |

At the time the ledger held 3,862 transactions (four pages), and the library 883
movies, 301 shows, 734 seasons and 8,594 episodes.

The admin check on the hosted ledger, warm cache, same session:

| Statement over 3,862 rows | Policy as then deployed, per row | Evaluated once |
| --- | ---: | ---: |
| `count(*)` | 60.6 ms | 1.8 ms |
| Last page (offset 3,000, 862 rows) | 77.5 ms | 5.3 ms |

The "evaluated once" column ran as the table owner with an explicit
`(SELECT is_admin())` predicate, because a read cannot change a deployed policy,
so it is a simulation of the change, not a measurement of it. It agrees in
direction with the local result (5.4 times faster for a page locally, 14.6 times
here). The hosted figures have not been re-measured since the migration was
applied.
