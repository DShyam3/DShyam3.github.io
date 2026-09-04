-- The content tables each carried two permissive policies:
--
--   "Public Read Access"  SELECT  TO public         USING (true)
--   "Admin Write Access"  ALL     TO authenticated  USING (is_admin())
--
-- FOR ALL includes SELECT, and the `public` role includes `authenticated`, so
-- every read by a signed-in user evaluated both policies. That is the Supabase
-- linter's multiple_permissive_policies warning.
--
-- Splitting the ALL policy into explicit INSERT/UPDATE/DELETE policies removes
-- the SELECT overlap. Admin write behaviour is unchanged: is_admin() still
-- gates every write, and anonymous read still comes from "Public Read Access".

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'articles', 'beliefs', 'books', 'creators', 'inspirations',
    'inventory_items', 'links', 'movies', 'photos', 'recipes',
    'site_content', 'tv_show_episodes', 'tv_show_seasons', 'tv_shows',
    'visited_countries', 'weekly_schedule'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admin Write Access', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
      'Admin insert', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      'Admin update', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
      'Admin delete', t);
  END LOOP;
END $$;
