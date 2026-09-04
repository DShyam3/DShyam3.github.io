CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "link" "text",
    "image_url" "text",
    "notes" "text",
    "category" "text" DEFAULT 'articles'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."articles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."articles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."articles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."articles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."articles" FOR SELECT USING (true);

ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."articles" TO "anon";

GRANT ALL ON TABLE "public"."articles" TO "authenticated";

GRANT ALL ON TABLE "public"."articles" TO "service_role";
