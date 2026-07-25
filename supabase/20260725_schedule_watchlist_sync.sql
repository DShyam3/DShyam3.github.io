-- Schedules the watchlist-cron-sync edge function to run daily, so the
-- watchlist data stays fresh even if nobody opens the Watchlist page for
-- days (previously the only sync trigger was a client-side effect that
-- only ran while an admin had the page open).
--
-- This does NOT embed the service role key -- it looks it up from Supabase
-- Vault at run time via `vault.decrypted_secrets`. Modern Supabase projects
-- auto-populate a 'service_role_key' secret in Vault; if this project
-- doesn't have one yet, run once in the SQL editor (never commit this to
-- git):
--   select vault.create_secret('<service role key from Project Settings > API>', 'service_role_key');

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('watchlist-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync');

-- Runs at 06:00 UTC daily. Note this is UTC, not UK local time, so it will
-- drift by an hour relative to local time across the BST/GMT boundary --
-- acceptable for a "keep it roughly fresh" job.
SELECT cron.schedule(
  'watchlist-daily-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
