CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."photos" OWNER TO "postgres";

ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."photos" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."photos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."photos" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."photos" FOR SELECT USING (true);

ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."photos" TO "anon";

GRANT ALL ON TABLE "public"."photos" TO "authenticated";

GRANT ALL ON TABLE "public"."photos" TO "service_role";
