-- Least privilege for `authenticated` on public tables: SELECT, INSERT, UPDATE
-- and DELETE only. TRUNCATE, REFERENCES and TRIGGER are revoked.
--
-- Why. Supabase's ALTER DEFAULT PRIVILEGES (supabase/schemas/90_privileges.sql)
-- hands every table `postgres` creates ALL to `authenticated`, and many schema
-- files add a legacy `GRANT ALL ... TO "authenticated"` on top. That left 49
-- public tables with all seven table privileges for the role every signed-in
-- user's JWT runs as. TRUNCATE is the reason to care: Postgres applies row-level
-- security to SELECT/INSERT/UPDATE/DELETE only, so the grant is the only thing
-- standing in front of it. An RLS mistake on a table must not be able to become
-- data loss. REFERENCES and TRIGGER only matter for DDL (creating a foreign key
-- onto, or a trigger on, a table), which nobody runs as `authenticated`.
--
-- Nothing is lost by narrowing. Edge functions connect as service_role, the
-- only client RPC is is_admin() (SECURITY DEFINER), and every table is owned by
-- postgres, so no invoker-rights path needs the three privileges as
-- `authenticated`. Least privilege per .claude/agents/migration.md.
--
-- Three parts, in one transaction:
--
--   1. REVOKE ALL then GRANT the four data verbs, on the 49 tables listed below.
--      A listed table that does not exist is an error, never a silent skip.
--   2. Narrow the default privileges so the NEXT table postgres creates does not
--      inherit the three privileges: authenticated keeps the four data verbs,
--      anon keeps SELECT only. `anon` is included deliberately: the same
--      default is why finance_merchant_logos ended up with anon TRUNCATE, and
--      SELECT-only is already what anon holds on every existing table (writes
--      were revoked table by table, e.g. 20260905160000); nothing writes as anon.
--      Only the `FOR ROLE postgres` defaults are altered. The `FOR ROLE
--      supabase_admin` defaults are left alone: postgres cannot alter them on
--      hosted, and no app table is owned by supabase_admin. Sequence and
--      function defaults are not touched.
--   3. A post-check that fails closed. It reads the catalog ACLs (not
--      information_schema, which only lists grants involving a role the current
--      user holds) and raises, rolling back the whole transaction, if anything
--      is still wider than intended -- including a global default-privilege
--      row, which a per-schema REVOKE cannot narrow (hosted had none when read
--      on 2026-10-24).
--
-- Deliberately out of scope:
--   - finance_merchant_logos, handled by 20261024140000 on another branch. It
--     is also excluded from the schema-wide check in part 3.
--   - Tables that are already narrow: admin_users, finance_student_loan_rates,
--     finance_sync_log, finance_transfer_links, finance_transfer_dismissals,
--     finance_transfer_single_legs, watchlist_events, watchlist_up_next,
--     rate_limits, finance_truelayer_source_sync.
--   - `anon` table grants on existing tables, sequences, functions and
--     service_role.
--
-- The 49 names live in one temp table, read by both the narrowing and the
-- post-check, so the two cannot drift apart. It is dropped explicitly rather
-- than ON COMMIT DROP so the file behaves the same under a runner that does not
-- hold one transaction open across statements.
--
-- Five of the 49 (finance_debt_observations, finance_investment_activities,
-- finance_investment_holdings, finance_payslip_transaction_reconciliations,
-- finance_payslips) are not declared under supabase/schemas/; only this
-- migration covers them. The other 44 are narrowed in their schema files too.

BEGIN;

CREATE TEMP TABLE authenticated_grant_targets (
    table_name text PRIMARY KEY
);

INSERT INTO pg_temp.authenticated_grant_targets (table_name) VALUES
    ('articles'),
    ('beliefs'),
    ('books'),
    ('favourites'),
    ('finance_account_balance_snapshots'),
    ('finance_bank_accounts'),
    ('finance_budget_categories'),
    ('finance_budget_items'),
    ('finance_budget_presets'),
    ('finance_credit_bureaus'),
    ('finance_credit_scores'),
    ('finance_data'),
    ('finance_debt_observations'),
    ('finance_debts'),
    ('finance_defaults'),
    ('finance_goal_contributions'),
    ('finance_goals'),
    ('finance_holiday_defaults'),
    ('finance_investment_activities'),
    ('finance_investment_holdings'),
    ('finance_memberships'),
    ('finance_net_worth_snapshots'),
    ('finance_payslip_transaction_reconciliations'),
    ('finance_payslips'),
    ('finance_profile_transfers'),
    ('finance_profiles'),
    ('finance_recurring_bills'),
    ('finance_recurring_templates'),
    ('finance_settings'),
    ('finance_tax_configs'),
    ('finance_transactions'),
    ('finance_truelayer_connection'),
    ('finance_truelayer_oauth_states'),
    ('finance_user_holidays'),
    ('inspirations'),
    ('inventory_items'),
    ('links'),
    ('movies'),
    ('photos'),
    ('recipes'),
    ('site_content'),
    ('sync_log'),
    ('thoughts'),
    ('tv_show_episodes'),
    ('tv_show_seasons'),
    ('tv_shows'),
    ('visited_cities'),
    ('visited_countries'),
    ('weekly_schedule');

-- (1) Narrow the existing tables.
DO $narrow$
DECLARE
    t text;
    kind text;
BEGIN
    FOR t IN
        SELECT table_name FROM pg_temp.authenticated_grant_targets ORDER BY table_name
    LOOP
        SELECT c.relkind::text INTO kind
          FROM pg_class c
         WHERE c.oid = to_regclass(format('public.%I', t));

        IF kind IS NULL THEN
            RAISE EXCEPTION 'authenticated least privilege: public.% does not exist; refusing to skip it', t;
        ELSIF kind NOT IN ('r', 'p') THEN
            RAISE EXCEPTION 'authenticated least privilege: public.% is not a table (relkind %)', t, kind;
        END IF;

        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    END LOOP;
END
$narrow$;

-- (2) Stop new tables inheriting the three privileges, and anon inheriting
-- writes. Mirrors the narrowed defaults in supabase/schemas/90_privileges.sql.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM "anon";

-- (3) Post-check. Any failure raises and rolls the transaction back.
DO $verify$
DECLARE
    t text;
    found_privs text[];
    offenders text;
    default_acl aclitem[];
    wanted CONSTANT text[] := ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE'];
BEGIN
    -- 3.1 Each listed table: authenticated holds exactly the four data verbs
    --     in relacl, nothing more and nothing less.
    FOR t IN
        SELECT table_name FROM pg_temp.authenticated_grant_targets ORDER BY table_name
    LOOP
        SELECT COALESCE(array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type), ARRAY[]::text[])
          INTO found_privs
          FROM pg_class c
         CROSS JOIN LATERAL aclexplode(c.relacl) AS a
         WHERE c.oid = to_regclass(format('public.%I', t))
           AND a.grantee = 'authenticated'::regrole;

        IF found_privs IS DISTINCT FROM wanted THEN
            RAISE EXCEPTION
                'authenticated least privilege: public.% grants to authenticated are {%}, expected {%}',
                t, array_to_string(found_privs, ', '), array_to_string(wanted, ', ');
        END IF;
    END LOOP;

    -- 3.2 Effective privileges across the whole schema. has_table_privilege
    --     accounts for PUBLIC and role membership, which relacl alone does
    --     not. finance_merchant_logos is handled by 20261024140000.
    SELECT string_agg(
               format('%I (%s %s)', c.relname, r.rolname, p.priv),
               ', ' ORDER BY c.relname, r.rolname, p.priv)
      INTO offenders
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN (VALUES ('authenticated'), ('anon')) AS r(rolname)
     CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND c.relname <> 'finance_merchant_logos'
       AND has_table_privilege(r.rolname::name, c.oid, p.priv);

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'authenticated least privilege: TRUNCATE/REFERENCES/TRIGGER still effective on: %', offenders;
    END IF;

    -- 3.3 Default privileges for tables postgres creates in public.
    SELECT d.defaclacl INTO default_acl
      FROM pg_default_acl d
     WHERE d.defaclrole = 'postgres'::regrole
       AND d.defaclnamespace = 'public'::regnamespace
       AND d.defaclobjtype = 'r';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'authenticated least privilege: no pg_default_acl row for postgres / public / tables';
    END IF;

    -- A global default (defaclnamespace = 0) is added on top of the per-schema
    -- one and cannot be narrowed by a per-schema REVOKE, so read both.
    SELECT string_agg(
               format('%s:%s%s', r.rolname, a.privilege_type,
                      CASE WHEN d.defaclnamespace = 0 THEN ' (global)' ELSE '' END),
               ', ' ORDER BY r.rolname, a.privilege_type)
      INTO offenders
      FROM pg_default_acl d
     CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
      JOIN pg_roles r ON r.oid = a.grantee
     WHERE d.defaclrole = 'postgres'::regrole
       AND d.defaclnamespace IN (0::oid, 'public'::regnamespace::oid)
       AND d.defaclobjtype = 'r'
       AND (   (r.rolname = 'authenticated' AND a.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER'))
            OR (r.rolname = 'anon' AND a.privilege_type <> 'SELECT'));

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'authenticated least privilege: default privileges still grant: %', offenders;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type), ARRAY[]::text[])
      INTO found_privs
      FROM aclexplode(default_acl) AS a
     WHERE a.grantee = 'authenticated'::regrole;

    IF NOT (found_privs @> wanted) THEN
        RAISE EXCEPTION
            'authenticated least privilege: default privileges for authenticated are {%}, must still include {%}',
            array_to_string(found_privs, ', '), array_to_string(wanted, ', ');
    END IF;
END
$verify$;

DROP TABLE pg_temp.authenticated_grant_targets;

COMMIT;
