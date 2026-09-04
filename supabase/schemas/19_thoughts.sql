CREATE TABLE IF NOT EXISTS "public"."thoughts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text",
    "body" "text",
    "image_url" "text",
    "category" "text" DEFAULT 'essay'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."thoughts" OWNER TO "postgres";

ALTER TABLE ONLY "public"."thoughts"
    ADD CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id");

CREATE POLICY "Public Read Access" ON "public"."thoughts" FOR SELECT USING (true);

CREATE POLICY "Admin insert" ON "public"."thoughts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."thoughts" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."thoughts" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

ALTER TABLE "public"."thoughts" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."thoughts" TO "anon";

GRANT ALL ON TABLE "public"."thoughts" TO "authenticated";

GRANT ALL ON TABLE "public"."thoughts" TO "service_role";
