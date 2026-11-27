-- Close the default privileges that hand `anon` rights on every new sequence and
-- function postgres creates in public.
--
-- Why the global PUBLIC revoke. postgres has no global default-ACL entry for
-- functions, so Postgres's built-in default gives PUBLIC EXECUTE on every new
-- function, and anon inherits it through PUBLIC. Revoking anon per schema does
-- not close that: per-schema defaults only add to the global ones, and IN SCHEMA
-- cannot revoke a global grant. Being global, it also leaves a function postgres
-- creates outside public and storage callable by no other role, service_role
-- included, until granted; the repo creates none today. Existing functions keep
-- the ACLs they have: is_admin stays callable by anon, which a public-read policy
-- needs, and the four trigger functions that still carry PUBLIC need no EXECUTE
-- to fire. A future function anon must call needs its own GRANT EXECUTE ... TO
-- "anon", so a forgotten grant fails visibly rather than open.
--
-- The 7 existing public sequences that grant anon rights are revoked too; anon
-- holds no INSERT/UPDATE/DELETE on any public table, so nothing needs nextval.
-- Mirrors supabase/schemas/90_privileges.sql. The post-check reads catalog ACLs,
-- not information_schema, which hides grants to roles the current user lacks.

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "anon";

-- Post-check. Any failure raises and rolls the transaction back.
DO $verify$
DECLARE
    offenders text;
BEGIN
    -- 1. No per-schema default for sequences or functions names anon.
    SELECT string_agg(format('%s:%s', d.defaclobjtype, a.privilege_type), ', ')
      INTO offenders
      FROM pg_default_acl d
     CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
     WHERE d.defaclrole = 'postgres'::regrole
       AND d.defaclnamespace = 'public'::regnamespace
       AND d.defaclobjtype IN ('S', 'f')
       AND a.grantee = 'anon'::regrole;

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION 'anon default privileges: public defaults still grant anon: %', offenders;
    END IF;

    -- 2. The global function default exists and no longer carries PUBLIC
    --    (aclexplode reports PUBLIC as grantee 0).
    IF NOT EXISTS (
        SELECT 1 FROM pg_default_acl d
         WHERE d.defaclrole = 'postgres'::regrole
           AND d.defaclnamespace = 0
           AND d.defaclobjtype = 'f'
    ) THEN
        RAISE EXCEPTION 'anon default privileges: no global pg_default_acl row for postgres / functions';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_default_acl d
         CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
         WHERE d.defaclrole = 'postgres'::regrole
           AND d.defaclnamespace = 0
           AND d.defaclobjtype = 'f'
           AND a.grantee = 0::oid
    ) THEN
        RAISE EXCEPTION 'anon default privileges: global function default still grants PUBLIC';
    END IF;

    -- 3. No public sequence carries any privilege for anon. The CASE keeps
    --    has_sequence_privilege off non-sequences: WHERE gives no order, and on
    --    any other relkind it raises "is not a sequence".
    SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
      INTO offenders
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND CASE WHEN c.relkind = 'S' THEN
                has_sequence_privilege('anon'::name, c.oid, 'USAGE')
             OR has_sequence_privilege('anon'::name, c.oid, 'SELECT')
             OR has_sequence_privilege('anon'::name, c.oid, 'UPDATE')
           ELSE false END;

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION 'anon default privileges: anon still has privileges on sequences: %', offenders;
    END IF;

    -- 4. is_admin() stays callable by anon: a public-read policy calls it.
    IF NOT has_function_privilege('anon'::name, 'public.is_admin()'::regprocedure, 'EXECUTE') THEN
        RAISE EXCEPTION 'anon default privileges: anon lost EXECUTE on public.is_admin()';
    END IF;
END
$verify$;

COMMIT;
