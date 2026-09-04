CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "link" "text",
    "is_personal" boolean DEFAULT true NOT NULL,
    "ingredients" "text",
    "instructions" "text",
    "category" "text" DEFAULT 'main'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."recipes" OWNER TO "postgres";

ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."recipes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."recipes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."recipes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."recipes" FOR SELECT USING (true);

ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."recipes" TO "anon";

GRANT ALL ON TABLE "public"."recipes" TO "authenticated";

GRANT ALL ON TABLE "public"."recipes" TO "service_role";
