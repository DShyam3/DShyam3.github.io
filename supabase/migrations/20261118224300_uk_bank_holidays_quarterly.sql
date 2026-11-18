-- Switch UK bank holidays sync from monthly to quarterly (Jan, Apr, Jul, Oct at 05:00 UTC).

SELECT cron.unschedule('uk-bank-holidays-monthly-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uk-bank-holidays-monthly-sync');

SELECT cron.unschedule('uk-bank-holidays-quarterly-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uk-bank-holidays-quarterly-sync');

SELECT cron.schedule(
  'uk-bank-holidays-quarterly-sync',
  '0 5 1 1,4,7,10 *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/sync-bank-holidays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $job$
);
