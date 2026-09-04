CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text" NOT NULL,
    "cover_url" "text",
    "description" "text",
    "link" "text",
    "category" "text" DEFAULT 'favourite'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price" numeric,
    "tags" "text"[]
);

ALTER TABLE "public"."books" OWNER TO "postgres";

ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."books" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."books" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."books" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."books" FOR SELECT USING (true);

ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;
