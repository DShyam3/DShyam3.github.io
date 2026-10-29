-- User-defined merchant pattern matching rules for automated transaction categorisation
-- and merchant renaming, scoped to a finance profile.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "merchant_pattern" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rename_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_category_rules" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_pattern_not_empty"
    CHECK (length(trim("merchant_pattern")) > 0);

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_category_not_empty"
    CHECK (length(trim("category")) > 0);

CREATE INDEX IF NOT EXISTS "idx_finance_category_rules_profile_id"
    ON "public"."finance_category_rules" ("profile_id");

ALTER TABLE "public"."finance_category_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_category_rules"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_category_rules" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_category_rules" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_category_rules" TO "service_role";

COMMENT ON TABLE "public"."finance_category_rules" IS
    'User-defined merchant pattern matching rules for automated transaction categorisation and merchant renaming, scoped to a finance profile.';

COMMIT;
