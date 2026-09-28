-- Owner-approved 2026-09-25 cleanup of the live shared finance templates.
-- The shared rows (is_default budget items, and every recurring template)
-- seed new profiles and "reset to defaults", but carried one person's
-- choices: a provider folded into an item name ("Phone (O2)"), US services
-- (Hulu, ASPCA, Copilot), personal amounts, and links to budget items that
-- are wrong or do not exist. This makes them generic. The old rows are
-- snapshotted into finance_seed_backup first.
--
-- Re-runnable: every UPDATE/DELETE below matches on id (or name, for
-- finance_recurring_templates, which has no profile_id -- every row is
-- shared) AND the pre-cleanup value, so a second run, or a fresh database
-- that never had these seed rows, is a no-op for every statement except the
-- backup insert, which is separately guarded below. No assertion DO-blocks:
-- a fresh local DB has none of these seed rows, so there is nothing to
-- assert against.

BEGIN;

-- 2a. Backup table -----------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."finance_seed_backup" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "taken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text" NOT NULL,
    "source_table" "text" NOT NULL,
    "row_data" "jsonb" NOT NULL
);

ALTER TABLE "public"."finance_seed_backup" OWNER TO "postgres";

ALTER TABLE "public"."finance_seed_backup" ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: RLS is enabled with nothing granting access, so
-- every role used from the app (anon, authenticated) is denied outright --
-- readable only via the SQL editor or service role. ALTER DEFAULT
-- PRIVILEGES hands every new table ALL to anon and authenticated on
-- creation, so these REVOKEs are load-bearing, not decorative -- the same
-- reasoning as finance_transfer_single_legs in 40_finance.sql. The identity
-- sequence gets the same default grants, so it is revoked too.
REVOKE ALL ON TABLE "public"."finance_seed_backup" FROM "anon", "authenticated";
REVOKE ALL ON SEQUENCE "public"."finance_seed_backup_id_seq" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."finance_seed_backup" TO "service_role";

COMMENT ON TABLE "public"."finance_seed_backup" IS
    'Snapshots of rows about to be changed or deleted by an owner-approved seed-data cleanup, taken before the change so it can be restored by hand if needed. No policies on purpose: RLS is enabled with no policy defined, denying every role used from the app -- readable only via the SQL editor or service role. Dropped by a later migration once the owner confirms a given cleanup is correct.';

-- 2b. Snapshot ------------------------------------------------------------
-- One INSERT ... SELECT per source, each guarded on (reason, source_table)
-- rather than reason alone: three separate statements sharing a single
-- `reason`-only guard would each see the previous statement's freshly
-- inserted rows within the same transaction and skip themselves, backing up
-- nothing past the first table. Scoping the guard to source_table as well
-- keeps each snapshot independent and still makes a re-run a no-op.

INSERT INTO "public"."finance_seed_backup" ("reason", "source_table", "row_data")
SELECT '20260927 shared template cleanup', 'finance_recurring_templates', "to_jsonb"("t")
FROM "public"."finance_recurring_templates" "t"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."finance_seed_backup"
    WHERE "reason" = '20260927 shared template cleanup'
      AND "source_table" = 'finance_recurring_templates'
);

INSERT INTO "public"."finance_seed_backup" ("reason", "source_table", "row_data")
SELECT '20260927 shared template cleanup', 'finance_budget_items', "to_jsonb"("t")
FROM "public"."finance_budget_items" "t"
WHERE "t"."is_default" AND "t"."profile_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."finance_seed_backup"
    WHERE "reason" = '20260927 shared template cleanup'
      AND "source_table" = 'finance_budget_items'
);

INSERT INTO "public"."finance_seed_backup" ("reason", "source_table", "row_data")
SELECT '20260927 shared template cleanup', 'finance_budget_categories', "to_jsonb"("t")
FROM "public"."finance_budget_categories" "t"
WHERE "t"."is_default" AND "t"."profile_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."finance_seed_backup"
    WHERE "reason" = '20260927 shared template cleanup'
      AND "source_table" = 'finance_budget_categories'
);

-- 2c. Shared default budget items -----------------------------------------
-- Generic names: no provider in the item name (a profile's own provider now
-- has a column, see finance_item_provider.sql), and Video Entertainment
-- becomes one row per service: Netflix, Prime Video, Disney+, Apple TV+,
-- Sky, NOW, Paramount+, Discovery+, YouTube Premium, Crunchyroll.
-- Matches id AND the current name, so a row already renamed (or never
-- seeded) is left untouched.

UPDATE "public"."finance_budget_items"
SET "name" = 'Phone', "updated_at" = "now"()
WHERE "id" = 'h7' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Phone (O2)';

UPDATE "public"."finance_budget_items"
SET "name" = 'Optical', "updated_at" = "now"()
WHERE "id" = 'i3' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Eye (Contact Lens)';

UPDATE "public"."finance_budget_items"
SET "name" = 'Apple TV+', "updated_at" = "now"()
WHERE "id" = 'v1' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Apple Music + TV';

UPDATE "public"."finance_budget_items"
SET "name" = 'Prime Video', "updated_at" = "now"()
WHERE "id" = 'v7' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Prime';

UPDATE "public"."finance_budget_items"
SET "name" = 'Sky', "updated_at" = "now"()
WHERE "id" = 'v8' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Sky Atlantic';

UPDATE "public"."finance_budget_items"
SET "name" = 'NOW', "updated_at" = "now"()
WHERE "id" = 'v9' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Sky Cinema';

UPDATE "public"."finance_budget_items"
SET "name" = 'YouTube Premium', "updated_at" = "now"()
WHERE "id" = 'v11' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Youtube';

-- Sky Sports folds into Sky. Deleted only if nothing links to it. Neither
-- finance_recurring_bills nor finance_recurring_templates references 'v10'
-- today, so this runs; the guards make it a no-op if that ever changes.
DELETE FROM "public"."finance_budget_items"
WHERE "id" = 'v10' AND "is_default" AND "profile_id" IS NULL AND "name" = 'Sky Sports'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."finance_recurring_bills" WHERE "linked_budget_item_id" = 'v10'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "public"."finance_recurring_templates" WHERE "linked_budget_item_id" = 'v10'
  );

-- 2d. Recurring templates --------------------------------------------------
-- finance_recurring_templates has no profile_id -- every row is shared, and
-- both the is_default true and false copies are affected below.

-- Not generic UK defaults.
DELETE FROM "public"."finance_recurring_templates"
WHERE "name" IN ('Hulu', 'ASPCA / Donations', 'Copilot');

-- Amounts were one person's prices. Zero means "no suggested amount", not
-- "free". Matched on (name, old amount) like everything else here, so a
-- re-run after someone sets real amounts leaves them alone.
UPDATE "public"."finance_recurring_templates"
SET "default_amount" = 0, "updated_at" = "now"()
WHERE ("name", "default_amount") IN (
    ('Apple TV+', 13),
    ('Netflix', 18),
    ('Gym membership', 55),
    ('Car Insurance', 100),
    ('Electric Bill', 75),
    ('Gas Bill', 50),
    ('Internet', 60),
    ('Phone Bill', 90),
    ('Rent / Mortgage', 1200),
    ('Water Bill', 30),
    ('Audible', 15),
    ('Spotify', 11.99)
);

-- Wrong or dangling links: Spotify pointed at the Apple item; s3 and s4 do
-- not exist. With no link, adding a bill from the template falls back to
-- matching the budget category by name.
UPDATE "public"."finance_recurring_templates"
SET "linked_budget_item_id" = NULL, "updated_at" = "now"()
WHERE ("name", "linked_budget_item_id") IN (
    ('Spotify', 'v1'),
    ('Audible', 's4'),
    ('Gym membership', 's3')
);

COMMIT;
