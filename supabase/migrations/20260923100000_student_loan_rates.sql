-- Student Loans Company interest parameters, versioned by the date they take
-- effect -- same idea as finance_tax_configs being versioned by effective
-- date (20260910061010_tax_config_effective_from.sql). Global reference data:
-- the SLC publishes one set of figures a year, not one per profile, so this
-- table carries is_default and no profile_id, mirroring finance_tax_configs
-- rather than the profile-scoped finance_* tables.
--
-- course_end_date on finance_debts rides along: it is the input that decides
-- when a student loan is first due for repayment (the April after the loan
-- holder leaves the course), and has nowhere else to live.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_student_loan_rates" (
    "id" "text" DEFAULT (gen_random_uuid())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "effective_from" "date" NOT NULL,
    -- RPI used for student loan interest from this date.
    "rpi_percent" numeric NOT NULL,
    -- Prevailing market rate cap; null = no cap in force.
    "cap_percent" numeric,
    -- Income at which Plan 2 interest reaches the full (RPI + margin) rate.
    "plan2_upper_threshold" numeric,
    -- Bank of England base rate, for Plans 1 and 4 (base rate + margin, capped).
    "bank_rate_percent" numeric,
    -- Where the figures were read.
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_student_loan_rates" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_pkey";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_pkey" PRIMARY KEY ("id");

-- One row per scope and effective date -- a later version is inserted, never
-- overwrites an earlier one, exactly as finance_tax_configs_scope_effective_from_key.
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_scope_effective_from_key";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_scope_effective_from_key"
    UNIQUE ("is_default", "effective_from");

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_rpi_percent_check";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_rpi_percent_check"
    CHECK ("rpi_percent" BETWEEN -10 AND 50);

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_cap_percent_check";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_cap_percent_check"
    CHECK ("cap_percent" IS NULL OR "cap_percent" BETWEEN 0 AND 50);

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_plan2_upper_threshold_check";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_plan2_upper_threshold_check"
    CHECK ("plan2_upper_threshold" IS NULL OR "plan2_upper_threshold" > 0);

ALTER TABLE "public"."finance_student_loan_rates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_student_loan_rates";
CREATE POLICY "Admin Only" ON "public"."finance_student_loan_rates"
    TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- Least privilege, not the legacy per-table anon grant pattern elsewhere in
-- 40_finance.sql: this is a finance_* table, so anon gets nothing at all.
-- ALTER DEFAULT PRIVILEGES hands every new table ALL on creation, so both
-- REVOKEs are load-bearing rather than decorative -- see
-- 20260912130000_watchlist_least_privilege_anon.sql for the same reasoning
-- applied to the watchlist tables.
REVOKE ALL ON TABLE "public"."finance_student_loan_rates" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_student_loan_rates" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_student_loan_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_student_loan_rates" TO "service_role";

-- Seeded once, is_default = true, so a rate row exists for any profile
-- without per-profile setup. Re-runnable: a second apply matches nothing on
-- (is_default, effective_from) and does nothing.
INSERT INTO "public"."finance_student_loan_rates"
    ("is_default", "effective_from", "rpi_percent", "cap_percent", "plan2_upper_threshold", "bank_rate_percent", "source")
VALUES
    (true, DATE '2026-09-01', 4.1, 6, 52885, NULL, 'gov.uk/repaying-your-student-loan/what-you-pay, read 2026-09-22')
ON CONFLICT ("is_default", "effective_from") DO NOTHING;

-- Last day of study; sets when a student loan is first due for repayment.
ALTER TABLE "public"."finance_debts"
    ADD COLUMN IF NOT EXISTS "course_end_date" "date";

COMMIT;
