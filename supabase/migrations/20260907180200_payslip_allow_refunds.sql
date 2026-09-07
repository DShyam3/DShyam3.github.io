-- Deductions may be negative, because a refund is a real thing.
--
-- The original check required every money column to be >= 0, on the reasoning
-- that a deduction is expressed by which column it is in rather than by its
-- sign. That is true of the ordinary case and wrong in general: PAYE can
-- refund, and a payslip then prints "Tax -52.00" and a net larger than gross.
-- The constraint rejected exactly those months, which are the ones most worth
-- recording.
--
-- What stays non-negative is what genuinely cannot be negative. Gross pay is
-- not a refund, and a pension contribution is a magnitude -- the parser stores
-- it as one, since a salary sacrifice prints negative only because the
-- payments column subtracts it.

BEGIN;

ALTER TABLE "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_non_negative_check";

ALTER TABLE "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_non_negative_check" CHECK (
        "gross" >= 0 AND "pension_employee" >= 0 AND "pension_employer" >= 0
    );

COMMENT ON CONSTRAINT "finance_payslips_non_negative_check" ON "public"."finance_payslips" IS
  'Income tax, National Insurance, student loan, other deductions and net are '
  'deliberately unconstrained: each can legitimately be negative when a refund '
  'or an adjustment runs through payroll.';

COMMIT;
