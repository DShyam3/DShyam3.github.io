-- Drop the table I mistakenly created earlier
DROP TABLE IF EXISTS public.watchlist_schedule;

-- Add movie_id to the existing weekly_schedule table
ALTER TABLE public.weekly_schedule 
ADD COLUMN IF NOT EXISTS movie_id BIGINT REFERENCES public.movies(id) ON DELETE CASCADE;

-- Ensure RLS is enabled
ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Allow public read access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public insert access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public update access to weekly_schedule" ON public.weekly_schedule;
DROP POLICY IF EXISTS "Allow public delete access to weekly_schedule" ON public.weekly_schedule;

-- Create comprehensive policies
CREATE POLICY "Allow public read access to weekly_schedule"
  ON public.weekly_schedule FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to weekly_schedule"
  ON public.weekly_schedule FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to weekly_schedule"
  ON public.weekly_schedule FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to weekly_schedule"
  ON public.weekly_schedule FOR DELETE
  USING (true);
