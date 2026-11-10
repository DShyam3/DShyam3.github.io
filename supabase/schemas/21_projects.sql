-- Things the owner has built or is building, shown on the public Projects page.
-- The page reads the whole table, so there is no index beyond the primary key.
-- `skills` is plain text, a comma-separated list typed by the admin: the form
-- system has no array field, and the page splits it on commas for display.
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

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."projects" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."projects" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Public Read Access" ON "public"."projects" FOR SELECT USING (true);

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

-- Grants

REVOKE ALL ON TABLE "public"."projects" FROM "anon";

GRANT SELECT ON TABLE "public"."projects" TO "anon";

REVOKE ALL ON TABLE "public"."projects" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."projects" TO "authenticated";

GRANT ALL ON TABLE "public"."projects" TO "service_role";
