-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TV Shows',
  status TEXT,
  notes TEXT,
  image_url TEXT,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to watchlist"
  ON watchlist FOR SELECT
  USING (true);

-- Create policies for public write access
CREATE POLICY "Allow public insert access to watchlist"
  ON watchlist FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to watchlist"
  ON watchlist FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to watchlist"
  ON watchlist FOR DELETE
  USING (true);

-- Add watchlist to content_type enum
DO $$ BEGIN
  ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'watchlist';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
