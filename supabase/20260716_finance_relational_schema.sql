-- 1. Create Relational Tables

CREATE TABLE IF NOT EXISTS public.finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_default BOOLEAN NOT NULL DEFAULT false,
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  pension_type TEXT NOT NULL DEFAULT 'net_pay',
  personal_pension_percent NUMERIC NOT NULL DEFAULT 0,
  employer_pension_percent NUMERIC NOT NULL DEFAULT 0,
  student_loan_plan TEXT NOT NULL DEFAULT 'none',
  tax_code TEXT NOT NULL DEFAULT '1257L',
  personal_allowance NUMERIC NOT NULL DEFAULT 12570,
  weekends INTEGER NOT NULL DEFAULT 104,
  bank_holidays INTEGER NOT NULL DEFAULT 8,
  work_holidays INTEGER NOT NULL DEFAULT 25,
  working_hours_per_day NUMERIC NOT NULL DEFAULT 7.5,
  tax_year INTEGER NOT NULL DEFAULT 2026,
  uk_region TEXT NOT NULL DEFAULT 'england-and-wales',
  pay_day_of_month INTEGER DEFAULT 25,
  payday_schedule TEXT DEFAULT 'monthly_date',
  payday_weekday INTEGER DEFAULT 5,
  payday_biweekly_anchor TEXT DEFAULT '2026-01-02',
  active_savings_types TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_user_holidays (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  occasion TEXT,
  count NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_goals (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  target_date DATE,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_goal_contributions (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  goal_id TEXT NOT NULL REFERENCES public.finance_goals(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  note TEXT,
  bank_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_bank_accounts (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  issuer TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  annual_fee NUMERIC NOT NULL DEFAULT 0,
  use_case TEXT,
  emoji TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_memberships (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT,
  annual_fee NUMERIC NOT NULL DEFAULT 0,
  use_case TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_credit_scores (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  bureau TEXT NOT NULL,
  date DATE NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_budget_categories (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  budgeted NUMERIC NOT NULL DEFAULT 0,
  group_type TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_budget_items (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  category_id TEXT NOT NULL REFERENCES public.finance_budget_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  budgeted NUMERIC NOT NULL DEFAULT 0,
  spent NUMERIC NOT NULL DEFAULT 0,
  linked_account_id TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_recurring_bills (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date INTEGER NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  due_month INTEGER,
  emoji TEXT,
  category TEXT,
  tag TEXT,
  linked_budget_item_id TEXT,
  linked_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id TEXT PRIMARY KEY,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_tax_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  is_default BOOLEAN NOT NULL DEFAULT false,
  student_loan_thresholds JSONB NOT NULL,
  student_loan_rates JSONB NOT NULL,
  income_tax_bands JSONB NOT NULL,
  national_insurance_bands JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_recurring_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  is_default BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT,
  tag TEXT,
  default_amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  linked_budget_item_id TEXT,
  budget_category_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_credit_bureaus (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  is_default BOOLEAN NOT NULL DEFAULT false,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  max_score INTEGER NOT NULL,
  gradient TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_holiday_defaults (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  is_default BOOLEAN NOT NULL DEFAULT false,
  month_index INTEGER NOT NULL,
  count NUMERIC NOT NULL DEFAULT 0,
  dates TEXT,
  occasion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_budget_presets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  is_default BOOLEAN NOT NULL DEFAULT false,
  preset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  group_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Configure Row Level Security (RLS) & Policies on New Tables

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'finance_settings', 'finance_user_holidays', 'finance_goals', 'finance_goal_contributions',
    'finance_bank_accounts', 'finance_memberships', 'finance_credit_scores',
    'finance_budget_categories', 'finance_budget_items', 'finance_recurring_bills',
    'finance_transactions', 'finance_tax_configs', 'finance_recurring_templates',
    'finance_credit_bureaus', 'finance_holiday_defaults', 'finance_budget_presets'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Write Access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public Read Access" ON public.%I FOR SELECT TO public USING (true)', t);
    EXECUTE format('CREATE POLICY "Admin Write Access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- 3. Parse and Populate Relational Tables from Existing JSON Key-Values

-- finance_settings (defaults & data)
INSERT INTO public.finance_settings (
  is_default, gross_salary, pension_type, personal_pension_percent, employer_pension_percent,
  student_loan_plan, tax_code, personal_allowance, weekends, bank_holidays, work_holidays,
  working_hours_per_day, tax_year, uk_region, pay_day_of_month, payday_schedule, payday_weekday,
  payday_biweekly_anchor, active_savings_types
)
SELECT 
  false as is_default,
  (content::jsonb->>'grossSalary')::numeric,
  content::jsonb->>'pensionType',
  (content::jsonb->>'personalPensionPercent')::numeric,
  (content::jsonb->>'employerPensionPercent')::numeric,
  content::jsonb->>'studentLoanPlan',
  content::jsonb->>'taxCode',
  (content::jsonb->>'personalAllowance')::numeric,
  (content::jsonb->>'weekends')::integer,
  (content::jsonb->>'bankHolidays')::integer,
  (content::jsonb->>'workHolidays')::integer,
  (content::jsonb->>'workingHoursPerDay')::numeric,
  (content::jsonb->>'taxYear')::integer,
  content::jsonb->>'ukRegion',
  (content::jsonb->>'payDayOfMonth')::integer,
  content::jsonb->>'paydaySchedule',
  (content::jsonb->>'paydayWeekday')::integer,
  content::jsonb->>'paydayBiweeklyAnchor',
  (SELECT array_agg(x::text) FROM jsonb_array_elements_text(content::jsonb->'activeSavingsTypes') x)
FROM public.finance_data
WHERE key = 'settings' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_settings (
  is_default, gross_salary, pension_type, personal_pension_percent, employer_pension_percent,
  student_loan_plan, tax_code, personal_allowance, weekends, bank_holidays, work_holidays,
  working_hours_per_day, tax_year, uk_region, pay_day_of_month, payday_schedule, payday_weekday,
  payday_biweekly_anchor, active_savings_types
)
SELECT 
  true as is_default,
  (content::jsonb->>'grossSalary')::numeric,
  content::jsonb->>'pensionType',
  (content::jsonb->>'personalPensionPercent')::numeric,
  (content::jsonb->>'employerPensionPercent')::numeric,
  content::jsonb->>'studentLoanPlan',
  content::jsonb->>'taxCode',
  (content::jsonb->>'personalAllowance')::numeric,
  (content::jsonb->>'weekends')::integer,
  (content::jsonb->>'bankHolidays')::integer,
  (content::jsonb->>'workHolidays')::integer,
  (content::jsonb->>'workingHoursPerDay')::numeric,
  (content::jsonb->>'taxYear')::integer,
  content::jsonb->>'ukRegion',
  (content::jsonb->>'payDayOfMonth')::integer,
  content::jsonb->>'paydaySchedule',
  (content::jsonb->>'paydayWeekday')::integer,
  content::jsonb->>'paydayBiweeklyAnchor',
  (SELECT array_agg(x::text) FROM jsonb_array_elements_text(content::jsonb->'activeSavingsTypes') x)
FROM public.finance_defaults
WHERE key = 'settings' ON CONFLICT DO NOTHING;

-- holidaysByUser
INSERT INTO public.finance_user_holidays (is_default, id, start_date, end_date, occasion, count)
SELECT 
  false as is_default,
  x->>'id',
  (x->>'startDate')::date,
  (x->>'endDate')::date,
  x->>'occasion',
  (x->>'count')::numeric
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'holidaysByUser') x
WHERE d.key = 'settings' ON CONFLICT DO NOTHING;

-- goals
INSERT INTO public.finance_goals (is_default, id, name, target_amount, current_amount, target_date, start_date)
SELECT
  false as is_default,
  x->>'id',
  x->>'name',
  (x->>'targetAmount')::numeric,
  (x->>'currentAmount')::numeric,
  (x->>'targetDate')::date,
  (x->>'startDate')::date
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'goals' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_goals (is_default, id, name, target_amount, current_amount, target_date, start_date)
SELECT
  true as is_default,
  x->>'id',
  x->>'name',
  (x->>'targetAmount')::numeric,
  (x->>'currentAmount')::numeric,
  (x->>'targetDate')::date,
  (x->>'startDate')::date
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'goals' ON CONFLICT DO NOTHING;

-- contributions
INSERT INTO public.finance_goal_contributions (is_default, id, goal_id, amount, date, note, bank_account_id)
SELECT
  false as is_default,
  c->>'id',
  x->>'id' as goal_id,
  (c->>'amount')::numeric,
  (c->>'date')::date,
  c->>'note',
  c->>'bankAccountId'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'contributions') c
WHERE d.key = 'goals' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_goal_contributions (is_default, id, goal_id, amount, date, note, bank_account_id)
SELECT
  true as is_default,
  c->>'id',
  x->>'id' as goal_id,
  (c->>'amount')::numeric,
  (c->>'date')::date,
  c->>'note',
  c->>'bankAccountId'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'contributions') c
WHERE d.key = 'goals' ON CONFLICT DO NOTHING;

-- bank accounts
INSERT INTO public.finance_bank_accounts (is_default, id, name, type, issuer, balance, annual_fee, use_case, emoji, color)
SELECT
  false as is_default,
  x->>'id',
  x->>'name',
  x->>'type',
  x->>'issuer',
  (x->>'balance')::numeric,
  (x->>'annualFee')::numeric,
  x->>'useCase',
  x->>'emoji',
  x->>'color'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'bankAccounts') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_bank_accounts (is_default, id, name, type, issuer, balance, annual_fee, use_case, emoji, color)
SELECT
  true as is_default,
  x->>'id',
  x->>'name',
  x->>'type',
  x->>'issuer',
  (x->>'balance')::numeric,
  (x->>'annualFee')::numeric,
  x->>'useCase',
  x->>'emoji',
  x->>'color'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb->'bankAccounts') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

-- memberships
INSERT INTO public.finance_memberships (is_default, id, name, type, status, annual_fee, use_case)
SELECT
  false as is_default,
  x->>'id',
  x->>'name',
  x->>'type',
  x->>'status',
  (x->>'annualFee')::numeric,
  x->>'useCase'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'memberships') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_memberships (is_default, id, name, type, status, annual_fee, use_case)
SELECT
  true as is_default,
  x->>'id',
  x->>'name',
  x->>'type',
  x->>'status',
  (x->>'annualFee')::numeric,
  x->>'useCase'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb->'memberships') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

-- credit scores
INSERT INTO public.finance_credit_scores (is_default, id, bureau, date, score)
SELECT
  false as is_default,
  x->>'id',
  'experian',
  (x->>'date')::date,
  (x->>'score')::integer
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'creditScores'->'experian') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_credit_scores (is_default, id, bureau, date, score)
SELECT
  false as is_default,
  x->>'id',
  'transunion',
  (x->>'date')::date,
  (x->>'score')::integer
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'creditScores'->'transunion') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_credit_scores (is_default, id, bureau, date, score)
SELECT
  false as is_default,
  x->>'id',
  'equifax',
  (x->>'date')::date,
  (x->>'score')::integer
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb->'creditScores'->'equifax') x
WHERE d.key = 'accounts' ON CONFLICT DO NOTHING;

-- budget categories & items
-- Active budget
INSERT INTO public.finance_budget_categories (is_default, is_template, id, name, budgeted, group_type, emoji)
SELECT
  false as is_default,
  false as is_template,
  x->>'id',
  x->>'name',
  (x->>'budgeted')::numeric,
  x->>'group',
  x->>'emoji'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'budget' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_items (is_default, is_template, id, category_id, name, budgeted, spent, linked_account_id, emoji)
SELECT
  false as is_default,
  false as is_template,
  i->>'id',
  x->>'id' as category_id,
  i->>'name',
  (i->>'budgeted')::numeric,
  (i->>'spent')::numeric,
  i->>'linkedAccountId',
  i->>'emoji'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'items') i
WHERE d.key = 'budget' ON CONFLICT DO NOTHING;

-- Default budget
INSERT INTO public.finance_budget_categories (is_default, is_template, id, name, budgeted, group_type, emoji)
SELECT
  true as is_default,
  false as is_template,
  x->>'id',
  x->>'name',
  (x->>'budgeted')::numeric,
  x->>'group',
  x->>'emoji'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'budget' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_items (is_default, is_template, id, category_id, name, budgeted, spent, linked_account_id, emoji)
SELECT
  true as is_default,
  false as is_template,
  i->>'id',
  x->>'id' as category_id,
  i->>'name',
  (i->>'budgeted')::numeric,
  (i->>'spent')::numeric,
  i->>'linkedAccountId',
  i->>'emoji'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'items') i
WHERE d.key = 'budget' ON CONFLICT DO NOTHING;

-- Template categories (default_budget_categories)
INSERT INTO public.finance_budget_categories (is_default, is_template, id, name, budgeted, group_type, emoji)
SELECT
  true as is_default,
  true as is_template,
  x->>'id',
  x->>'name',
  (x->>'budgeted')::numeric,
  x->>'group',
  x->>'emoji'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'default_budget_categories' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_items (is_default, is_template, id, category_id, name, budgeted, spent, linked_account_id, emoji)
SELECT
  true as is_default,
  true as is_template,
  i->>'id',
  x->>'id' as category_id,
  i->>'name',
  (i->>'budgeted')::numeric,
  (i->>'spent')::numeric,
  i->>'linkedAccountId',
  i->>'emoji'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'items') i
WHERE d.key = 'default_budget_categories' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_categories (is_default, is_template, id, name, budgeted, group_type, emoji)
SELECT
  false as is_default,
  true as is_template,
  x->>'id',
  x->>'name',
  (x->>'budgeted')::numeric,
  x->>'group',
  x->>'emoji'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'default_budget_categories' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_items (is_default, is_template, id, category_id, name, budgeted, spent, linked_account_id, emoji)
SELECT
  false as is_default,
  true as is_template,
  i->>'id',
  x->>'id' as category_id,
  i->>'name',
  (i->>'budgeted')::numeric,
  (i->>'spent')::numeric,
  i->>'linkedAccountId',
  i->>'emoji'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x,
LATERAL jsonb_array_elements(x->'items') i
WHERE d.key = 'default_budget_categories' ON CONFLICT DO NOTHING;

-- recurring bills
INSERT INTO public.finance_recurring_bills (is_default, id, name, amount, due_date, is_paid, frequency, due_month, emoji, category, tag, linked_budget_item_id, linked_account_id)
SELECT
  false as is_default,
  x->>'id',
  x->>'name',
  (x->>'amount')::numeric,
  (x->>'dueDate')::integer,
  (x->>'isPaid')::boolean,
  x->>'frequency',
  (x->>'dueMonth')::integer,
  x->>'emoji',
  x->>'category',
  x->>'tag',
  x->>'linkedBudgetItemId',
  x->>'linkedAccountId'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'recurrings' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_recurring_bills (is_default, id, name, amount, due_date, is_paid, frequency, due_month, emoji, category, tag, linked_budget_item_id, linked_account_id)
SELECT
  true as is_default,
  x->>'id',
  x->>'name',
  (x->>'amount')::numeric,
  (x->>'dueDate')::integer,
  (x->>'isPaid')::boolean,
  x->>'frequency',
  (x->>'dueMonth')::integer,
  x->>'emoji',
  x->>'category',
  x->>'tag',
  x->>'linkedBudgetItemId',
  x->>'linkedAccountId'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'recurrings' ON CONFLICT DO NOTHING;

-- transactions
INSERT INTO public.finance_transactions (is_default, id, name, category, amount, date, is_reviewed)
SELECT
  false as is_default,
  x->>'id',
  x->>'name',
  x->>'category',
  (x->>'amount')::numeric,
  (x->>'date')::date,
  (x->>'isReviewed')::boolean
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'transactions' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_transactions (is_default, id, name, category, amount, date, is_reviewed)
SELECT
  true as is_default,
  x->>'id',
  x->>'name',
  x->>'category',
  (x->>'amount')::numeric,
  (x->>'date')::date,
  (x->>'isReviewed')::boolean
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'transactions' ON CONFLICT DO NOTHING;

-- tax configs
INSERT INTO public.finance_tax_configs (is_default, student_loan_thresholds, student_loan_rates, income_tax_bands, national_insurance_bands)
SELECT
  false as is_default,
  content::jsonb->'studentLoanThresholds',
  content::jsonb->'studentLoanRates',
  content::jsonb->'incomeTaxBands',
  content::jsonb->'nationalInsuranceBands'
FROM public.finance_data
WHERE key = 'tax_config' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_tax_configs (is_default, student_loan_thresholds, student_loan_rates, income_tax_bands, national_insurance_bands)
SELECT
  true as is_default,
  content::jsonb->'studentLoanThresholds',
  content::jsonb->'studentLoanRates',
  content::jsonb->'incomeTaxBands',
  content::jsonb->'nationalInsuranceBands'
FROM public.finance_defaults
WHERE key = 'tax_config' ON CONFLICT DO NOTHING;

-- recurring templates
INSERT INTO public.finance_recurring_templates (is_default, name, category, emoji, tag, default_amount, frequency, linked_budget_item_id, budget_category_name)
SELECT
  false as is_default,
  x->>'name',
  x->>'category',
  x->>'emoji',
  x->>'tag',
  (x->>'defaultAmount')::numeric,
  x->>'frequency',
  x->>'linkedBudgetItemId',
  x->>'budgetCategoryName'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'recurring_templates' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_recurring_templates (is_default, name, category, emoji, tag, default_amount, frequency, linked_budget_item_id, budget_category_name)
SELECT
  true as is_default,
  x->>'name',
  x->>'category',
  x->>'emoji',
  x->>'tag',
  (x->>'defaultAmount')::numeric,
  x->>'frequency',
  x->>'linkedBudgetItemId',
  x->>'budgetCategoryName'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'recurring_templates' ON CONFLICT DO NOTHING;

-- credit bureaus
INSERT INTO public.finance_credit_bureaus (is_default, key, label, emoji, color, max_score, gradient)
SELECT
  false as is_default,
  x->>'key',
  x->>'label',
  x->>'emoji',
  x->>'color',
  (x->>'maxScore')::integer,
  x->>'gradient'
FROM public.finance_data d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'credit_bureaus' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_credit_bureaus (is_default, key, label, emoji, color, max_score, gradient)
SELECT
  true as is_default,
  x->>'key',
  x->>'label',
  x->>'emoji',
  x->>'color',
  (x->>'maxScore')::integer,
  x->>'gradient'
FROM public.finance_defaults d,
LATERAL jsonb_array_elements(d.content::jsonb) x
WHERE d.key = 'credit_bureaus' ON CONFLICT DO NOTHING;

-- holiday defaults
INSERT INTO public.finance_holiday_defaults (is_default, month_index, count, dates, occasion)
SELECT
  false as is_default,
  kv.key::integer,
  (kv.value->>'count')::numeric,
  kv.value->>'dates',
  kv.value->>'occasion'
FROM public.finance_data d,
LATERAL jsonb_each(d.content::jsonb) kv
WHERE d.key = 'holiday_defaults' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_holiday_defaults (is_default, month_index, count, dates, occasion)
SELECT
  true as is_default,
  kv.key::integer,
  (kv.value->>'count')::numeric,
  kv.value->>'dates',
  kv.value->>'occasion'
FROM public.finance_defaults d,
LATERAL jsonb_each(d.content::jsonb) kv
WHERE d.key = 'holiday_defaults' ON CONFLICT DO NOTHING;

-- budget presets
INSERT INTO public.finance_budget_presets (is_default, preset_type, name, emoji, group_type)
SELECT
  false as is_default,
  p.preset_key,
  item->>'name',
  item->>'emoji',
  item->>'group'
FROM public.finance_data d,
LATERAL jsonb_each(d.content::jsonb) as p(preset_key, preset_value),
LATERAL jsonb_array_elements(preset_value) as item
WHERE d.key = 'budget_presets' ON CONFLICT DO NOTHING;

INSERT INTO public.finance_budget_presets (is_default, preset_type, name, emoji, group_type)
SELECT
  true as is_default,
  p.preset_key,
  item->>'name',
  item->>'emoji',
  item->>'group'
FROM public.finance_defaults d,
LATERAL jsonb_each(d.content::jsonb) as p(preset_key, preset_value),
LATERAL jsonb_array_elements(preset_value) as item
WHERE d.key = 'budget_presets' ON CONFLICT DO NOTHING;
