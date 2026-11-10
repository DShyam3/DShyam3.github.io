CREATE TABLE IF NOT EXISTS "public"."beliefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote" "text" NOT NULL,
    "author" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."beliefs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."beliefs" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."beliefs" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."beliefs" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

-- Unlike the other content tables, beliefs has no public read. It is a private
-- collection and its page is admin-only; hiding it in the UI alone left the
-- rows readable with the publishable key.
CREATE POLICY "Admin read" ON "public"."beliefs" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));

ALTER TABLE "public"."beliefs" ENABLE ROW LEVEL SECURITY;

-- Grants

REVOKE ALL ON TABLE "public"."beliefs" FROM "anon";

REVOKE ALL ON TABLE "public"."beliefs" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."beliefs" TO "authenticated";

GRANT ALL ON TABLE "public"."beliefs" TO "service_role";
