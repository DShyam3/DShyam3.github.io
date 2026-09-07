-- A second profile holding invented data.
--
-- Two jobs. First, the finance model has never had a budget set, so half the
-- app has been dead: the largest element on Home is an empty chart, budget
-- allocation reads 0%, and every "what happens if" answer falls back to income
-- because there is no budget to measure against. Judging new features against
-- that is judging them against an empty model.
--
-- Second, this is the profile a public demo would show. `is_public` is added
-- here so the model carries the idea, but **no policy reads it yet** — anon
-- still cannot select from any finance table. Opening that up is a separate,
-- deliberately reviewed change; see the note at the bottom.
--
-- Every figure below is invented. It is not anyone's money.

BEGIN;

ALTER TABLE "public"."finance_profiles"
    ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."finance_profiles"."is_public" IS
  'Marks a profile as safe to show publicly. Carries no privilege on its own: '
  'no RLS policy reads it yet, and anon holds no SELECT on any finance table.';

INSERT INTO "public"."finance_profiles" ("name", "is_self", "is_public", "currency", "region", "emoji")
SELECT 'Demo', false, true, 'GBP', 'england-and-wales', '🧪'
WHERE NOT EXISTS (SELECT 1 FROM "public"."finance_profiles" WHERE "name" = 'Demo');

DO $$
DECLARE
  p uuid;
BEGIN
  SELECT id INTO STRICT p FROM public.finance_profiles WHERE name = 'Demo';

  -- Idempotent: re-running replaces the demo rows rather than duplicating them.
  DELETE FROM public.finance_goal_contributions WHERE profile_id = p;
  DELETE FROM public.finance_goals             WHERE profile_id = p;
  DELETE FROM public.finance_budget_items      WHERE profile_id = p;
  DELETE FROM public.finance_budget_categories WHERE profile_id = p;
  DELETE FROM public.finance_transactions      WHERE profile_id = p;
  DELETE FROM public.finance_recurring_bills   WHERE profile_id = p;
  DELETE FROM public.finance_bank_accounts     WHERE profile_id = p;
  DELETE FROM public.finance_debts             WHERE profile_id = p;
  DELETE FROM public.finance_settings          WHERE profile_id = p;

  INSERT INTO public.finance_settings
    (profile_id, is_default, gross_salary, pension_type, personal_pension_percent,
     employer_pension_percent, student_loan_plan, tax_code, personal_allowance,
     work_holidays, working_hours_per_day, tax_year, uk_region, pay_day_of_month)
  VALUES (p, false, 46000, 'net_pay', 5, 4, 'plan2', '1257L', 12570, 25, 7.5, 2026,
          'england-and-wales', 28);

  INSERT INTO public.finance_bank_accounts
    (id, profile_id, is_default, name, type, issuer, balance, annual_fee, emoji)
  VALUES
    ('demo_acc_current', p, false, 'Everyday',     'checking',   'Monzo',    2450.80, 0, '💵'),
    ('demo_acc_savings', p, false, 'Rainy Day',    'savings',    'Chase',    8200.00, 0, '🐷'),
    ('demo_acc_credit',  p, false, 'Cashback',     'credit',     'Amex',     -640.25, 0, '💳'),
    ('demo_acc_invest',  p, false, 'Stocks & Shares ISA', 'investment', 'Vanguard', 14300.00, 0, '📈');

  INSERT INTO public.finance_debts
    (id, profile_id, is_default, name, type, lender, original_amount, balance,
     interest_rate, min_payment, start_date, repayment_type, student_loan_plan)
  VALUES ('demo_debt_sl', p, false, 'Student Loan', 'student', 'SLC', 42000, 38400,
          7.3, 0, '2020-09-01', 'income_contingent', 'plan2');

  -- Budgets, which is the point of the exercise: totals that mean something.
  INSERT INTO public.finance_budget_categories
    (id, profile_id, is_default, is_template, name, budgeted, group_type, emoji)
  VALUES
    ('demo_cat_housing',   p, false, false, 'Housing',       1250, 'needs',   '🏠'),
    ('demo_cat_food',      p, false, false, 'Food & Drink',   420, 'needs',   '🛒'),
    ('demo_cat_transport', p, false, false, 'Transport',      180, 'needs',   '🚗'),
    ('demo_cat_utilities', p, false, false, 'Utilities',      165, 'needs',   '⚡'),
    ('demo_cat_fun',       p, false, false, 'Entertainment',  220, 'wants',   '🎬'),
    ('demo_cat_shopping',  p, false, false, 'Shopping',       150, 'wants',   '🛍️'),
    ('demo_cat_savings',   p, false, false, 'Savings',        700, 'savings', '💰');

  INSERT INTO public.finance_budget_items
    (id, profile_id, is_default, is_template, category_id, name, budgeted, spent, emoji)
  VALUES
    ('demo_item_rent',    p, false, false, 'demo_cat_housing',   'Rent',          1100, 1100, '🏠'),
    ('demo_item_council', p, false, false, 'demo_cat_housing',   'Council Tax',    150,  150, '🏛️'),
    ('demo_item_grocery', p, false, false, 'demo_cat_food',      'Groceries',      320,  268, '🛒'),
    ('demo_item_eatout',  p, false, false, 'demo_cat_food',      'Eating Out',     100,   84, '🍔'),
    ('demo_item_travel',  p, false, false, 'demo_cat_transport', 'Rail',           180,  142, '🚆'),
    ('demo_item_energy',  p, false, false, 'demo_cat_utilities', 'Energy',          95,   91, '⚡'),
    ('demo_item_broad',   p, false, false, 'demo_cat_utilities', 'Broadband',       70,   70, '🌐'),
    ('demo_item_streams', p, false, false, 'demo_cat_fun',       'Subscriptions',   45,   45, '🎬'),
    ('demo_item_social',  p, false, false, 'demo_cat_fun',       'Going Out',      175,  126, '🍻'),
    ('demo_item_clothes', p, false, false, 'demo_cat_shopping',  'Clothes',        150,   62, '🛍️'),
    ('demo_item_isa',     p, false, false, 'demo_cat_savings',   'Stocks ISA',     500,  500, '📈'),
    ('demo_item_pot',     p, false, false, 'demo_cat_savings',   'Rainy Day',      200,  200, '🐷');

  INSERT INTO public.finance_recurring_bills
    (id, profile_id, is_default, name, amount, due_date, is_paid, frequency, emoji, category)
  VALUES
    ('demo_rec_rent',    p, false, 'Rent',            1100, 1,  true,  'monthly', '🏠', 'Housing'),
    ('demo_rec_council', p, false, 'Council Tax',      150, 5,  true,  'monthly', '🏛️', 'Housing'),
    ('demo_rec_energy',  p, false, 'Energy',            91, 12, false, 'monthly', '⚡', 'Utilities'),
    ('demo_rec_broad',   p, false, 'Broadband',         70, 18, false, 'monthly', '🌐', 'Utilities'),
    ('demo_rec_music',   p, false, 'Music',             11, 22, false, 'monthly', '🎵', 'Entertainment');

  INSERT INTO public.finance_goals
    (id, profile_id, is_default, name, target_amount, current_amount, target_date, start_date, status, emoji)
  VALUES
    ('demo_goal_ef',   p, false, 'Emergency Fund', 12000,  8200, '2027-06-30', '2025-01-01', 'active', '🛟'),
    ('demo_goal_trip', p, false, 'Japan Trip',      4000,  1150, '2027-04-01', '2026-01-01', 'active', '🗼');

  INSERT INTO public.finance_goal_contributions
    (id, profile_id, is_default, goal_id, amount, date, note, bank_account_id)
  VALUES
    ('demo_con_1', p, false, 'demo_goal_ef',   200, '2026-07-28', 'Monthly transfer', 'demo_acc_savings'),
    ('demo_con_2', p, false, 'demo_goal_ef',   200, '2026-08-28', 'Monthly transfer', 'demo_acc_savings'),
    ('demo_con_3', p, false, 'demo_goal_trip', 150, '2026-08-28', 'Monthly transfer', 'demo_acc_savings');

  -- A month of spending that adds up to the item totals above.
  INSERT INTO public.finance_transactions
    (id, profile_id, is_default, name, category, amount, date, is_reviewed, account_id)
  VALUES
    ('demo_tx_01', p, false, 'Rent — September',   'Housing',       -1100, '2026-09-01', true,  'demo_acc_current'),
    ('demo_tx_02', p, false, 'Council Tax',        'Housing',        -150, '2026-09-05', true,  'demo_acc_current'),
    ('demo_tx_03', p, false, 'Sainsburys',         'Food & Drink',    -68, '2026-09-02', true,  'demo_acc_credit'),
    ('demo_tx_04', p, false, 'Sainsburys',         'Food & Drink',    -74, '2026-09-09', true,  'demo_acc_credit'),
    ('demo_tx_05', p, false, 'Lidl',               'Food & Drink',    -52, '2026-09-14', false, 'demo_acc_credit'),
    ('demo_tx_06', p, false, 'Ocado',              'Food & Drink',    -74, '2026-09-20', false, 'demo_acc_credit'),
    ('demo_tx_07', p, false, 'Dishoom',            'Food & Drink',    -84, '2026-09-13', true,  'demo_acc_credit'),
    ('demo_tx_08', p, false, 'Trainline',          'Transport',       -68, '2026-09-03', true,  'demo_acc_current'),
    ('demo_tx_09', p, false, 'Trainline',          'Transport',       -74, '2026-09-17', false, 'demo_acc_current'),
    ('demo_tx_10', p, false, 'Octopus Energy',     'Utilities',       -91, '2026-09-12', true,  'demo_acc_current'),
    ('demo_tx_11', p, false, 'Community Fibre',    'Utilities',       -70, '2026-09-18', false, 'demo_acc_current'),
    ('demo_tx_12', p, false, 'Spotify',            'Entertainment',   -11, '2026-09-22', false, 'demo_acc_credit'),
    ('demo_tx_13', p, false, 'Curzon Cinema',      'Entertainment',   -34, '2026-09-06', true,  'demo_acc_credit'),
    ('demo_tx_14', p, false, 'The Eagle',          'Entertainment',   -46, '2026-09-11', true,  'demo_acc_credit'),
    ('demo_tx_15', p, false, 'The Eagle',          'Entertainment',   -46, '2026-09-19', false, 'demo_acc_credit'),
    ('demo_tx_16', p, false, 'Uniqlo',             'Shopping',        -62, '2026-09-08', true,  'demo_acc_credit'),
    ('demo_tx_17', p, false, 'Vanguard ISA',       'Savings',        -500, '2026-09-28', true,  'demo_acc_invest'),
    ('demo_tx_18', p, false, 'Rainy Day transfer', 'Savings',        -200, '2026-09-28', true,  'demo_acc_savings'),
    ('demo_tx_19', p, false, 'Salary',             'Income',      2841.66, '2026-08-28', true,  'demo_acc_current'),
    ('demo_tx_20', p, false, 'Salary',             'Income',      2841.66, '2026-07-28', true,  'demo_acc_current');
END $$;

-- Deliberately NOT done here, and not to be done casually:
--
--   * granting anon SELECT on any finance table
--   * any RLS policy referencing is_public
--
-- If the demo is ever made public, it must be table by table, each grant paired
-- with a policy restricted to profiles where is_public, and
-- finance_truelayer_connection must be excluded outright — it holds live access
-- and refresh tokens, and profile scoping is not a reason to expose it.

COMMIT;
