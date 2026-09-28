-- One finance_settings row per profile.
--
-- The client's settings save looked up "the" non-default row with
-- .maybeSingle() and no profile_id filter. With two profiles that query
-- returns more than one row, .maybeSingle() errors, and every save fell
-- through to an insert -- one new row per save. Live on 2026-09-27 the owner
-- profile (aa42da11-f4c9-4feb-99f9-9ae44ed6c0e7) had 13 non-default rows, all
-- carrying identical settings (checked column by column); Demo
-- (6dbe06f8-dd50-47d0-8381-76eb1c7f4403) had 1.
--
-- The fixed client looks the row up by profile_id and reads the latest
-- updated_at (ties on id descending). This keeps exactly that row per profile
-- and deletes the rest, after snapshotting them into finance_seed_backup
-- (created by 20260927192000, which runs first). Keeping the latest rather
-- than requiring identical copies means a settings edit made after the
-- client ships and before this runs is the row that survives -- it is the
-- one the client shows.
--
-- Deploy order: ship the client first, then apply this. Applied under the old
-- client, its unscoped lookup still errors, its insert then hits this index
-- (23505), and that error was ignored -- settings saves would be lost
-- silently until the new client ships.
--
-- On live data today this deletes 12 owner rows and keeps
-- 86aa2a57-e95b-402e-bc97-e5733f54b20b; Demo's single row and the shared
-- is_default row (profile_id NULL) are untouched. Re-runnable: a second run
-- finds one non-default row per profile, snapshots and deletes nothing, and
-- the index already exists.

BEGIN;

-- 1. Snapshot, then delete, every non-default row that is not its
--    profile's latest.
WITH "keepers" AS (
    SELECT DISTINCT ON ("profile_id") "id"
    FROM "public"."finance_settings"
    WHERE NOT "is_default"
    ORDER BY "profile_id", "updated_at" DESC, "id" DESC
)
INSERT INTO "public"."finance_seed_backup" ("reason", "source_table", "row_data")
SELECT '20260927 settings one per profile', 'finance_settings', "to_jsonb"("s")
FROM "public"."finance_settings" "s"
WHERE NOT "s"."is_default"
  AND "s"."id" NOT IN (SELECT "id" FROM "keepers");

WITH "keepers" AS (
    SELECT DISTINCT ON ("profile_id") "id"
    FROM "public"."finance_settings"
    WHERE NOT "is_default"
    ORDER BY "profile_id", "updated_at" DESC, "id" DESC
)
DELETE FROM "public"."finance_settings"
WHERE NOT "is_default"
  AND "id" NOT IN (SELECT "id" FROM "keepers");

-- 2. At most one non-default row per profile from now on. The shared default
--    rows (is_default, profile_id NULL) fall outside the predicate; nothing
--    here limits how many of those exist.
CREATE UNIQUE INDEX IF NOT EXISTS "finance_settings_one_per_profile"
    ON "public"."finance_settings" ("profile_id")
    WHERE NOT "is_default";

COMMIT;
