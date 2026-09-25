-- Add half_day column to finance_user_holidays to record which half of a
-- single-day booking (annual leave or sick) is taken. NULL means a full day
-- or a range; existing rows stay NULL because which half was taken is not
-- recoverable from count/dates alone.

BEGIN;

ALTER TABLE "public"."finance_user_holidays"
    ADD COLUMN IF NOT EXISTS "half_day" text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'finance_user_holidays_half_day_check'
    ) THEN
        ALTER TABLE "public"."finance_user_holidays"
            ADD CONSTRAINT "finance_user_holidays_half_day_check"
            CHECK ("half_day" IS NULL OR ("half_day" IN ('am', 'pm') AND "start_date" = "end_date" AND "count" = 0.5));
    END IF;
END $$;

COMMENT ON COLUMN "public"."finance_user_holidays"."half_day" IS
    'Which half of a single-day booking is taken: "am" (morning) or "pm" (afternoon). NULL for a full day or a range. A half day costs 0.5 days.';

COMMIT;
