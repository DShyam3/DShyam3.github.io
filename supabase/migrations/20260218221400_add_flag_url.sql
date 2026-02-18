-- Add flag_url column to visited_countries table
ALTER TABLE public.visited_countries
  ADD COLUMN IF NOT EXISTS flag_url TEXT;

-- Backfill existing rows using flagcdn.com
UPDATE public.visited_countries
  SET flag_url = 'https://flagcdn.com/w80/' || lower(country_code) || '.png'
  WHERE flag_url IS NULL;
