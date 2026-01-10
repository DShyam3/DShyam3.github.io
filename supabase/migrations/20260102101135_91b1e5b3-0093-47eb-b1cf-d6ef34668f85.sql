-- Add category and why_i_like to inspirations table
ALTER TABLE public.inspirations 
ADD COLUMN category text NOT NULL DEFAULT 'creators',
ADD COLUMN why_i_like text;

-- Create photos table
CREATE TABLE public.photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text NOT NULL,
  caption text,
  location text
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos" ON public.photos
  FOR SELECT USING (true);

-- Create articles table
CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL,
  author text,
  link text,
  image_url text,
  notes text,
  category text NOT NULL DEFAULT 'articles'
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view articles" ON public.articles
  FOR SELECT USING (true);

-- Create recipes table
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  image_url text,
  link text,
  is_personal boolean NOT NULL DEFAULT true,
  ingredients text,
  instructions text,
  category text NOT NULL DEFAULT 'main'
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recipes" ON public.recipes
  FOR SELECT USING (true);

-- Rename quotes table to beliefs
ALTER TABLE public.quotes RENAME TO beliefs;

-- Update the content_type enum to include new types and rename quote to belief
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'photo';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'article';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'recipe';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'belief';