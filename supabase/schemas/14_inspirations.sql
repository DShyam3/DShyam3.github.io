CREATE TABLE IF NOT EXISTS "public"."inspirations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "link" "text",
    "description" "text",
    "category" "text" DEFAULT 'creators'::"text" NOT NULL,
    "why_i_like" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."inspirations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."inspirations"
    ADD CONSTRAINT "inspirations_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."inspirations" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."inspirations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."inspirations" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."inspirations" FOR SELECT USING (true);

ALTER TABLE "public"."inspirations" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."inspirations" TO "anon";

GRANT ALL ON TABLE "public"."inspirations" TO "authenticated";

GRANT ALL ON TABLE "public"."inspirations" TO "service_role";
