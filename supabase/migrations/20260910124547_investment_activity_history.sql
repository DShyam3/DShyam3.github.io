-- Normalised, confirmed broker/exchange activity. The original CSV stays in
-- the browser; this ledger keeps only the facts needed for a personal finance
-- timeline and re-import identity.

BEGIN;

CREATE TABLE "public"."finance_investment_activities" (
    "id" text NOT NULL,
    "profile_id" uuid NOT NULL,
    "account_id" text NOT NULL,
    "provider" text NOT NULL,
    "activity_type" text NOT NULL,
    "occurred_on" date NOT NULL,
    "name" text NOT NULL,
    "ticker" text,
    "quantity" numeric NOT NULL,
    "unit_price_gbp" numeric,
    "source_reference" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "finance_investment_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_investment_activities_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "finance_investment_activities_account_profile_fkey"
        FOREIGN KEY ("account_id", "profile_id")
        REFERENCES "public"."finance_bank_accounts"("id", "profile_id") ON DELETE CASCADE,
    CONSTRAINT "finance_investment_activities_provider_check"
        CHECK ("provider" IN ('trading212', 'kraken')),
    CONSTRAINT "finance_investment_activities_activity_type_check"
        CHECK ("activity_type" IN ('buy', 'sell')),
    CONSTRAINT "finance_investment_activities_name_check"
        CHECK (length(btrim("name")) > 0),
    CONSTRAINT "finance_investment_activities_quantity_check"
        CHECK ("quantity" > 0),
    CONSTRAINT "finance_investment_activities_unit_price_gbp_check"
        CHECK ("unit_price_gbp" IS NULL OR "unit_price_gbp" >= 0),
    CONSTRAINT "finance_investment_activities_source_reference_check"
        CHECK (length(btrim("source_reference")) > 0),
    CONSTRAINT "finance_investment_activities_source_unique"
        UNIQUE ("profile_id", "account_id", "provider", "source_reference")
);

CREATE INDEX "idx_finance_investment_activities_account_profile_occurred_on"
    ON "public"."finance_investment_activities" ("account_id", "profile_id", "occurred_on" DESC);

ALTER TABLE "public"."finance_investment_activities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only"
    ON "public"."finance_investment_activities"
    TO authenticated
    USING ("public"."is_admin"())
    WITH CHECK ("public"."is_admin"());

REVOKE ALL ON TABLE "public"."finance_investment_activities" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_investment_activities" TO authenticated;
GRANT ALL ON TABLE "public"."finance_investment_activities" TO service_role;

COMMENT ON TABLE "public"."finance_investment_activities" IS
    'Confirmed buy and sell activity imported locally from supported broker/exchange CSV files; original exports are not stored.';

COMMIT;
