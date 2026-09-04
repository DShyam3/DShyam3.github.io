CREATE TABLE IF NOT EXISTS "public"."creators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "link" "text",
    "category" "text" DEFAULT 'artist'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."creators" OWNER TO "postgres";

ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."creators" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."creators" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."creators" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."creators" FOR SELECT USING (true);

ALTER TABLE "public"."creators" ENABLE ROW LEVEL SECURITY;
