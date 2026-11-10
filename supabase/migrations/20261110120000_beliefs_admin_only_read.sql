-- Make public.beliefs readable by administrators only.
--
-- Why. Beliefs is a private collection and its page is admin-only, but that was
-- enforced in the UI alone: the table still carried a "Public Read Access"
-- policy (USING (true)) and an anon SELECT grant, so anyone holding the
-- publishable key could read every row straight from the REST API. Unlike the
-- other content tables, this one has no deliberate public read.
--
-- Two independent layers, both closed:
--   - policy: the public read is replaced by an admin-only SELECT for
--     `authenticated`, written (SELECT is_admin()) so it runs once per
--     statement;
--   - grant: anon's SELECT is revoked (REVOKE ALL leaves it with nothing).
-- The admin insert/update/delete policies, the authenticated grant and the
-- service_role grant are unchanged. Idempotent: safe to re-run.
--
-- The statements below close only what they can name. A read policy under any
-- other name, or a SELECT that reaches anon some other way, would survive
-- them silently, so the file ends with a check that fails closed and rolls
-- the whole change back.
--
-- Mirrors supabase/schemas/16_beliefs.sql.

BEGIN;

DROP POLICY IF EXISTS "Public Read Access" ON "public"."beliefs";

DROP POLICY IF EXISTS "Admin read" ON "public"."beliefs";
CREATE POLICY "Admin read" ON "public"."beliefs" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."beliefs" FROM "anon";

DO $$
DECLARE
  stray text;
BEGIN
  SELECT string_agg(quote_ident(policyname), ', ') INTO stray
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'beliefs'
    AND cmd IN ('SELECT', 'ALL')
    AND (policyname <> 'Admin read' OR roles && ARRAY['anon', 'public']::name[]);

  IF stray IS NOT NULL THEN
    RAISE EXCEPTION 'beliefs still has a read policy other than the admin one: %', stray;
  END IF;

  IF has_table_privilege('anon', 'public.beliefs', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still SELECT from public.beliefs';
  END IF;
END
$$;

COMMIT;
