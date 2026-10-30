-- Make public.is_admin() require an aal2 session once the administrator has a
-- verified second factor. Owner decision, 2026-10-25.
--
-- Why: is_admin() is the one place that decides who may write, and until now a
-- stolen or phished password was enough to pass it. With a verified factor of
-- any type enrolled (the site enrols only TOTP), a password-only session (the JWT's `aal` claim is 'aal1') must not
-- be an administrator; only a session that has also presented a code ('aal2')
-- is.
--
-- What changes: one function body. The existing membership test is unchanged
-- and gains a second condition, ANDed to it:
--
--     coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
--     OR NOT EXISTS (verified row in auth.mfa_factors for auth.uid())
--
-- A token with no readable `aal` claim reads as '' and so counts as aal1, the
-- less trusted answer. Signature, LANGUAGE sql, STABLE, SECURITY DEFINER, the
-- pinned search_path and the postgres owner are as they were, and so are the
-- grants: CREATE OR REPLACE keeps them, and this migration adds or revokes
-- none. (The advisors' anon/authenticated EXECUTE warnings on is_admin() are a
-- separate matter, not touched here.)
--
-- Rollout cannot lock the owner out: until a factor is verified the second
-- branch is true and behaviour is exactly what it was. The check bites only
-- after enrolment, when the owner has an authenticator to present.
--
-- A stolen password cannot remove the factor to get back to aal1: GoTrue
-- refuses to enrol or unenrol a factor from an aal1 session once a verified
-- factor exists.
--
-- Recovery if the authenticator is lost: delete the row in auth.mfa_factors
-- from the dashboard or the SQL editor (postgres / service role). With no
-- verified factor the function is back to password-only, and the owner signs
-- in and enrols a new one.
--
-- Callers: every admin RLS policy asks (SELECT public.is_admin()), and the edge
-- functions ask it through requireAdmin() (supabase/functions/_shared/
-- require-admin.ts) with the caller's own JWT, so they read the same `aal`
-- claim. The service role does not go through this function. The policies
-- themselves are untouched, so the InitPlan wrapping that
-- src/integrations/supabase/rls-admin-check.test.ts enforces is unaffected.
--
-- Privilege: the function is SECURITY DEFINER and owned by postgres, so it
-- reads auth.mfa_factors as postgres, not as the caller; neither anon nor
-- authenticated needs any grant on the auth schema. The migration refuses to
-- commit if postgres cannot SELECT from auth.mfa_factors, because a function
-- that raised "permission denied" for every aal1 caller would deny the whole
-- admin surface rather than only the unverified sessions.
--
-- supabase/schemas/01_functions.sql holds the same definition.
BEGIN;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  )
  AND (
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND status = 'verified'
    )
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

DO $$
DECLARE
    fn pg_catalog.pg_proc%ROWTYPE;
BEGIN
    SELECT * INTO fn FROM pg_catalog.pg_proc WHERE oid = 'public.is_admin()'::pg_catalog.regprocedure;

    IF NOT fn.prosecdef THEN
        RAISE EXCEPTION 'Post-check failed: is_admin() is not SECURITY DEFINER';
    END IF;

    IF fn.provolatile <> 's' THEN
        RAISE EXCEPTION 'Post-check failed: is_admin() is not STABLE';
    END IF;

    IF pg_catalog.pg_get_userbyid(fn.proowner) <> 'postgres' THEN
        RAISE EXCEPTION 'Post-check failed: is_admin() is not owned by postgres';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.unnest(fn.proconfig) AS setting WHERE setting LIKE 'search_path=%'
    ) THEN
        RAISE EXCEPTION 'Post-check failed: is_admin() has no pinned search_path';
    END IF;

    IF fn.prosrc NOT LIKE '%aal2%' OR fn.prosrc NOT LIKE '%auth.mfa_factors%' THEN
        RAISE EXCEPTION 'Post-check failed: is_admin() does not carry the aal2 check';
    END IF;

    IF NOT pg_catalog.has_table_privilege('postgres', 'auth.mfa_factors', 'SELECT') THEN
        RAISE EXCEPTION 'Post-check failed: postgres cannot SELECT from auth.mfa_factors';
    END IF;
END
$$;

COMMIT;
