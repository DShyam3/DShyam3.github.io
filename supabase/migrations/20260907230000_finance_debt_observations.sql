-- Debt balance observations, drift tracking, and SLC statement lag handling (REHAUL_PLAN.md 7.N).
--
-- Anchors a loan balance to a known date (e.g. statement date or portal check),
-- allowing forward projections to step from evidence rather than a mutable floating number.
-- Calculates balance drift and implied interest rates upon subsequent reconciliations.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_debt_observations" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "debt_id" "text" NOT NULL,

    -- Date the figure was checked/recorded
    "observed_on" "date" NOT NULL,

    -- Balance owed on the statement/effective date
    "balance" numeric DEFAULT 0 NOT NULL,

    -- Origin: manual input, official annual statement, or open banking / provider
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,

    -- Statement date: crucial for SLC (Student Loans Company) where annual statements
    -- reflect a balance as-of March/April, lagging portal checks by up to 18 months.
    -- If null, defaults to observed_on.
    "statement_date" "date",

    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_debt_observations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_pkey";
ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_profile_id_fkey";
ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_debt_id_fkey";
ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_debt_id_fkey"
    FOREIGN KEY ("debt_id") REFERENCES "public"."finance_debts"("id") ON DELETE CASCADE;

DROP INDEX IF EXISTS "idx_debt_observations_profile_debt";
CREATE INDEX "idx_debt_observations_profile_debt"
    ON "public"."finance_debt_observations" ("profile_id", "debt_id", "observed_on" DESC);

ALTER TABLE "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_balance_check";
ALTER TABLE "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_balance_check" CHECK ("balance" >= 0);

ALTER TABLE "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_source_check";
ALTER TABLE "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_source_check"
    CHECK ("source" IN ('manual', 'statement', 'provider'));

-- Add rate_periods and final_payment columns to finance_debts (7.N Step D2 & Step E)
ALTER TABLE "public"."finance_debts"
    ADD COLUMN IF NOT EXISTS "rate_periods" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL;

ALTER TABLE "public"."finance_debts"
    ADD COLUMN IF NOT EXISTS "final_payment" numeric DEFAULT 0 NOT NULL;

ALTER TABLE "public"."finance_debts"
    DROP CONSTRAINT IF EXISTS "finance_debts_final_payment_check";
ALTER TABLE "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_final_payment_check" CHECK ("final_payment" >= 0);

ALTER TABLE "public"."finance_debt_observations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_debt_observations";
CREATE POLICY "Admin Only" ON "public"."finance_debt_observations"
    TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

REVOKE ALL ON TABLE "public"."finance_debt_observations" FROM "anon";
GRANT ALL ON TABLE "public"."finance_debt_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_debt_observations" TO "service_role";

COMMIT;
