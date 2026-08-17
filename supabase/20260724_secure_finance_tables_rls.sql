-- Finance data is personal financial information (balances, transactions,
-- goals, credit scores, tax config, etc.) and must never be readable or
-- writable by anyone but the admin. The previous policy granted SELECT to
-- `anon` and ALL to any `authenticated` user, meaning anyone with the public
-- anon key could read every table, and anyone who self-registered via
-- Supabase Auth could write/delete everything.
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
    CONTINUE WHEN to_regclass('public.' || quote_ident(t)) IS NULL;
    EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Write Access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin Only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admin Only" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );

    -- service_role (used by edge functions) bypasses RLS entirely, so it
    -- keeps working; only the anon SELECT grant needs to be pulled back.
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;
