-- Content tables (movies, books, links, etc.) are meant to be publicly
-- readable -- this is a portfolio/digital-garden site and visitors should
-- see this content without logging in. That part of the previous policy
-- was correct and is left untouched.
--
-- The bug was on the write side: "Admin Write Access" checked `TO
-- authenticated` only, so any visitor who called supabase.auth.signUp()
-- directly (bypassing the UI, which has no signup form) became
-- `authenticated` and could insert/update/delete every row in every one of
-- these tables. This migration keeps public read access and restricts
-- writes to the actual admin account.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'movies', 'tv_shows', 'tv_show_seasons', 'tv_show_episodes', 'weekly_schedule',
    'inventory_items', 'links', 'books', 'articles', 'creators', 'photos',
    'recipes', 'beliefs', 'inspirations', 'visited_countries', 'site_content'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip tables that don't exist rather than aborting the whole block: this
    -- list has drifted from the schema before (`upvotes` was listed here for
    -- months but never created, which made the entire migration roll back).
    CONTINUE WHEN to_regclass('public.' || quote_ident(t)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "Admin Write Access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Write Site Content" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admin Write Access" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- Favourites: this is the admin's personal "favourited shows/movies" list
-- (surfaced only behind admin-gated UI in WatchlistContext/WatchlistCard),
-- not a public "like" feature -- so it gets the same admin-only write
-- treatment rather than allowing any authenticated user to write.
DROP POLICY IF EXISTS "Authenticated users can insert favourites" ON public.favourites;
DROP POLICY IF EXISTS "Authenticated users can update favourites" ON public.favourites;
DROP POLICY IF EXISTS "Authenticated users can delete favourites" ON public.favourites;

CREATE POLICY "Admin insert favourites" ON public.favourites FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin update favourites" ON public.favourites FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete favourites" ON public.favourites FOR DELETE TO authenticated USING (public.is_admin());
