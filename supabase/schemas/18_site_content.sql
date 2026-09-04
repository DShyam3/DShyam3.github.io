CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "section" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "order" integer DEFAULT 0
);

ALTER TABLE "public"."site_content" OWNER TO "postgres";

ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("key");

CREATE POLICY "Admin delete" ON "public"."site_content" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."site_content" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."site_content" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Site Content" ON "public"."site_content" FOR SELECT USING (true);

ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;
