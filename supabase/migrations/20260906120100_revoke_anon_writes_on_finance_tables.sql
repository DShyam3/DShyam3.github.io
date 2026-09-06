-- Closes S-10 for finance (REHAUL_PLAN.md Part 1).
--
-- Supabase's defaults for the public schema left anon holding DELETE, INSERT,
-- REFERENCES, TRIGGER, TRUNCATE and UPDATE on every finance_* table. SELECT was
-- revoked at some point; the write privileges were not.
--
-- Not currently exploitable: RLS gates writes to is_admin(), so an anonymous
-- INSERT/UPDATE/DELETE matches zero rows. TRUNCATE is the reason to care --
-- Postgres applies row-level security to SELECT/INSERT/UPDATE/DELETE only, so
-- that grant is a latent privilege whose only barrier is that PostgREST exposes
-- no verb reaching it. This is the belt to RLS's braces: an RLS mistake on a
-- finance table must not be able to become data loss.
--
-- The content, watchlist and travel tables were done in 20260905160000.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename LIKE 'finance\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
