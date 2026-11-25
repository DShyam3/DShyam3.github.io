-- A manual status can differ from the last status observed at TMDB. The sync
-- keeps that choice until TMDB reports an actual change from this baseline.
-- Existing status values came from TMDB, so use them as the first baseline.
-- tv_shows already has RLS, public SELECT, admin-gated writes, and scoped
-- table grants; adding a column does not change those policies or grants.

BEGIN;

ALTER TABLE "public"."tv_shows"
    ADD COLUMN "tmdb_status" text;

UPDATE "public"."tv_shows"
SET "tmdb_status" = "status"
WHERE "tmdb_status" IS NULL;

COMMENT ON COLUMN "public"."tv_shows"."tmdb_status" IS
    'Last observed TMDB series status. A different status is a manual override until TMDB changes from this baseline.';

COMMIT;
