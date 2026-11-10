-- Add public.projects, the table behind the public Projects page.
--
-- A content table: anyone reads, only the administrator writes. The public read
-- (USING (true)) is deliberate. Two independent layers:
--   - policy: admin insert/update/delete for `authenticated`, each written
--     (SELECT is_admin()) so it runs once per statement;
--   - grant: anon ends with SELECT only, authenticated with the four data
--     verbs. TRUNCATE is not filtered by RLS, so the grant is the only guard.
-- `skills` is plain text (a comma-separated list typed by the admin) because
-- the form system has no array field. No index beyond the primary key: the
-- page reads the whole table. Idempotent: safe to re-run.
--
-- The file ends with a check that fails closed and rolls the whole change back.
--
-- Mirrors supabase/schemas/21_projects.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'in-progress'::"text" NOT NULL,
    "summary" "text",
    "url" "text",
    "image" "text",
    "skills" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['done'::"text", 'in-progress'::"text", 'planned'::"text"])))
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass AND conname = 'projects_pkey'
  ) THEN
    ALTER TABLE ONLY "public"."projects"
        ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");
  END IF;
END
$$;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin delete" ON "public"."projects";
CREATE POLICY "Admin delete" ON "public"."projects" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Admin insert" ON "public"."projects";
CREATE POLICY "Admin insert" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Admin update" ON "public"."projects";
CREATE POLICY "Admin update" ON "public"."projects" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Public Read Access" ON "public"."projects";
CREATE POLICY "Public Read Access" ON "public"."projects" FOR SELECT USING (true);

-- Grants

REVOKE ALL ON TABLE "public"."projects" FROM "anon";
GRANT SELECT ON TABLE "public"."projects" TO "anon";

REVOKE ALL ON TABLE "public"."projects" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."projects" TO "authenticated";

GRANT ALL ON TABLE "public"."projects" TO "service_role";

DO $$
DECLARE
  priv text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'projects' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.projects';
  END IF;

  FOREACH priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  LOOP
    IF has_table_privilege('anon', 'public.projects', priv) THEN
      RAISE EXCEPTION 'anon holds % on public.projects; SELECT only is allowed', priv;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('anon', 'public.projects', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot SELECT from public.projects';
  END IF;

  FOREACH priv IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER']
  LOOP
    IF has_table_privilege('authenticated', 'public.projects', priv) THEN
      RAISE EXCEPTION 'authenticated holds % on public.projects', priv;
    END IF;
  END LOOP;

  -- CREATE TABLE IF NOT EXISTS would pass over a table that was already there
  -- in another shape, so the pieces this file relies on are checked by name.
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = 'public.projects'::regclass) <> 4 THEN
    RAISE EXCEPTION 'public.projects does not have exactly its four policies';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass AND conname = 'projects_status_check'
  ) THEN
    RAISE EXCEPTION 'public.projects is missing projects_status_check';
  END IF;
END
$$;

COMMIT;
