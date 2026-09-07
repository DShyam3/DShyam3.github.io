-- Retirement planning inputs, on the profile beside region and currency.
--
-- The projection needs three things the ledger cannot tell it: how old you
-- are, when you intend to stop, and what real growth to assume. They were
-- browser state, so they reset on reload and differed between profiles that
-- share a screen -- which is wrong for a figure people plan around.
--
-- Birth *year* rather than a full date: a year is all the projection needs,
-- and profiles may hold family members, so the less identifying column is the
-- proportionate one.

BEGIN;

ALTER TABLE "public"."finance_profiles"
    ADD COLUMN IF NOT EXISTS "birth_year" integer;

ALTER TABLE "public"."finance_profiles"
    ADD COLUMN IF NOT EXISTS "retirement_age" integer DEFAULT 68 NOT NULL;

ALTER TABLE "public"."finance_profiles"
    ADD COLUMN IF NOT EXISTS "pension_growth_percent" numeric DEFAULT 4.5 NOT NULL;

COMMENT ON COLUMN "public"."finance_profiles"."birth_year" IS
  'Year of birth. A year is all the pension projection needs, and profiles may '
  'hold family members, so nothing more precise is stored.';

COMMENT ON COLUMN "public"."finance_profiles"."retirement_age" IS
  'Age the pension is projected to. Defaults to the UK state pension age.';

COMMENT ON COLUMN "public"."finance_profiles"."pension_growth_percent" IS
  'Assumed annual growth AFTER inflation, so projections are in today''s money. '
  'Long-run global equity returns sit around 4-5% real.';

-- A projection to an age you have already passed is not a projection, and a
-- birth year outside living memory is a typo rather than a fact.
ALTER TABLE "public"."finance_profiles"
    DROP CONSTRAINT IF EXISTS "finance_profiles_retirement_age_check";
ALTER TABLE "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_retirement_age_check"
    CHECK ("retirement_age" BETWEEN 40 AND 100);

ALTER TABLE "public"."finance_profiles"
    DROP CONSTRAINT IF EXISTS "finance_profiles_birth_year_check";
ALTER TABLE "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_birth_year_check"
    CHECK ("birth_year" IS NULL OR "birth_year" BETWEEN 1900 AND 2100);

COMMIT;
