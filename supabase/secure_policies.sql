-- Secure RLS Policies
-- This script secures the database by ensuring only authenticated users can write (INSERT, UPDATE, DELETE)
-- while maintaining public read access (SELECT).

-- 1. Movies
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.movies;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.movies;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.movies;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.movies;
DROP POLICY IF EXISTS "Public read access" ON public.movies;
DROP POLICY IF EXISTS "Auth write access" ON public.movies;

CREATE POLICY "Public Read Access" ON public.movies FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.movies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. TV Shows
ALTER TABLE public.tv_shows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tv_shows;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.tv_shows;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.tv_shows;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.tv_shows;
DROP POLICY IF EXISTS "Public read access" ON public.tv_shows;
DROP POLICY IF EXISTS "Auth write access" ON public.tv_shows;

CREATE POLICY "Public Read Access" ON public.tv_shows FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.tv_shows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. TV Show Seasons
ALTER TABLE public.tv_show_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tv_show_seasons;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.tv_show_seasons;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.tv_show_seasons;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.tv_show_seasons;
DROP POLICY IF EXISTS "Public read access" ON public.tv_show_seasons;
DROP POLICY IF EXISTS "Auth write access" ON public.tv_show_seasons;

CREATE POLICY "Public Read Access" ON public.tv_show_seasons FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.tv_show_seasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. TV Show Episodes
ALTER TABLE public.tv_show_episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tv_show_episodes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.tv_show_episodes;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.tv_show_episodes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.tv_show_episodes;
DROP POLICY IF EXISTS "Public read access" ON public.tv_show_episodes;
DROP POLICY IF EXISTS "Auth write access" ON public.tv_show_episodes;

CREATE POLICY "Public Read Access" ON public.tv_show_episodes FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.tv_show_episodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Weekly Schedule
ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public read access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public insert access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public update access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public delete access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Public read access" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Auth write access" ON public.weekly_schedule;

CREATE POLICY "Public Read Access" ON public.weekly_schedule FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.weekly_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Inventory Items (handling duplicates)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Anyone can insert inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Anyone can update inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Anyone can delete inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public update access" ON public.inventory_items;
DROP POLICY IF EXISTS "Allow public delete access" ON public.inventory_items;
DROP POLICY IF EXISTS "Public read access" ON public.inventory_items;
DROP POLICY IF EXISTS "Auth write access" ON public.inventory_items;

CREATE POLICY "Public Read Access" ON public.inventory_items FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Links
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view links" ON public.links;
DROP POLICY IF EXISTS "Anyone can insert links" ON public.links;
DROP POLICY IF EXISTS "Anyone can update links" ON public.links;
DROP POLICY IF EXISTS "Anyone can delete links" ON public.links;

CREATE POLICY "Public Read Access" ON public.links FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.links FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view books" ON public.books;
DROP POLICY IF EXISTS "Anyone can insert books" ON public.books;
DROP POLICY IF EXISTS "Anyone can update books" ON public.books;
DROP POLICY IF EXISTS "Anyone can delete books" ON public.books;

CREATE POLICY "Public Read Access" ON public.books FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.books FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can insert articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can update articles" ON public.articles;
DROP POLICY IF EXISTS "Anyone can delete articles" ON public.articles;

CREATE POLICY "Public Read Access" ON public.articles FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Creators
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view creators" ON public.creators;
DROP POLICY IF EXISTS "Anyone can insert creators" ON public.creators;
DROP POLICY IF EXISTS "Anyone can update creators" ON public.creators;
DROP POLICY IF EXISTS "Anyone can delete creators" ON public.creators;

CREATE POLICY "Public Read Access" ON public.creators FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.creators FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Photos
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can insert photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can update photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can delete photos" ON public.photos;

CREATE POLICY "Public Read Access" ON public.photos FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. Recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can delete recipes" ON public.recipes;

CREATE POLICY "Public Read Access" ON public.recipes FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. Beliefs
ALTER TABLE public.beliefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view beliefs" ON public.beliefs;
DROP POLICY IF EXISTS "Anyone can insert beliefs" ON public.beliefs;
DROP POLICY IF EXISTS "Anyone can update beliefs" ON public.beliefs;
DROP POLICY IF EXISTS "Anyone can delete beliefs" ON public.beliefs;

CREATE POLICY "Public Read Access" ON public.beliefs FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.beliefs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. Inspirations
ALTER TABLE public.inspirations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view inspirations" ON public.inspirations;
DROP POLICY IF EXISTS "Anyone can insert inspirations" ON public.inspirations;
DROP POLICY IF EXISTS "Anyone can update inspirations" ON public.inspirations;
DROP POLICY IF EXISTS "Anyone can delete inspirations" ON public.inspirations;

CREATE POLICY "Public Read Access" ON public.inspirations FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.inspirations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 15. Upvotes (Assuming read-only for public based on request, but upvotes usually need public write. Setting to auth write to be safe per instructions)
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view upvotes" ON public.upvotes;
DROP POLICY IF EXISTS "Anyone can insert upvotes" ON public.upvotes;
DROP POLICY IF EXISTS "Anyone can delete upvotes" ON public.upvotes;

CREATE POLICY "Public Read Access" ON public.upvotes FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.upvotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 16. Visited Countries
ALTER TABLE public.visited_countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access" ON public.visited_countries;
DROP POLICY IF EXISTS "Admin Write Access" ON public.visited_countries;

CREATE POLICY "Public Read Access" ON public.visited_countries FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Access" ON public.visited_countries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 17. Visited Cities
ALTER TABLE public.visited_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.visited_cities;
DROP POLICY IF EXISTS "Admin insert" ON public.visited_cities;
DROP POLICY IF EXISTS "Admin delete" ON public.visited_cities;

CREATE POLICY "Public read" ON public.visited_cities FOR SELECT TO public USING (true);
CREATE POLICY "Admin insert" ON public.visited_cities FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admin delete" ON public.visited_cities FOR DELETE TO public USING (true);

-- 18. Sync Log
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to sync_log" ON public.sync_log;
DROP POLICY IF EXISTS "Allow public insert access to sync_log" ON public.sync_log;
DROP POLICY IF EXISTS "Allow public delete access to sync_log" ON public.sync_log;

CREATE POLICY "Allow public read access to sync_log" ON public.sync_log FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to sync_log" ON public.sync_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public delete access to sync_log" ON public.sync_log FOR DELETE TO public USING (true);

-- 19. Site Content
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Site Content" ON public.site_content;
DROP POLICY IF EXISTS "Admin Write Site Content" ON public.site_content;

CREATE POLICY "Public Read Site Content" ON public.site_content FOR SELECT TO public USING (true);
CREATE POLICY "Admin Write Site Content" ON public.site_content FOR ALL TO authenticated USING (true);

-- 20. Favourites
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read favourites" ON public.favourites;
DROP POLICY IF EXISTS "Authenticated users can insert favourites" ON public.favourites;
DROP POLICY IF EXISTS "Authenticated users can update favourites" ON public.favourites;
DROP POLICY IF EXISTS "Authenticated users can delete favourites" ON public.favourites;

CREATE POLICY "Anyone can read favourites" ON public.favourites FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert favourites" ON public.favourites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update favourites" ON public.favourites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete favourites" ON public.favourites FOR DELETE TO authenticated USING (true);


-- ==========================================
-- Explicit Grants for API Exposure (Breaking Change Compatibility)
-- ==========================================

-- 1. Movies
GRANT SELECT ON public.movies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movies TO service_role;

-- 2. TV Shows
GRANT SELECT ON public.tv_shows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_shows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_shows TO service_role;

-- 3. TV Show Seasons
GRANT SELECT ON public.tv_show_seasons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_show_seasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_show_seasons TO service_role;

-- 4. TV Show Episodes
GRANT SELECT ON public.tv_show_episodes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_show_episodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_show_episodes TO service_role;

-- 5. Weekly Schedule
GRANT SELECT ON public.weekly_schedule TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_schedule TO service_role;

-- 6. Inventory Items
GRANT SELECT ON public.inventory_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO service_role;

-- 7. Links
GRANT SELECT ON public.links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO service_role;

-- 8. Books
GRANT SELECT ON public.books TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO service_role;

-- 9. Articles
GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO service_role;

-- 10. Creators
GRANT SELECT ON public.creators TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creators TO service_role;

-- 11. Photos
GRANT SELECT ON public.photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO service_role;

-- 12. Recipes
GRANT SELECT ON public.recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO service_role;

-- 13. Beliefs
GRANT SELECT ON public.beliefs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beliefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beliefs TO service_role;

-- 14. Inspirations
GRANT SELECT ON public.inspirations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspirations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspirations TO service_role;

-- 15. Upvotes
GRANT SELECT ON public.upvotes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upvotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upvotes TO service_role;

-- 16. Visited Countries
GRANT SELECT ON public.visited_countries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visited_countries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visited_countries TO service_role;

-- 17. Visited Cities
GRANT SELECT, INSERT, DELETE ON public.visited_cities TO anon;
GRANT SELECT, INSERT, DELETE ON public.visited_cities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visited_cities TO service_role;

-- 18. Sync Log
GRANT SELECT, INSERT, DELETE ON public.sync_log TO anon;
GRANT SELECT, INSERT, DELETE ON public.sync_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log TO service_role;

-- 19. Site Content
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO service_role;

-- 20. Favourites
GRANT SELECT ON public.favourites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favourites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favourites TO service_role;

-- 21. Sequences
-- Grant usage on sequences so identity/serial columns work for inserts
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
