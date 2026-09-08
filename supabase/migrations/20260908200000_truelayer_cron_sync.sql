-- Nightly TrueLayer sync via pg_cron (REHAUL_PLAN.md 7.M Step D)
-- Runs at 05:00 UTC daily (06:00 BST), after midnight settlements have processed.
-- Loops all active bank connections, updating balances and transactions,
-- and records daily balance and net worth snapshots.

SELECT cron.unschedule('truelayer-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'truelayer-daily-sync');

SELECT cron.schedule(
  'truelayer-daily-sync',
  '0 5 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/truelayer-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"action":"sync_transactions"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$
);
