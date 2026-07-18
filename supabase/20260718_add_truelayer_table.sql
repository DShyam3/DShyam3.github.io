-- Create TrueLayer connection credentials table
CREATE TABLE IF NOT EXISTS public.finance_truelayer_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_truelayer_connection ENABLE ROW LEVEL SECURITY;

-- Admin access policy
DROP POLICY IF EXISTS "Admin All Access" ON public.finance_truelayer_connection;
CREATE POLICY "Admin All Access" ON public.finance_truelayer_connection 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Grant privileges
GRANT ALL ON public.finance_truelayer_connection TO authenticated;
GRANT ALL ON public.finance_truelayer_connection TO service_role;
