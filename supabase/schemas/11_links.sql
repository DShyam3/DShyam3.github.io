CREATE TABLE IF NOT EXISTS "public"."links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'productivity'::"text" NOT NULL,
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."links" OWNER TO "postgres";

ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."links" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."links" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."links" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."links" FOR SELECT USING (true);

ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."links" TO "anon";

GRANT ALL ON TABLE "public"."links" TO "authenticated";

GRANT ALL ON TABLE "public"."links" TO "service_role";
