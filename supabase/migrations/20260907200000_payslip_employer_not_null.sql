-- Make the payslip key a plain index, so ON CONFLICT can name it.
--
-- The previous migration keyed on (profile_id, COALESCE(employer,''), pay_date)
-- to stop two NULL employers colliding. Correct as a constraint and useless as
-- an upsert target: Postgres will not match ON CONFLICT (profile_id, employer,
-- pay_date) to an expression index, so every save failed with "no unique or
-- exclusion constraint matching the ON CONFLICT specification".
--
-- Making the column NOT NULL DEFAULT '' says the same thing without an
-- expression. An unknown employer is the empty string rather than NULL, which
-- is also more honest about how it is used: the app already renders a missing
-- employer as nothing.

BEGIN;

UPDATE "public"."finance_payslips" SET "employer" = '' WHERE "employer" IS NULL;

ALTER TABLE "public"."finance_payslips"
    ALTER COLUMN "employer" SET DEFAULT '';
ALTER TABLE "public"."finance_payslips"
    ALTER COLUMN "employer" SET NOT NULL;

DROP INDEX IF EXISTS "idx_finance_payslips_profile_employer_pay_date";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_payslips_profile_employer_pay_date"
    ON "public"."finance_payslips" ("profile_id", "employer", "pay_date");

COMMIT;
