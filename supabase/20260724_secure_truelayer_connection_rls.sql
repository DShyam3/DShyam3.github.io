-- finance_truelayer_connection stores the live TrueLayer (open banking)
-- access/refresh tokens. The previous "Admin All Access" policy only
-- checked `TO authenticated`, so any self-registered Supabase Auth user
-- could read the raw bank bearer token. Only the admin (client-side) and
-- the truelayer-sync edge function (service_role, bypasses RLS) need access.
DROP POLICY IF EXISTS "Admin All Access" ON public.finance_truelayer_connection;
CREATE POLICY "Admin All Access" ON public.finance_truelayer_connection
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
