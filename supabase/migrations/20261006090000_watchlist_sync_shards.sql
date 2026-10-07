-- Split the nightly watchlist sync into three parts, and let sync_log say
-- which part a row covers.
--
-- Why: one whole-library run of watchlist-cron-sync used about 1.7-2.0 s of the
-- 2 s edge-function CPU limit, and was killed before it wrote its sync_log row
-- on 29 Sep and on 2, 4 and 5 Oct. A killed run leaves no row at all, so those
-- nights looked like the job had never fired. The library is now cut into
-- three parts by `id % 3`, run ten minutes apart (06:00, 06:10, 06:20 UTC), so
-- each invocation does roughly a third of the work.
--
-- 1. sync_log gains `shard` and `shard_count`, both nullable smallint.
--    `shard` is the 0-based index of the part a run covered; `shard_count` is
--    how many parts the library was split into. Both NULL means a whole-library
--    run: the manual Sync button, and every row written before this migration
--    (which is why neither column is backfilled -- NULL/NULL is true of them).
--    With the columns the history panel can tell a part that never logged
--    from a day that ran: three parts expected, fewer than three rows present.
--
--    sync_log_shard_check keeps the pair coherent: both NULL, or both set with
--    shard_count in 1..10 and shard in 0..shard_count-1. The second branch
--    repeats IS NOT NULL on purpose. A CHECK passes when its expression is
--    NULL, and without those tests a row with shard NULL and shard_count 3
--    would evaluate the second branch to NULL rather than false, and be
--    accepted.
--
-- 2. The single 'watchlist-daily-sync' cron job is replaced by
--    'watchlist-daily-sync-0', '-1' and '-2', each posting its
--    {"shard": n, "shards": 3} body to the same edge function. Everything else
--    is copied from 20260908080000: the URL, the vault service_role_key
--    header, and the 120 s pg_net timeout. Cron jobs live in migrations only
--    (the baseline put them there), not in supabase/schemas, so there is no
--    declarative counterpart for this half.
--
-- Grants: none to add. sync_log carries table-level grants only -- ALL to
-- authenticated and service_role, nothing to anon (revoked in 20260905160000)
-- -- and no column-level grants anywhere, so the new columns inherit them. RLS
-- is unchanged: admin-only read, insert and delete. There is no UPDATE policy
-- and none is added.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS; the constraint is dropped and
-- re-added; every cron job is unscheduled (only if present) before it is
-- scheduled; COMMENT replaces in place. The whole file is one transaction, so
-- the job swap and the column change land together or not at all.

BEGIN;

ALTER TABLE "public"."sync_log"
    ADD COLUMN IF NOT EXISTS "shard" smallint,
    ADD COLUMN IF NOT EXISTS "shard_count" smallint;

ALTER TABLE "public"."sync_log"
    DROP CONSTRAINT IF EXISTS "sync_log_shard_check";

ALTER TABLE "public"."sync_log"
    ADD CONSTRAINT "sync_log_shard_check" CHECK (
        ("shard" IS NULL AND "shard_count" IS NULL)
        OR (
            "shard" IS NOT NULL
            AND "shard_count" IS NOT NULL
            AND "shard_count" BETWEEN 1 AND 10
            AND "shard" >= 0
            AND "shard" < "shard_count"
        )
    );

COMMENT ON COLUMN "public"."sync_log"."shard" IS
    '0-based index of the part of the library this run covered (rows with id % shard_count = shard). Null together with shard_count for a whole-library run: the manual Sync button, and every row written before the nightly sync was split.';

COMMENT ON COLUMN "public"."sync_log"."shard_count" IS
    'How many parts the library was split into for this run (1 to 10). Null together with shard for a whole-library run. Three nightly rows with shard 0, 1 and 2 and shard_count 3 make a complete day; a missing one is a part that never logged.';

-- Retire the single whole-library job.
SELECT cron.unschedule('watchlist-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync');

-- Part 0 of 3, 06:00 UTC.
SELECT cron.unschedule('watchlist-daily-sync-0')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync-0');

SELECT cron.schedule(
  'watchlist-daily-sync-0',
  '0 6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"shard":0,"shards":3}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$
);

-- Part 1 of 3, 06:10 UTC.
SELECT cron.unschedule('watchlist-daily-sync-1')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync-1');

SELECT cron.schedule(
  'watchlist-daily-sync-1',
  '10 6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"shard":1,"shards":3}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$
);

-- Part 2 of 3, 06:20 UTC.
SELECT cron.unschedule('watchlist-daily-sync-2')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync-2');

SELECT cron.schedule(
  'watchlist-daily-sync-2',
  '20 6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"shard":2,"shards":3}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$
);

COMMIT;
