-- Per-season trailers: adds trailer_key and trailer_checked_at to
-- public.tv_show_seasons, plus format check constraints on all three
-- trailer_key columns (movies, tv_shows, tv_show_seasons).
--
-- ## tv_show_seasons columns
--
-- tv_shows and movies already carry trailer_key (added in 20260912100000).
-- tv_show_seasons now gains:
--   - trailer_key (text, nullable): the YouTube video key for the season trailer
--     (from TMDB's season videos append).
--   - trailer_checked_at (timestamptz, nullable): records when the sync last
--     asked TMDB for this season's videos. Left NULL on all pre-existing rows
--     so the sync knows it has never asked, allowing a clean one-time backfill
--     without querying every season on every run.
--
-- ## trailer_key CHECK constraints
--
-- trailer_key is interpolated client-side into a YouTube embed URL
-- (https://www.youtube-nocookie.com/embed/${key}). A YouTube video key is
-- 11 characters from [A-Za-z0-9_-]. A check constraint of
-- `trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$'`
-- prevents malformed strings or URL injection on movies, tv_shows, and
-- tv_show_seasons.
--
-- All existing rows currently have trailer_key IS NULL (no write path has
-- populated them yet), so no rows violate the constraint and plain
-- ADD CONSTRAINT applies cleanly.
--
-- ## RLS and Grants
--
-- No RLS or grant changes are needed.
-- Table-level grants (SELECT to anon, SELECT/INSERT/UPDATE/DELETE to authenticated,
-- and ALL to service_role) already apply to all columns on tv_show_seasons.
-- Existing policies on tv_show_seasons ("Admin insert", "Admin update",
-- "Admin delete") already verify `(SELECT public.is_admin())`, and
-- "Public Read Access" allows SELECT.

BEGIN;

ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN IF NOT EXISTS "trailer_key" text;

ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN IF NOT EXISTS "trailer_checked_at" timestamp with time zone;

COMMENT ON COLUMN "public"."tv_show_seasons"."trailer_key" IS
    'A YouTube video key from TMDB''s season videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."tv_show_seasons"."trailer_checked_at" IS
    'When the sync last asked TMDB for this season''s videos. Null means never asked, so the sync will fetch it once (backfill).';

ALTER TABLE ONLY "public"."movies"
    DROP CONSTRAINT IF EXISTS "movies_trailer_key_format";

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_trailer_key_format"
    CHECK (trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$');

ALTER TABLE ONLY "public"."tv_shows"
    DROP CONSTRAINT IF EXISTS "tv_shows_trailer_key_format";

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_trailer_key_format"
    CHECK (trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$');

ALTER TABLE ONLY "public"."tv_show_seasons"
    DROP CONSTRAINT IF EXISTS "tv_show_seasons_trailer_key_format";

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_trailer_key_format"
    CHECK (trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$');

COMMIT;
