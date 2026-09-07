-- Payslips, captured as figures rather than sent anywhere (REHAUL_PLAN.md 7.P).
--
-- The PDF is an archive: it lives in the private finance-documents bucket so it
-- can be downloaded in five years when a mortgage application asks for it, and
-- `storage_path` points at it. Nothing uploads it to a model. What the app
-- actually uses is the columns below, which it renders its own payslip view
-- from -- sortable, chartable, comparable, which a PDF viewer is not.
--
-- The figures are also what makes 7.N honest. The student loan deduction is
-- currently modelled twice, in calculateFinance and again inside
-- projectDebtBalance, and neither reads what was actually taken. This is where
-- the real number comes from.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_payslips" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,

    -- The date the money arrived. Payslips are identified by it in practice,
    -- and it is what every trend is plotted against.
    "pay_date" "date" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "employer" "text",

    "gross" numeric DEFAULT 0 NOT NULL,
    "income_tax" numeric DEFAULT 0 NOT NULL,
    "national_insurance" numeric DEFAULT 0 NOT NULL,
    -- Split, because only the employee's share is a deduction from gross --
    -- the employer's is neither paid by you nor subtracted from your pay, and
    -- adding the two together is the classic way to make net not reconcile.
    "pension_employee" numeric DEFAULT 0 NOT NULL,
    "pension_employer" numeric DEFAULT 0 NOT NULL,
    "student_loan" numeric DEFAULT 0 NOT NULL,
    "other_deductions" numeric DEFAULT 0 NOT NULL,
    "net" numeric DEFAULT 0 NOT NULL,

    -- Nullable: a payslip typed in by hand is a complete record on its own.
    -- The PDF is an archive, not a prerequisite.
    "storage_path" "text",
    "notes" "text",

    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_payslips" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_pkey";
ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_pkey" PRIMARY KEY ("id");

-- No is_default column: a payslip is never a template, so profile_id is
-- plainly NOT NULL rather than conditioned on one, as with
-- finance_truelayer_connection.
ALTER TABLE ONLY "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_profile_id_fkey";
ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- One payslip per profile per pay date. Re-capturing the same month should
-- correct the row rather than quietly create a second one that doubles every
-- total derived from it.
DROP INDEX IF EXISTS "idx_finance_payslips_profile_pay_date";
CREATE UNIQUE INDEX "idx_finance_payslips_profile_pay_date"
    ON "public"."finance_payslips" ("profile_id", "pay_date");

-- Money is never negative here; a deduction is expressed by which column it is
-- in, not by its sign. A negative would silently flip a total.
ALTER TABLE "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_non_negative_check";
ALTER TABLE "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_non_negative_check" CHECK (
        "gross" >= 0 AND "income_tax" >= 0 AND "national_insurance" >= 0
        AND "pension_employee" >= 0 AND "pension_employer" >= 0
        AND "student_loan" >= 0 AND "other_deductions" >= 0 AND "net" >= 0
    );

ALTER TABLE "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_period_check";
ALTER TABLE "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_period_check" CHECK (
        "period_start" IS NULL OR "period_end" IS NULL OR "period_start" <= "period_end"
    );

ALTER TABLE "public"."finance_payslips" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_payslips";
CREATE POLICY "Admin Only" ON "public"."finance_payslips"
    TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- S-10: anon holds no write grant on any finance table, this one included.
REVOKE ALL ON TABLE "public"."finance_payslips" FROM "anon";
GRANT ALL ON TABLE "public"."finance_payslips" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payslips" TO "service_role";

COMMIT;
