-- A pay date does not identify a payslip. An employer and a pay date do.
--
-- The original unique index was (profile_id, pay_date), on the assumption that
-- a person is paid once on a given day. That is false whenever employment
-- overlaps: December 2025 has a payslip from UCL and one from Capgemini, both
-- dated the 31st. The second write did not fail -- it replaced the first,
-- which is the worst way for this to be wrong.
--
-- COALESCE, because employer is nullable and NULLs do not compare equal in a
-- plain unique index: two rows with no employer and the same date would both
-- be allowed, which is the same bug wearing a different hat.

BEGIN;

DROP INDEX IF EXISTS "idx_finance_payslips_profile_pay_date";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_payslips_profile_employer_pay_date"
    ON "public"."finance_payslips" ("profile_id", (COALESCE("employer", '')), "pay_date");

COMMIT;
