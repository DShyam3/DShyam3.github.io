-- Backfill finance_student_loan_rates with the full Plan 2/3 rate history
-- rather than only the current row, so a debt's interest can be recomputed
-- for any past effective date instead of falling back to today's figures.
-- Also adds plan2_lower_threshold, the repayment threshold below which Plan
-- 2 interest is RPI only -- the SLC publishes it alongside the upper
-- threshold and rate figures already on this table.
--
-- Figures are read from the cited gov.uk announcements and cross-checked
-- against https://www.gov.uk/guidance/how-interest-is-calculated-plan-2. A
-- row is valid from its effective_from date until the next row's date; the
-- app treats a row as valid for 12 months at most.

BEGIN;

ALTER TABLE "public"."finance_student_loan_rates"
    ADD COLUMN IF NOT EXISTS "plan2_lower_threshold" numeric;

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    DROP CONSTRAINT IF EXISTS "finance_student_loan_rates_plan2_lower_threshold_check";
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_plan2_lower_threshold_check"
    CHECK ("plan2_lower_threshold" IS NULL OR "plan2_lower_threshold" > 0);

COMMENT ON COLUMN "public"."finance_student_loan_rates"."plan2_lower_threshold" IS
    'Plan 2 income at or below which interest is RPI only (the Plan 2 repayment threshold for that tax year).';

-- Re-runnable: ON CONFLICT (is_default, effective_from) updates every value
-- column plus source and updated_at, so a second apply refreshes figures in
-- place rather than duplicating rows. This also backfills
-- plan2_lower_threshold and a fuller source on the 2026-09-01 row seeded by
-- 20260923100000_student_loan_rates.sql.
INSERT INTO "public"."finance_student_loan_rates"
    ("is_default", "effective_from", "rpi_percent", "cap_percent", "plan2_lower_threshold", "plan2_upper_threshold", "bank_rate_percent", "source")
VALUES
    (true, DATE '2020-04-06', 2.4,  NULL, 26575, 47835, NULL, 'https://www.gov.uk/government/news/student-loans-interest-and-repayment-threshold-announcement'),
    (true, DATE '2020-09-01', 2.6,  NULL, 26575, 47835, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement'),
    (true, DATE '2021-04-06', 2.6,  NULL, 27295, 49130, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement'),
    (true, DATE '2021-07-01', 2.6,  5.3,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-the-plan-3-student-loan-interest-rates'),
    (true, DATE '2021-09-01', 1.5,  4.2,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-the-plan-3-student-loan-interest-rates'),
    (true, DATE '2021-10-01', 1.5,  4.1,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-the-postgraduate-student-loan-interest-rates'),
    (true, DATE '2022-01-01', 1.5,  4.4,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-plan-3-student-loan-interest-rates'),
    (true, DATE '2022-03-01', 1.5,  NULL, 27295, 49130, NULL, 'https://www.gov.uk/guidance/how-interest-is-calculated-plan-2'),
    (true, DATE '2022-09-01', 9.0,  6.3,  27295, 49130, NULL, 'https://www.gov.uk/government/news/student-loan-interest-rates-cut-again-due-to-market-rates'),
    (true, DATE '2022-12-01', 9.0,  6.5,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-plan-3-student-loan-interest-rates--2'),
    (true, DATE '2023-03-01', 9.0,  6.9,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-and-postgraduate-student-loan-interest-rates'),
    (true, DATE '2023-06-01', 9.0,  7.1,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-maximum-plan-2-plan-5-and-postgraduate-student-loan-interest-rates'),
    (true, DATE '2023-09-01', 13.5, 7.3,  27295, 49130, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--4'),
    (true, DATE '2023-12-01', 13.5, 7.5,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-postgraduate-pg-student-loan-interest-rates-announcement'),
    (true, DATE '2024-01-01', 13.5, 7.6,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-postgraduate-pg-student-loan-interest-rates-announcement--2'),
    (true, DATE '2024-03-01', 13.5, 7.7,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-plan-3-postgraduate-pg-student-loan-interest-rates-announcement--2'),
    (true, DATE '2024-04-01', 13.5, 7.8,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-plan-3-postgraduate-pg-student-loan-interest-rates-announcement--3'),
    (true, DATE '2024-06-01', 13.5, 7.9,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-plan-3-postgraduate-pg-student-loan-interest-rates-announcement--5'),
    (true, DATE '2024-08-01', 13.5, 8.0,  27295, 49130, NULL, 'https://www.gov.uk/government/news/change-to-the-plan-2-plan-5-and-plan-3-postgraduate-pg-student-loan-interest-rates-announcement--7'),
    (true, DATE '2024-09-01', 4.3,  NULL, 27295, 49130, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--5'),
    (true, DATE '2025-04-06', 4.3,  NULL, 28470, 51245, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--5'),
    (true, DATE '2025-09-01', 3.2,  NULL, 28470, 51245, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--6'),
    (true, DATE '2026-04-06', 3.2,  NULL, 29385, 52885, NULL, 'https://www.gov.uk/government/news/student-loans-interest-and-repayment-threshold-announcement-for-plan-2-and-plan-3-loans'),
    (true, DATE '2026-09-01', 4.1,  6.0,  29385, 52885, NULL, 'https://www.gov.uk/government/news/student-loans-interest-rates-and-repayment-threshold-announcement--7')
ON CONFLICT ("is_default", "effective_from") DO UPDATE SET
    "rpi_percent" = EXCLUDED."rpi_percent",
    "cap_percent" = EXCLUDED."cap_percent",
    "plan2_lower_threshold" = EXCLUDED."plan2_lower_threshold",
    "plan2_upper_threshold" = EXCLUDED."plan2_upper_threshold",
    "bank_rate_percent" = EXCLUDED."bank_rate_percent",
    "source" = EXCLUDED."source",
    "updated_at" = "now"();

COMMIT;
