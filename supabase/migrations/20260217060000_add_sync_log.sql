-- Create sync_log table to track auto-sync and manual sync history
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_type TEXT NOT NULL DEFAULT 'manual', -- 'auto' or 'manual'
  status TEXT NOT NULL DEFAULT 'success',   -- 'success' or 'error'
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to sync_log"
  ON sync_log FOR SELECT
  USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert access to sync_log"
  ON sync_log FOR INSERT
  WITH CHECK (true);

-- Allow public delete access (for cleanup of old logs)
CREATE POLICY "Allow public delete access to sync_log"
  ON sync_log FOR DELETE
  USING (true);
