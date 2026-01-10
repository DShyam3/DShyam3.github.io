-- ============================================
-- COMPLETE DATABASE SCHEMA FOR MY CHERISHED THINGS
-- ============================================

-- Content types enum
CREATE TYPE public.content_type AS ENUM (
  'inventory', 
  'link', 
  'book', 
  'article',
  'creator', 
  'photo',
  'recipe',
  'belief',
  'inspiration'
);

-- ============================================
-- INVENTORY ITEMS TABLE
-- ============================================
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'tech-edc', -- 'tech-edc', 'wardrobe', 'kitchen', 'wishlist'
  price NUMERIC,
  image TEXT,
  is_new BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- LINKS TABLE
-- ============================================
CREATE TABLE public.links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'productivity', -- 'design', 'productivity', 'development', 'entertainment'
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- BOOKS TABLE
-- ============================================
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  description TEXT,
  link TEXT,
  category TEXT NOT NULL DEFAULT 'favourite', -- 'favourite' or 'future'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- ARTICLES TABLE
-- ============================================
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  link TEXT,
  image_url TEXT,
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'articles',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- CREATORS TABLE (painters/artists/photos)
-- ============================================
CREATE TABLE public.creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  category TEXT NOT NULL DEFAULT 'artist', -- 'artist', 'painter', 'photographer'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- RECIPES TABLE
-- ============================================
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  is_personal BOOLEAN NOT NULL DEFAULT true,
  ingredients TEXT,
  instructions TEXT,
  category TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- BELIEFS TABLE (formerly quotes)
-- ============================================
CREATE TABLE public.beliefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- INSPIRATION BOARD TABLE
-- ============================================
CREATE TABLE public.inspirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'creators',
  why_i_like TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- UPVOTES TABLE (for all content types)
-- ============================================
CREATE TABLE public.upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type content_type NOT NULL,
  content_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL, -- anonymous visitor identifier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_type, content_id, visitor_id)
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - PUBLIC READ/WRITE FOR ALL TABLES
-- ============================================

-- Inventory Items Policies
CREATE POLICY "Anyone can view inventory items" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inventory items" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inventory items" ON public.inventory_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inventory items" ON public.inventory_items FOR DELETE USING (true);

-- Links Policies
CREATE POLICY "Anyone can view links" ON public.links FOR SELECT USING (true);
CREATE POLICY "Anyone can insert links" ON public.links FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update links" ON public.links FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete links" ON public.links FOR DELETE USING (true);

-- Books Policies
CREATE POLICY "Anyone can view books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Anyone can insert books" ON public.books FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update books" ON public.books FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete books" ON public.books FOR DELETE USING (true);

-- Articles Policies
CREATE POLICY "Anyone can view articles" ON public.articles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert articles" ON public.articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update articles" ON public.articles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete articles" ON public.articles FOR DELETE USING (true);

-- Creators Policies
CREATE POLICY "Anyone can view creators" ON public.creators FOR SELECT USING (true);
CREATE POLICY "Anyone can insert creators" ON public.creators FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update creators" ON public.creators FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete creators" ON public.creators FOR DELETE USING (true);

-- Photos Policies
CREATE POLICY "Anyone can view photos" ON public.photos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert photos" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update photos" ON public.photos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete photos" ON public.photos FOR DELETE USING (true);

-- Recipes Policies
CREATE POLICY "Anyone can view recipes" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert recipes" ON public.recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update recipes" ON public.recipes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete recipes" ON public.recipes FOR DELETE USING (true);

-- Beliefs Policies
CREATE POLICY "Anyone can view beliefs" ON public.beliefs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert beliefs" ON public.beliefs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update beliefs" ON public.beliefs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete beliefs" ON public.beliefs FOR DELETE USING (true);

-- Inspirations Policies
CREATE POLICY "Anyone can view inspirations" ON public.inspirations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert inspirations" ON public.inspirations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inspirations" ON public.inspirations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete inspirations" ON public.inspirations FOR DELETE USING (true);

-- Upvotes Policies
CREATE POLICY "Anyone can view upvotes" ON public.upvotes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert upvotes" ON public.upvotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete upvotes" ON public.upvotes FOR DELETE USING (true);

-- ============================================
-- SEED DATA - INVENTORY ITEMS
-- ============================================
INSERT INTO public.inventory_items (name, brand, category, price, image, is_new, created_at) VALUES
  ('MacBook Pro 16"', 'Apple', 'tech-edc', 2499, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop', true, '2024-12-20'),
  ('Wool Overcoat', 'COS', 'wardrobe', 350, 'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=600&h=600&fit=crop', true, '2024-12-18'),
  ('Cast Iron Skillet', 'Le Creuset', 'kitchen', 185, 'https://images.unsplash.com/photo-1585442774949-81fb0e1c4e2a?w=600&h=600&fit=crop', false, '2024-11-15'),
  ('Sony WH-1000XM5', 'Sony', 'tech-edc', 399, 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&h=600&fit=crop', false, '2024-10-01'),
  ('Ceramic Pour Over', 'Chemex', 'kitchen', 47, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop', false, '2024-09-20'),
  ('Merino Sweater', 'Everlane', 'wardrobe', 120, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=600&fit=crop', false, '2024-08-15'),
  ('Mechanical Keyboard', 'Keychron', 'tech-edc', 199, 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600&h=600&fit=crop', true, '2024-12-28'),
  ('Chef''s Knife', 'Wüsthof', 'kitchen', 180, 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&h=600&fit=crop', false, '2024-07-10'),
  ('Leather Boots', 'Common Projects', 'wishlist', 650, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop', false, '2024-12-01'),
  ('Studio Display', 'Apple', 'wishlist', 1599, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&h=600&fit=crop', false, '2024-11-25');

-- ============================================
-- SEED DATA - LINKS
-- ============================================
INSERT INTO public.links (name, url, description, category, icon, created_at) VALUES
  ('Figma', 'https://figma.com', 'Collaborative design tool for teams. My go-to for UI/UX work.', 'design', 'https://cdn.sanity.io/images/599r6htc/localized/46a76c802176eb17b04e12108de7e7e0f3736dc6-1024x1024.png?w=64&h=64&q=75&fit=max&auto=format', '2024-01-15'),
  ('Notion', 'https://notion.so', 'All-in-one workspace for notes, docs, and project management.', 'productivity', 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png', '2024-01-10'),
  ('GitHub', 'https://github.com', 'Where all my code lives. Essential for version control.', 'development', 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png', '2024-01-08'),
  ('Linear', 'https://linear.app', 'Beautiful issue tracking. Makes project management actually enjoyable.', 'productivity', 'https://asset.brandfetch.io/iduDa181eM/idYYbqOlKi.png', '2024-01-05'),
  ('Spotify', 'https://spotify.com', 'Music for focus, coding sessions, and everything in between.', 'entertainment', 'https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png', '2024-01-03'),
  ('VS Code', 'https://code.visualstudio.com', 'The code editor I use daily. Fast, extensible, and free.', 'development', 'https://code.visualstudio.com/assets/images/code-stable.png', '2024-01-01');
