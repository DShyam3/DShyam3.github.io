-- Two facts the scenario engine was inferring.
--
-- "Can I afford this?" depends on what the emergency fund is meant to hold and
-- on what each goal receives monthly. Neither was stored, so the engine matched
-- the emergency fund by the name `/emergency/i` and averaged a goal's last
-- three contributions to guess its monthly rate. Both are visible in the
-- What-if surface's assumptions panel, which is honest, but a name match is a
-- guess that changes the verdict when it is wrong — and an AI layer citing an
-- inferred figure is worse than a panel that admits to one.
--
-- The backfill reproduces exactly what the inference did, so behaviour does not
-- change on the day this lands; only its provenance does.

BEGIN;

ALTER TABLE "public"."finance_goals"
    ADD COLUMN IF NOT EXISTS "is_emergency_fund" boolean DEFAULT false NOT NULL;

ALTER TABLE "public"."finance_goals"
    ADD COLUMN IF NOT EXISTS "monthly_contribution" numeric DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."finance_goals"."is_emergency_fund" IS
  'The goal that represents this profile''s emergency reserve. Scenario runs '
  'treat its target as the floor cash should not fall below.';

COMMENT ON COLUMN "public"."finance_goals"."monthly_contribution" IS
  'What this goal is intended to receive each month. Used to work out how far '
  'a hypothetical spend pushes the goal back; 0 means unfunded.';

-- One emergency fund per profile. Template rows carry a null profile_id and
-- several nulls are distinct to a unique index, so they are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_goals_one_emergency_fund"
    ON "public"."finance_goals" ("profile_id")
    WHERE "is_emergency_fund";

-- Backfill 1: the same name match the code was doing, oldest goal wins where a
-- profile somehow has two, so the unique index cannot be violated.
UPDATE "public"."finance_goals" SET "is_emergency_fund" = true
 WHERE "id" IN (
   SELECT DISTINCT ON ("profile_id") "id"
     FROM "public"."finance_goals"
    WHERE "name" ~* 'emergency'
      AND "profile_id" IS NOT NULL
      AND COALESCE("status", 'active') <> 'archived'
    ORDER BY "profile_id", "created_at"
 );

-- Backfill 2: the same three-contribution average the code was doing.
UPDATE "public"."finance_goals" g
   SET "monthly_contribution" = ROUND(a."avg_amount", 2)
  FROM (
    SELECT "goal_id", AVG("amount") AS "avg_amount"
      FROM (
        SELECT "goal_id",
               "amount",
               ROW_NUMBER() OVER (PARTITION BY "goal_id" ORDER BY "date" DESC) AS rn
          FROM "public"."finance_goal_contributions"
      ) ranked
     WHERE rn <= 3
     GROUP BY "goal_id"
  ) a
 WHERE a."goal_id" = g."id";

COMMIT;
