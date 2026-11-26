-- Daily dead-link check for public.links. The links-check edge function runs
-- with the service role, fetches every link and writes one result row per link
-- here. Results live in their own admin-only table because public.links is
-- readable by anon. No trigger: a result whose url no longer matches the
-- link's url is stale, and the function compares the two.

CREATE TABLE public.link_checks (
  link_id uuid PRIMARY KEY REFERENCES public.links(id) ON DELETE CASCADE,
  url text NOT NULL,
  checked_at timestamptz NOT NULL,
  check_status smallint,
  check_error text,
  check_failures smallint NOT NULL DEFAULT 0,
  failing_since timestamptz,
  CONSTRAINT link_checks_check_error_check
    CHECK (check_error IS NULL OR check_error IN ('bad_url', 'blocked_address', 'dns', 'timeout', 'connection', 'too_many_redirects')),
  CONSTRAINT link_checks_check_failures_check
    CHECK (check_failures >= 0)
);

ALTER TABLE public.link_checks OWNER TO postgres;

COMMENT ON TABLE public.link_checks IS 'Daily dead-link check results, written by the links-check function with the service role and read by the owner only.';

COMMENT ON COLUMN public.link_checks.link_id IS 'The link this result belongs to; the result is deleted with the link.';

COMMENT ON COLUMN public.link_checks.url IS 'The URL this result is for; a result whose url differs from the link''s current url is stale.';

COMMENT ON COLUMN public.link_checks.checked_at IS 'When the last dead-link check for this link finished.';

COMMENT ON COLUMN public.link_checks.check_status IS 'The final HTTP status after redirects; NULL when no response was received.';

COMMENT ON COLUMN public.link_checks.check_error IS 'Why the check got no usable response (bad_url, blocked_address, dns, timeout, connection or too_many_redirects); NULL when a response arrived.';

COMMENT ON COLUMN public.link_checks.check_failures IS 'How many consecutive checks have failed; 0 when the last check passed.';

COMMENT ON COLUMN public.link_checks.failing_since IS 'When the current streak of failed checks began; NULL when the link is not failing.';

ALTER TABLE public.link_checks ENABLE ROW LEVEL SECURITY;

-- Read-only from the API; only the service role writes, and it bypasses RLS.
CREATE POLICY "Admin read" ON public.link_checks
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON TABLE public.link_checks FROM anon;

REVOKE ALL ON TABLE public.link_checks FROM authenticated;

GRANT SELECT ON TABLE public.link_checks TO authenticated;

GRANT ALL ON TABLE public.link_checks TO service_role;

-- Daily dead-link check via pg_cron at 04:40 UTC.
SELECT cron.unschedule('links-daily-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'links-daily-check');

SELECT cron.schedule(
  'links-daily-check',
  '40 4 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/links-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $job$
);
