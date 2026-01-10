-- Content types enum
CREATE TYPE public.content_type AS ENUM ('inventory', 'link', 'book', 'creator', 'quote', 'inspiration');

-- Books table
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

-- Creators table (painters/artists/photos)
CREATE TABLE public.creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  category TEXT NOT NULL DEFAULT 'artist', -- 'artist', 'painter', 'photographer'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inspiration board table
CREATE TABLE public.inspirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Upvotes table for all content types
CREATE TABLE public.upvotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type content_type NOT NULL,
  content_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL, -- anonymous visitor identifier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_type, content_id, visitor_id)
);

-- Enable RLS on all tables
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

-- RLS policies for books (public read, admin write)
CREATE POLICY "Anyone can view books" ON public.books FOR SELECT USING (true);

-- RLS policies for creators (public read)
CREATE POLICY "Anyone can view creators" ON public.creators FOR SELECT USING (true);

-- RLS policies for quotes (public read)
CREATE POLICY "Anyone can view quotes" ON public.quotes FOR SELECT USING (true);

-- RLS policies for inspirations (public read)
CREATE POLICY "Anyone can view inspirations" ON public.inspirations FOR SELECT USING (true);

-- RLS policies for upvotes (public read/write for anonymous voting)
CREATE POLICY "Anyone can view upvotes" ON public.upvotes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert upvotes" ON public.upvotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete their own upvotes" ON public.upvotes FOR DELETE USING (true);