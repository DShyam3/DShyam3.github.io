-- S-10 (partial): `anon` holds table-level write privileges it never needs.
--
-- Supabase's defaults grant ALL on every table in `public` to `anon`, so the
-- anonymous role -- the one the publishable key in the client bundle carries --
-- holds DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE and UPDATE on every
-- content table, on top of the SELECT the public site actually uses.
--
-- RLS gates INSERT/UPDATE/DELETE to is_admin(), so an anonymous write matches
-- zero rows today. TRUNCATE is the reason this still matters: Postgres does
-- NOT apply row-level security to TRUNCATE, so that grant's only barrier is
-- that PostgREST exposes no verb reaching it. Revoking it means an RLS mistake
-- on one of these tables cannot become data loss.
--
-- SELECT is granted straight back, because reading these is the entire point
-- of a public portfolio -- except sync_log, whose RLS was restricted to
-- is_admin() in 20260904111858 and which anon has no reason to read.
--
-- Scope: content, watchlist and travel tables. The finance_* tables have the
-- same latent grants and are deliberately left for the finance work.
--
-- Supabase's ALTER DEFAULT PRIVILEGES is untouched, so a table created after
-- this migration starts with the permissive grants again.

DO $$
DECLARE
  readable_table text;
BEGIN
  FOREACH readable_table IN ARRAY ARRAY[
    'articles',
    'beliefs',
    'books',
    'favourites',
    'inspirations',
    'inventory_items',
    'links',
    'movies',
    'photos',
    'recipes',
    'site_content',
    'thoughts',
    'tv_show_episodes',
    'tv_show_seasons',
    'tv_shows',
    'visited_cities',
    'visited_countries',
    'weekly_schedule'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', readable_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', readable_table);
  END LOOP;
END
$$;

-- Admin-only reads: no SELECT back.
REVOKE ALL ON TABLE public.sync_log FROM anon;
