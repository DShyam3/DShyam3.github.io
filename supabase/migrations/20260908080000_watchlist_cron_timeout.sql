-- Raise the pg_net timeout for watchlist-daily-sync to 120 seconds (120,000 ms)
-- to allow full sweeps of large watchlists without premature network cutoff.

SELECT cron.unschedule('watchlist-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync');

SELECT cron.schedule(
  'watchlist-daily-sync',
  '0 6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $job$
);
