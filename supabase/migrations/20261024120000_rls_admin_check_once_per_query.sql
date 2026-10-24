-- RLS: evaluate the admin check once per statement, not once per row.
--
-- public.is_admin() is LANGUAGE sql STABLE SECURITY DEFINER with a SET
-- search_path clause, so Postgres cannot inline it. Written bare in a policy,
-- USING (public.is_admin()), it is called once for every row the policy tests.
-- Wrapped, USING ((SELECT public.is_admin())), it becomes an InitPlan that runs
-- once per statement and is reused for every row. Same answer, far less work on
-- large reads. The measurement is in performance/README.md; no figures are
-- repeated here.
--
-- Small statements lose nothing. An RLS qual stays a per-row filter on the
-- InitPlan's result, and the InitPlan runs lazily, when the first row reaches
-- the policy: a statement that touches no rows never calls is_admin() (EXPLAIN
-- ANALYZE shows the InitPlan "never executed"), and one that touches a single
-- row -- the usual statement a per-row trigger fires -- calls it once per
-- clause, as the bare form did.
--
-- Scope: the 88 policies in schema public that still call is_admin() bare, all
-- TO authenticated. ALTER POLICY without a TO clause keeps the roles and cannot
-- change the command, so only the USING / WITH CHECK expressions move. Each
-- policy keeps exactly the clauses it has today (INSERT: WITH CHECK only;
-- SELECT and DELETE: USING only; UPDATE and ALL: both). Five policies are
-- already wrapped (finance_sync_log, finance_transfer_links,
-- finance_transfer_dismissals, finance_transfer_single_legs,
-- finance_payslip_transaction_reconciliations) and are left alone.
-- storage.objects policies are handled by a separate migration because they
-- combine the call with a bucket test.
--
-- ALTER POLICY replaces the whole expression, so the guard below refuses to run
-- unless every targeted policy reads exactly as expected. A policy edited by
-- hand since the last migration would otherwise silently lose its extra
-- conditions. For the same reason this migration is not re-runnable: once
-- applied, the policies no longer read as the guard expects.
BEGIN;

SET LOCAL lock_timeout = '5s';
-- pg_policies deparses against search_path; pinning it makes the guard compare a fixed form.
SET LOCAL search_path = '';

-- Guard: RAISE unless every targeted policy currently reads exactly as expected.
DO $$
DECLARE
    v_mismatch text;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.format('%I.%I', e.tablename, e.policyname), ', ')
    INTO v_mismatch
    FROM (VALUES
        ('admin_users', 'Admin read', 'SELECT', 'public.is_admin()', NULL),
        ('articles', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('articles', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('articles', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('beliefs', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('beliefs', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('beliefs', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('books', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('books', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('books', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('favourites', 'Admin delete favourites', 'DELETE', 'public.is_admin()', NULL),
        ('favourites', 'Admin insert favourites', 'INSERT', NULL, 'public.is_admin()'),
        ('favourites', 'Admin update favourites', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('finance_account_balance_snapshots', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_bank_accounts', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_budget_categories', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_budget_items', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_budget_presets', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_credit_bureaus', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_credit_scores', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_data', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_debt_observations', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_debts', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_defaults', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_goal_contributions', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_goals', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_holiday_defaults', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_investment_activities', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_investment_holdings', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_memberships', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_merchant_logos', 'Admin writes merchant logo index', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_net_worth_snapshots', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_payslips', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_profile_transfers', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_profiles', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_recurring_bills', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_recurring_templates', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_settings', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_student_loan_rates', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_tax_configs', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_transactions', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_truelayer_connection', 'Admin All Access', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_truelayer_oauth_states', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('finance_user_holidays', 'Admin Only', 'ALL', 'public.is_admin()', 'public.is_admin()'),
        ('inspirations', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('inspirations', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('inspirations', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('inventory_items', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('inventory_items', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('inventory_items', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('links', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('links', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('links', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('movies', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('movies', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('movies', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('photos', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('photos', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('photos', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('recipes', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('recipes', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('recipes', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('site_content', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('site_content', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('site_content', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('sync_log', 'Admin delete sync_log', 'DELETE', 'public.is_admin()', NULL),
        ('sync_log', 'Admin insert sync_log', 'INSERT', NULL, 'public.is_admin()'),
        ('sync_log', 'Admin read sync_log', 'SELECT', 'public.is_admin()', NULL),
        ('thoughts', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('thoughts', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('thoughts', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('tv_show_episodes', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('tv_show_episodes', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('tv_show_episodes', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('tv_show_seasons', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('tv_show_seasons', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('tv_show_seasons', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('tv_shows', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('tv_shows', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('tv_shows', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('visited_cities', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('visited_cities', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('visited_countries', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('visited_countries', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('visited_countries', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()'),
        ('weekly_schedule', 'Admin delete', 'DELETE', 'public.is_admin()', NULL),
        ('weekly_schedule', 'Admin insert', 'INSERT', NULL, 'public.is_admin()'),
        ('weekly_schedule', 'Admin update', 'UPDATE', 'public.is_admin()', 'public.is_admin()')
    ) AS e(tablename, policyname, cmd, qual, with_check)
    LEFT JOIN pg_catalog.pg_policies p
        ON p.schemaname = 'public' AND p.tablename = e.tablename AND p.policyname = e.policyname
    WHERE p.policyname IS NULL
       OR p.cmd IS DISTINCT FROM e.cmd
       OR p.roles IS DISTINCT FROM ARRAY['authenticated']::name[]
       OR p.qual IS DISTINCT FROM e.qual
       OR p.with_check IS DISTINCT FROM e.with_check;

    IF v_mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Refusing to rewrite: these policies do not read as expected: %', v_mismatch;
    END IF;
END
$$;

ALTER POLICY "Admin delete" ON "public"."articles" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."articles" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."articles" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."beliefs" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."beliefs" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."beliefs" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."books" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."books" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."books" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete favourites" ON "public"."favourites" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert favourites" ON "public"."favourites" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update favourites" ON "public"."favourites" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_account_balance_snapshots" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_bank_accounts" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_budget_categories" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_budget_items" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_budget_presets" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_credit_bureaus" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_credit_scores" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_data" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_debt_observations" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_debts" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_defaults" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_goal_contributions" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_goals" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_holiday_defaults" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_investment_activities" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_investment_holdings" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_memberships" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin writes merchant logo index" ON "public"."finance_merchant_logos" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_net_worth_snapshots" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_payslips" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_profile_transfers" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_profiles" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_recurring_bills" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_recurring_templates" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_settings" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_student_loan_rates" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_tax_configs" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_transactions" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin All Access" ON "public"."finance_truelayer_connection" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_truelayer_oauth_states" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin Only" ON "public"."finance_user_holidays" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."inspirations" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."inspirations" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."inspirations" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."inventory_items" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."inventory_items" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."inventory_items" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."links" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."links" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."links" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."movies" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."movies" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."movies" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."photos" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."photos" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."photos" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."recipes" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."recipes" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."recipes" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."site_content" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."site_content" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."site_content" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete sync_log" ON "public"."sync_log" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert sync_log" ON "public"."sync_log" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin read sync_log" ON "public"."sync_log" USING ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."thoughts" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."thoughts" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."thoughts" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."tv_show_episodes" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."tv_show_episodes" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."tv_show_episodes" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."tv_show_seasons" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."tv_show_seasons" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."tv_show_seasons" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."tv_shows" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."tv_shows" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."tv_shows" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."visited_cities" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."visited_cities" WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."visited_countries" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."visited_countries" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."visited_countries" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER POLICY "Admin delete" ON "public"."weekly_schedule" USING ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin insert" ON "public"."weekly_schedule" WITH CHECK ((SELECT "public"."is_admin"()));
ALTER POLICY "Admin update" ON "public"."weekly_schedule" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

-- admin_users last. Every admin request reads it inside is_admin(), after
-- locking the table it is reading. Locked first, it would sit ahead of such a
-- request while this transaction waited on the request's own table: a
-- deadlock. Last, the request finishes before this needs admin_users.
ALTER POLICY "Admin read" ON "public"."admin_users" USING ((SELECT "public"."is_admin"()));

-- Post-check: no policy in schema public still calls is_admin() bare. The
-- wrapped form deparses as ( SELECT public.is_admin() AS is_admin); strip that
-- and anything still mentioning is_admin is a bare call. Then count the clauses
-- that read exactly the wrapped form: the 88 policies above carry 136 (69 USING,
-- 67 WITH CHECK) and the 5 already wrapped carry 9, so a clause that lost the
-- call -- USING (true) by a slip -- leaves fewer than 145.
DO $$
DECLARE
    v_bare    text;
    v_wrapped bigint;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.format('%I.%I', p.tablename, p.policyname), ', ')
    INTO v_bare
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public'
      AND pg_catalog.replace(
              pg_catalog.concat_ws(' ', p.qual, p.with_check),
              '( SELECT public.is_admin() AS is_admin)',
              ''
          ) LIKE '%is_admin%';

    IF v_bare IS NOT NULL THEN
        RAISE EXCEPTION 'Policies still calling is_admin() bare: %', v_bare;
    END IF;

    SELECT pg_catalog.count(*) FILTER (WHERE p.qual = '( SELECT public.is_admin() AS is_admin)')
         + pg_catalog.count(*) FILTER (WHERE p.with_check = '( SELECT public.is_admin() AS is_admin)')
    INTO v_wrapped
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public';

    IF v_wrapped <> 145 THEN
        RAISE EXCEPTION 'Expected 145 policy clauses reading ( SELECT public.is_admin() AS is_admin), found %', v_wrapped;
    END IF;
END
$$;

COMMIT;
