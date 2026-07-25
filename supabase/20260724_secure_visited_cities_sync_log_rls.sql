-- visited_cities and sync_log had INSERT/DELETE policies scoped `TO public`
-- (i.e. including fully anonymous, unauthenticated requests) despite being
-- named "Admin insert"/"Admin delete" -- anyone with just the public anon
-- key could write garbage rows or wipe these tables with no login at all.
-- Public read access is intentional (Travel page shows visited cities to
-- visitors) and is left untouched.
DROP POLICY IF EXISTS "Admin insert" ON public.visited_cities;
DROP POLICY IF EXISTS "Admin delete" ON public.visited_cities;

CREATE POLICY "Admin insert" ON public.visited_cities FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete" ON public.visited_cities FOR DELETE TO authenticated USING (public.is_admin());

REVOKE INSERT, DELETE ON public.visited_cities FROM anon;

DROP POLICY IF EXISTS "Allow public insert access to sync_log" ON public.sync_log;
DROP POLICY IF EXISTS "Allow public delete access to sync_log" ON public.sync_log;

CREATE POLICY "Admin insert sync_log" ON public.sync_log FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete sync_log" ON public.sync_log FOR DELETE TO authenticated USING (public.is_admin());

REVOKE INSERT, DELETE ON public.sync_log FROM anon;
