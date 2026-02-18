-- Create visited_countries table
CREATE TABLE IF NOT EXISTS public.visited_countries (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 code (e.g., 'GB', 'US', 'JP')
  country_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visited_countries ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public Read Access" ON public.visited_countries FOR SELECT TO public USING (true);

-- Admin write access
CREATE POLICY "Admin Write Access" ON public.visited_countries FOR ALL TO authenticated USING (true) WITH CHECK (true);
