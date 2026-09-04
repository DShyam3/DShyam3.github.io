CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text" DEFAULT 'tech-edc'::"text" NOT NULL,
    "price" numeric,
    "image" "text",
    "is_new" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link" "text",
    "subcategory" "text",
    "is_wishlist" boolean DEFAULT false,
    "description" "text"
);

ALTER TABLE "public"."inventory_items" OWNER TO "postgres";

ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."inventory_items" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."inventory_items" FOR SELECT USING (true);

ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT ALL ON TABLE "public"."inventory_items" TO "anon";

GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";

GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";
