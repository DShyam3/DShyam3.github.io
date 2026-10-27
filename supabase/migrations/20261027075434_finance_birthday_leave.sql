-- Birthday Day Off leave benefit, birthday eligibility window (month/day only,
-- never a full date of birth), and contractual package benefits persistence on
-- finance_settings; extends finance_user_holidays.type to allow 'birthday'.

BEGIN;

ALTER TABLE "public"."finance_settings"
    ADD COLUMN IF NOT EXISTS "birthday_leave_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "birthday_leave_rule" "text" DEFAULT 'within_week'::"text" NOT NULL,
    ADD COLUMN IF NOT EXISTS "birthday_month" integer,
    ADD COLUMN IF NOT EXISTS "birthday_day" integer,
    ADD COLUMN IF NOT EXISTS "package_benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'finance_settings_birthday_leave_rule_check'
          AND conrelid = 'public.finance_settings'::regclass
    ) THEN
        ALTER TABLE ONLY "public"."finance_settings"
            ADD CONSTRAINT "finance_settings_birthday_leave_rule_check"
            CHECK ("birthday_leave_rule" IN ('exact_or_nearest', 'within_week', 'birthday_month', 'within_month', 'anytime'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'finance_settings_birthday_month_check'
          AND conrelid = 'public.finance_settings'::regclass
    ) THEN
        ALTER TABLE ONLY "public"."finance_settings"
            ADD CONSTRAINT "finance_settings_birthday_month_check"
            CHECK ("birthday_month" IS NULL OR ("birthday_month" >= 1 AND "birthday_month" <= 12));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'finance_settings_birthday_day_check'
          AND conrelid = 'public.finance_settings'::regclass
    ) THEN
        ALTER TABLE ONLY "public"."finance_settings"
            ADD CONSTRAINT "finance_settings_birthday_day_check"
            CHECK ("birthday_day" IS NULL OR ("birthday_day" >= 1 AND "birthday_day" <= 31));
    END IF;
END
$$;

ALTER TABLE ONLY "public"."finance_user_holidays"
    DROP CONSTRAINT IF EXISTS "finance_user_holidays_type_check";

ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_type_check"
    CHECK ("type" IN ('holiday', 'sick', 'birthday'));

COMMENT ON COLUMN "public"."finance_settings"."birthday_leave_enabled" IS
    'Whether the profile receives an extra paid Birthday Day Off benefit on top of standard work_holidays.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_leave_rule" IS
    'Employer rule governing when the paid Birthday Day Off may be taken: exact_or_nearest, within_week, birthday_month, within_month, or anytime.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_month" IS
    'Calendar month of birth (1..12) used only to compute the Birthday Day Off eligibility window; never a full date of birth.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_day" IS
    'Day of month of birth (1..31) used only to compute the Birthday Day Off eligibility window; never a full date of birth.';

COMMENT ON COLUMN "public"."finance_settings"."package_benefits" IS
    'Contractual employer package benefits (JSON array of benefit items) tracked for total package valuation and comparison.';

COMMENT ON COLUMN "public"."finance_user_holidays"."type" IS
    'Leave type: "holiday" (counts against annual holiday allowance), "sick" (tracked separately as sick leave taken), or "birthday" (paid birthday day off benefit, does not consume standard holiday allowance).';

COMMIT;
