-- Add date-mode scheduling while retaining existing weekly schedule rows.
-- Existing rows become explicit weekly entries through the default and keep
-- their current day_of_week unchanged.

BEGIN;

ALTER TABLE "public"."weekly_schedule"
    ADD COLUMN IF NOT EXISTS "scheduled_date" date;

ALTER TABLE "public"."weekly_schedule"
    ADD COLUMN IF NOT EXISTS "schedule_mode" text DEFAULT 'weekly'::text NOT NULL;

ALTER TABLE "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_schedule_mode_check"
    CHECK ("schedule_mode" = ANY (ARRAY['weekly'::text, 'date'::text]));

CREATE INDEX IF NOT EXISTS "idx_weekly_schedule_scheduled_date"
    ON "public"."weekly_schedule" USING "btree" ("scheduled_date")
    WHERE ("schedule_mode" = 'date'::text);

COMMENT ON COLUMN "public"."weekly_schedule"."scheduled_date" IS
    'Optional one-off calendar date. NULL is used by recurring weekly entries.';

COMMENT ON COLUMN "public"."weekly_schedule"."schedule_mode" IS
    'weekly keeps a title on its release weekday; date places it on scheduled_date once.';

COMMIT;
