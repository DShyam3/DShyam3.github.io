-- Add type column to finance_user_holidays to distinguish between annual leave/holidays and sick days.
-- Defaults to 'holiday' for all existing rows.

BEGIN;

ALTER TABLE "public"."finance_user_holidays"
    ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'holiday' NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'finance_user_holidays_type_check'
    ) THEN
        ALTER TABLE "public"."finance_user_holidays"
            ADD CONSTRAINT "finance_user_holidays_type_check"
            CHECK ("type" IN ('holiday', 'sick'));
    END IF;
END $$;

COMMENT ON COLUMN "public"."finance_user_holidays"."type" IS
    'Leave type: "holiday" (counts against annual holiday allowance) or "sick" (tracked separately as sick leave taken).';

COMMIT;
