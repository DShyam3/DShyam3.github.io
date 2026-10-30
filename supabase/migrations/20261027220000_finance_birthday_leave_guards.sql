-- Database guards for the Birthday Day Off and package benefits data added in
-- 20261027075434_finance_birthday_leave.sql. That migration added the columns
-- and the loose range checks; the client enforces the rest, and a client check
-- is a UX nicety rather than a guarantee. These make the impossible rows
-- impossible in the table itself.
--
--   finance_user_holidays   a birthday booking is one day, full or half
--   finance_settings        birthday_month / birthday_day are a pair, and the
--                           pair is a day that exists in some year
--   finance_settings        package_benefits is a JSON array
--
-- Adding a CHECK validates every existing row, so this migration fails (and
-- rolls back whole) rather than half-apply if a row already breaks one. To
-- check first, every count here should be 0:
--
--   select
--     (select count(*) from public.finance_user_holidays where type = 'birthday'
--        and not (start_date = end_date and ((count = 1 and half_day is null)
--                 or (count = 0.5 and half_day is not null)))),
--     (select count(*) from public.finance_settings
--        where (birthday_month is null) <> (birthday_day is null)),
--     (select count(*) from public.finance_settings where birthday_day is not null
--        and not (birthday_day >= 1 and birthday_day <= case when birthday_month = 2 then 29
--                 when birthday_month in (4,6,9,11) then 30 else 31 end)),
--     (select count(*) from public.finance_settings
--        where jsonb_typeof(package_benefits) is distinct from 'array');
--
-- No RLS or grant change: no table, policy or privilege is created or altered
-- here, so the admin-only policies and the anon/authenticated grants set where
-- each table is defined stand exactly as they were.

BEGIN;

-- A birthday day off is a single day. It is either a full day (count 1, no
-- half) or a half day (count 0.5, with the half named). half_day_check already
-- ties any half to a single date and count 0.5; this closes the other side: a
-- birthday row cannot be a range, cannot be 0 or 2 days, and cannot be a
-- half-count row that forgot which half. Other leave types are untouched.
ALTER TABLE ONLY "public"."finance_user_holidays"
    DROP CONSTRAINT IF EXISTS "finance_user_holidays_birthday_single_day";
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_birthday_single_day"
    CHECK (
        "type" <> 'birthday'
        OR (
            "start_date" = "end_date"
            AND (
                ("count" = 1 AND "half_day" IS NULL)
                OR ("count" = 0.5 AND "half_day" IS NOT NULL)
            )
        )
    );

-- Month and day are a pair: both set or both NULL. Month 1..12 is already
-- enforced by finance_settings_birthday_month_check and is left as it is.
ALTER TABLE ONLY "public"."finance_settings"
    DROP CONSTRAINT IF EXISTS "finance_settings_birthday_pair_check";
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_pair_check"
    CHECK (("birthday_month" IS NULL) = ("birthday_day" IS NULL));

-- Replaces the flat 1..31 day check with one that knows the month: 29 for
-- February (a 29 February birthday is real; the app clamps it in other years),
-- 30 for April, June, September and November, else 31. A NULL month falls
-- through to 31 here, which is harmless because the pair check above rejects a
-- day without a month. The CASE is plain comparisons, so it is immutable.
ALTER TABLE ONLY "public"."finance_settings"
    DROP CONSTRAINT IF EXISTS "finance_settings_birthday_day_check";
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_day_check"
    CHECK (
        "birthday_day" IS NULL
        OR (
            "birthday_day" >= 1
            AND "birthday_day" <= CASE
                WHEN "birthday_month" = 2 THEN 29
                WHEN "birthday_month" IN (4, 6, 9, 11) THEN 30
                ELSE 31
            END
        )
    );

-- package_benefits is a list of benefit items. The column is NOT NULL DEFAULT
-- '[]', so there is no NULL case to allow for. The items themselves stay
-- unconstrained here, for the same reason as finance_payslips.lines: a CHECK
-- enumerating today's benefit shapes would reject tomorrow's.
ALTER TABLE ONLY "public"."finance_settings"
    DROP CONSTRAINT IF EXISTS "finance_settings_package_benefits_is_array";
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_package_benefits_is_array"
    CHECK (jsonb_typeof("package_benefits") = 'array');

COMMIT;
