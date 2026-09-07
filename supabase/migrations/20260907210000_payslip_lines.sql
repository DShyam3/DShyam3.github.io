-- The payslip's own line items, beside the summary columns.
--
-- The seven money columns are what everything computes from, and they have to
-- stay: they are what reconciles, and what the tax comparison reads. But they
-- are a summary, and a summary loses things worth keeping. One Capgemini
-- payslip carries a gym membership and a separate gym arrears charge, both
-- folded into other_deductions as £167.93 -- a number that appears in the app
-- as if it were one thing and is not.
--
-- So the lines are stored as they were written: a label, an amount, and which
-- side of the payslip it came from. Nothing derives from this; it is what the
-- detail view shows, and what stops a question like "what is that £167.93"
-- needing the PDF reopened.

BEGIN;

ALTER TABLE "public"."finance_payslips"
    ADD COLUMN IF NOT EXISTS "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL;

COMMENT ON COLUMN "public"."finance_payslips"."lines" IS
  'Line items as the payslip states them: [{ label, amount, kind }], where kind '
  'is payment | deduction | benefit. A benefit is a sacrifice taken from the pay '
  'column -- pension, a gym membership -- which reduces pay without appearing '
  'under deductions. Empty when a payslip was captured by hand.';

-- Kept deliberately loose. A payslip may list anything, and a CHECK enumerating
-- today's labels would reject tomorrow's.
ALTER TABLE "public"."finance_payslips"
    DROP CONSTRAINT IF EXISTS "finance_payslips_lines_is_array";
ALTER TABLE "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_lines_is_array"
    CHECK (jsonb_typeof("lines") = 'array');

COMMIT;
