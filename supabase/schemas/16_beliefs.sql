CREATE TABLE IF NOT EXISTS "public"."beliefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote" "text" NOT NULL,
    "author" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."beliefs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."beliefs" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."beliefs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."beliefs" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."beliefs" FOR SELECT USING (true);

ALTER TABLE "public"."beliefs" ENABLE ROW LEVEL SECURITY;
