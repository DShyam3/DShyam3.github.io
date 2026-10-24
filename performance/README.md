# Local paged-read measurements

Run from the repository root with Node 22+, the Supabase CLI and the seeded local
stack running. Set `BENCHMARK_PASSWORD` to the local test password recorded in
`supabase/seed.sql` before running:

```sh
node --experimental-strip-types scripts/benchmark-paged-reads.mjs > /tmp/paged-reads.json
```

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
once per statement. Both are applied to the local stack only; hosted is unchanged.

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
object, and the administrator could do all six.

Small statements lose nothing. The trade-off expected beforehand -- a statement
fired per row by a trigger paying one `is_admin()` call even when it touches no
rows -- did not appear: the InitPlan runs lazily, and `EXPLAIN ANALYZE` of a
select, an update and a storage list that touch no rows shows it as
`never executed`. A one-row statement calls it once per clause, as before.

Not measured: React providers/rendering, finance saves, shared/default-row reads,
TV nested seasons/episodes, favourite-facts sync, external TMDB, cron CPU,
concurrent edits, cold database caches, or production/network latency. The broad
N+1 scanner finding and full workflow performance verification remain open.
