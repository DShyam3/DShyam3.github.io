-- Least privilege for `authenticated` on public tables: SELECT, INSERT, UPDATE
-- and DELETE only, and nothing at all on the two tables that hold TrueLayer
-- credentials. TRUNCATE, REFERENCES and TRIGGER are revoked everywhere.
--
-- Why. Supabase's default privileges (the image's ALTER DEFAULT PRIVILEGES,
-- which supabase/schemas/90_privileges.sql now narrows) hand every table
-- `postgres` creates ALL to `authenticated`, and many schema
-- files add a legacy `GRANT ALL ... TO "authenticated"` on top. That left 50
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
-- Two of the 50 get no grant back: finance_truelayer_connection and
-- finance_truelayer_oauth_states, the same shape as
-- finance_truelayer_source_sync, which already has none for `authenticated`.
-- finance_truelayer_connection stores the bank's access_token and
-- refresh_token in plain columns. Checked on 2026-10-24:
--   - every query on either table is in
--     supabase/functions/truelayer-sync/index.ts, on the service_role client
--     (supabaseAdmin). That function's user-scoped client is used only for the
--     admin check;
--   - src/ has no runtime query on either table, only the generated types in
--     src/integrations/supabase/types.ts;
--   - no view, SECURITY INVOKER function or realtime publication reads them.
-- So the only thing the grant enabled was an admin JWT reading bank tokens
-- through PostgREST. Their RLS policies ("Admin All Access" on the connection
-- table, "Admin Only" on oauth_states) are left in place: with no grant they
-- are never reached, so they are inert and harmless. Deleting a profile still
-- cascades into both tables, because referential actions run as the table
-- owner (postgres), not as the caller.
--
-- Three parts, in one transaction:
--
--   1. REVOKE ALL on the 50 tables listed below, then GRANT the four data verbs
--      back on the 48 flagged grant_back = true. The 2 flagged false keep
--      nothing. A listed table that does not exist is an error, never a
--      silent skip.
--   2. Make the default privileges an allowlist, so the NEXT table postgres
--      creates starts with only what is named: authenticated gets the four data
--      verbs, anon gets nothing. A table that should be public-read says so with
--      its own GRANT SELECT ... TO anon (every one does, in its schema file), so
--      a forgotten REVOKE on a future table fails safe. `anon` is included
--      deliberately: the old default is why finance_merchant_logos ended up with
--      anon TRUNCATE, and anon holds no grant on finance_* tables at all.
--      An allowlist rather than a REVOKE of TRUNCATE, REFERENCES and TRIGGER,
--      because it survives Postgres adding a privilege to ALL (PG17 added
--      MAINTAIN), which a denylist of those three would not.
--      Only the `FOR ROLE postgres` defaults are altered. The `FOR ROLE
--      supabase_admin` defaults are left alone: postgres cannot alter them on
--      hosted, and no app table is owned by supabase_admin. Sequence and
--      function defaults are not touched.
--   3. A post-check that fails closed. It reads the catalog ACLs (not
--      information_schema, which only lists grants involving a role the current
--      user holds) and raises, rolling back the whole transaction, if anything
--      is still wider than intended -- including a global default-privilege
--      row, which a per-schema REVOKE cannot narrow (hosted had none when read
--      on 2026-10-24), and a PUBLIC entry in the defaults, which every role
--      including anon would inherit on each new table. For the two no-grant
--      tables it also checks effective privileges, which catches a grant via
--      PUBLIC or role membership.
--
-- finance_merchant_logos is in the list. 20261024140000, which sorts before this
-- file, has already revoked everything `anon` held on it and dropped its public
-- read policy; this migration handles `authenticated`. That file's own
-- post-check asserts authenticated still holds all seven privileges, so it must
-- run first, as it does by timestamp.
--
-- Deliberately out of scope:
--   - Tables that are already narrow: admin_users, finance_student_loan_rates,
--     finance_sync_log, finance_transfer_links, finance_transfer_dismissals,
--     finance_transfer_single_legs, watchlist_events, watchlist_up_next,
--     rate_limits, finance_truelayer_source_sync.
--   - `anon` table grants on existing tables, sequences, functions and
--     service_role.
--
-- The 50 names live in one temp table, read by both the narrowing and the
-- post-check, so the two cannot drift apart. It is dropped explicitly rather than
-- ON COMMIT DROP so the file behaves the same under a runner that does not
-- hold one transaction open across statements.
--
-- All 50 are narrowed in their supabase/schemas/ files too: the 48 with the
-- four data verbs, the 2 TrueLayer tables with REVOKE ALL alone.

BEGIN;

-- grant_back: true = the four data verbs are granted back after REVOKE ALL;
-- false = nothing is.
CREATE TEMP TABLE authenticated_grant_targets (
    table_name text PRIMARY KEY,
    grant_back boolean NOT NULL
);

INSERT INTO pg_temp.authenticated_grant_targets (table_name, grant_back) VALUES
    ('articles', true),
    ('beliefs', true),
    ('books', true),
    ('favourites', true),
    ('finance_account_balance_snapshots', true),
    ('finance_bank_accounts', true),
    ('finance_budget_categories', true),
    ('finance_budget_items', true),
    ('finance_budget_presets', true),
    ('finance_credit_bureaus', true),
    ('finance_credit_scores', true),
    ('finance_data', true),
    ('finance_debt_observations', true),
    ('finance_debts', true),
    ('finance_defaults', true),
    ('finance_goal_contributions', true),
    ('finance_goals', true),
    ('finance_holiday_defaults', true),
    ('finance_investment_activities', true),
    ('finance_investment_holdings', true),
    ('finance_memberships', true),
    ('finance_merchant_logos', true),
    ('finance_net_worth_snapshots', true),
    ('finance_payslip_transaction_reconciliations', true),
    ('finance_payslips', true),
    ('finance_profile_transfers', true),
    ('finance_profiles', true),
    ('finance_recurring_bills', true),
    ('finance_recurring_templates', true),
    ('finance_settings', true),
    ('finance_tax_configs', true),
    ('finance_transactions', true),
    ('finance_user_holidays', true),
    ('inspirations', true),
    ('inventory_items', true),
    ('links', true),
    ('movies', true),
    ('photos', true),
    ('recipes', true),
    ('site_content', true),
    ('sync_log', true),
    ('thoughts', true),
    ('tv_show_episodes', true),
    ('tv_show_seasons', true),
    ('tv_shows', true),
    ('visited_cities', true),
    ('visited_countries', true),
    ('weekly_schedule', true);

-- No grant back: TrueLayer tokens and OAuth state, service_role only.
INSERT INTO pg_temp.authenticated_grant_targets (table_name, grant_back) VALUES
    ('finance_truelayer_connection', false),
    ('finance_truelayer_oauth_states', false);

-- (1) Narrow the existing tables.
DO $narrow$
DECLARE
    t text;
    do_grant boolean;
    kind text;
BEGIN
    FOR t, do_grant IN
        SELECT g.table_name, g.grant_back
          FROM pg_temp.authenticated_grant_targets g
         ORDER BY g.table_name
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

        IF do_grant THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
        END IF;
    END LOOP;
END
$narrow$;

-- (2) Default privileges as an allowlist: anon nothing, authenticated the four
-- data verbs. Mirrors supabase/schemas/90_privileges.sql.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    REVOKE ALL ON TABLES FROM "anon", "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "authenticated";

-- (3) Post-check. Any failure raises and rolls the transaction back.
DO $verify$
DECLARE
    t text;
    do_grant boolean;
    found_privs text[];
    expected_privs text[];
    one_priv text;
    offenders text;
    default_acl aclitem[];
    wanted CONSTANT text[] := ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE'];
    all_privs CONSTANT text[] :=
        ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
BEGIN
    -- 3.1 Each listed table: authenticated holds exactly the four data verbs
    --     in relacl where grant_back is true, and nothing at all where it is
    --     false. No more and no less.
    FOR t, do_grant IN
        SELECT g.table_name, g.grant_back
          FROM pg_temp.authenticated_grant_targets g
         ORDER BY g.table_name
    LOOP
        SELECT COALESCE(array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type), ARRAY[]::text[])
          INTO found_privs
          FROM pg_class c
         CROSS JOIN LATERAL aclexplode(c.relacl) AS a
         WHERE c.oid = to_regclass(format('public.%I', t))
           AND a.grantee = 'authenticated'::regrole;

        expected_privs := CASE WHEN do_grant THEN wanted ELSE ARRAY[]::text[] END;

        IF found_privs IS DISTINCT FROM expected_privs THEN
            RAISE EXCEPTION
                'authenticated least privilege: public.% grants to authenticated are {%}, expected {%}',
                t, array_to_string(found_privs, ', '), array_to_string(expected_privs, ', ');
        END IF;

        -- A no-grant table must hold nothing effective either: has_table_privilege
        -- accounts for PUBLIC and role membership, which relacl alone does not.
        -- Column-level privileges are checked too, since a column grant on the
        -- token columns would be a way in that a table-level check misses.
        IF NOT do_grant THEN
            FOREACH one_priv IN ARRAY all_privs LOOP
                IF has_table_privilege('authenticated'::name, to_regclass(format('public.%I', t))::oid, one_priv) THEN
                    RAISE EXCEPTION
                        'authenticated least privilege: public.% still has effective % for authenticated, expected none',
                        t, one_priv;
                END IF;
            END LOOP;

            FOREACH one_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
                IF has_any_column_privilege('authenticated'::name, to_regclass(format('public.%I', t))::oid, one_priv) THEN
                    RAISE EXCEPTION
                        'authenticated least privilege: public.% still has % on a column for authenticated, expected none',
                        t, one_priv;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- 3.2 Effective privileges across the whole schema. has_table_privilege
    --     accounts for PUBLIC and role membership, which relacl alone does
    --     not. Covers every relation, finance_merchant_logos included:
    --     20261024140000 has already taken anon's privileges from it.
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
       AND has_table_privilege(r.rolname::name, c.oid, p.priv);

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'authenticated least privilege: TRUNCATE/REFERENCES/TRIGGER still effective on: %', offenders;
    END IF;

    -- 3.3 Default privileges for tables postgres creates, checked as an
    --     allowlist: anon holds nothing, authenticated holds nothing outside the
    --     four data verbs, and PUBLIC holds nothing. aclexplode reports PUBLIC as
    --     grantee 0, which has no pg_roles row: an inner join to pg_roles would
    --     drop it silently, and a PUBLIC grant reaches anon on every new table.
    --     So pg_roles is left-joined and PUBLIC is labelled.
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
    SELECT string_agg(o.entry, ', ' ORDER BY o.entry)
      INTO offenders
      FROM (
          SELECT format('%s:%s%s',
                        CASE WHEN a.grantee = 0::oid THEN 'PUBLIC' ELSE r.rolname::text END,
                        a.privilege_type,
                        CASE WHEN d.defaclnamespace = 0 THEN ' (global)' ELSE '' END) AS entry
            FROM pg_default_acl d
           CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
            LEFT JOIN pg_roles r ON r.oid = a.grantee
           WHERE d.defaclrole = 'postgres'::regrole
             AND d.defaclnamespace IN (0::oid, 'public'::regnamespace::oid)
             AND d.defaclobjtype = 'r'
             AND (   a.grantee = 0::oid
                  OR r.rolname = 'anon'
                  OR (r.rolname = 'authenticated'
                      AND a.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')))
      ) AS o;

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'authenticated least privilege: default privileges outside the allowlist (anon: none; authenticated: SELECT, INSERT, UPDATE, DELETE; PUBLIC: none): %', offenders;
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
