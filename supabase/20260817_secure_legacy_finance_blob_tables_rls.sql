-- `finance_data` and `finance_defaults` are the pre-relational blob store that
-- predates the `finance_*` relational schema. No application code reads them
-- any more (they survive only in the generated Supabase types), but they were
-- still populated with real data -- including a `settings` row holding gross
-- salary -- behind a `Public Read` policy granted to `anon`.
--
-- The 20260724_secure_finance_tables_rls.sql table list never covered them, so
-- they stayed publicly readable after that migration closed every other hole.
-- Same treatment here: admin-only, anon SELECT revoked. Data is left in place;
-- dropping the tables is a separate decision.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['finance_data', 'finance_defaults'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    CONTINUE WHEN to_regclass('public.' || quote_ident(t)) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read access to finance_defaults" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow admin write access to finance_defaults" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admin Only" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- Dangling grant left over from the original schema: RLS already denied anon
-- (the only policy is admin-gated), but the grant itself served no purpose.
REVOKE SELECT ON public.finance_truelayer_connection FROM anon;
