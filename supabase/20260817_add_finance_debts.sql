-- Debt / liability accounts (mortgages, student loans, auto loans, personal loans)
CREATE TABLE IF NOT EXISTS public.finance_debts (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  lender TEXT,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  min_payment NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  payoff_date DATE,
  repayment_type TEXT NOT NULL DEFAULT 'amortising',
  student_loan_plan TEXT,
  write_off_years INTEGER,
  -- Individual borrowing tranches: [{ id, date, amount, label }]
  draws JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  emoji TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Match the admin-only policy applied to the other finance tables
ALTER TABLE public.finance_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Access" ON public.finance_debts;
DROP POLICY IF EXISTS "Admin Write Access" ON public.finance_debts;
DROP POLICY IF EXISTS "Admin Only" ON public.finance_debts;

CREATE POLICY "Admin Only" ON public.finance_debts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.finance_debts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_debts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_debts TO service_role;
