-- Reconciles tv_show_seasons.created_at and tv_show_episodes.created_at to
-- the no-backfill intent 20260912090000 was meant to ship.
--
-- The version of 20260912090000 that actually ran added created_at with a
-- default and no separate ALTER, which backfills every pre-existing row to
-- the migration transaction's now() -- 676 tv_show_seasons rows and 7,896
-- tv_show_episodes rows all carry '2026-09-12 15:08:07.315394+00'. The file
-- was rewritten afterwards, in the working tree, to add the column bare and
-- set the default in a second statement, leaving pre-existing rows NULL --
-- but a migration that has already run is history, not a draft, so that
-- rewrite could only correct the file, not the database it already produced.
-- This migration is the other half: it brings the data to match what the
-- (now-authoritative) file says should have happened, rather than editing
-- 20260912090000 again and deepening the gap between the file and what ran.
--
-- Matching on the exact timestamp, not a range, is deliberate and safe:
-- now() is fixed for the entire duration of a transaction in Postgres, so
-- every row the backfilling transaction touched carries that same value to
-- the microsecond, and nothing else can. Any row inserted by the sync in a
-- later transaction gets its own now() and cannot collide with this one. A
-- "< some cutoff" range would risk catching genuine early rows from a
-- window this project has no way to name correctly; equality on the one
-- known stamped value cannot.
--
-- Why this matters: useRecentAnnouncements (useWatchlistNews.ts) reads a
-- rolling 7-day window (created_at > now() - interval '7 days') on the
-- premise that a NULL created_at means "existed before announcements were
-- tracked" and drops out of the window on its own (NULL > anything is
-- UNKNOWN). Against the unreconciled data every one of those 8,572 rows
-- shares one now()-ish timestamp, so the feed reports the entire
-- pre-existing library as newly announced until 2026-09-19. Setting them
-- back to NULL is what makes "recently added" mean recently added again.
--
-- If run against a database whose backfill timestamp differs (e.g. a local
-- stack that replayed 20260912090000 at its own now()), the UPDATE below
-- matches nothing and is a correct no-op there -- there is no honest range
-- to fall back to instead.

BEGIN;

ALTER TABLE "public"."tv_show_seasons"
    ALTER COLUMN "created_at" DROP NOT NULL;

UPDATE "public"."tv_show_seasons"
    SET "created_at" = NULL
    WHERE "created_at" = '2026-09-12 15:08:07.315394+00'::timestamptz;

ALTER TABLE "public"."tv_show_seasons"
    ALTER COLUMN "created_at" SET DEFAULT "now"();

ALTER TABLE "public"."tv_show_episodes"
    ALTER COLUMN "created_at" DROP NOT NULL;

UPDATE "public"."tv_show_episodes"
    SET "created_at" = NULL
    WHERE "created_at" = '2026-09-12 15:08:07.315394+00'::timestamptz;

ALTER TABLE "public"."tv_show_episodes"
    ALTER COLUMN "created_at" SET DEFAULT "now"();

COMMIT;
