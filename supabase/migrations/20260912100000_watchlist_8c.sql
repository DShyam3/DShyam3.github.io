-- Phase 8.C: the watched_at trigger, plus the four columns the countdown
-- widget and trailer playback need.
--
-- ## watched_at
--
-- 20260912090000 added tv_show_episodes.watched_at but nothing writes it.
-- There are four write paths for `watched`:
--   - WatchlistContext.tsx:949  (single episode toggle)
--   - WatchlistContext.tsx:1002 (bulk season toggle)
--   - WatchlistContext.tsx:1219 (browser sync upsert)
--   - watchlist-cron-sync/index.ts:353 (Deno cron upsert)
-- README.md:101 explains why the last two are the same logic written twice:
-- Vite and Deno share no module. Stamping watched_at in TypeScript would make
-- that four copies instead of two. It goes in a database trigger instead --
-- one implementation, read by both runtimes for free.
--
-- set_watched_at() (defined in 01_functions.sql, alongside the two triggers
-- it sits next to) sets watched_at to now() when `watched` becomes true, and
-- to null when it becomes false, but ONLY when `watched` itself changed.
-- watchlist-cron-sync runs its upsert over every episode every night whether
-- or not anything changed; a trigger that stamped watched_at on every write
-- would reset the entire watch history to now() on the first nightly run
-- after this migration. The `UPDATE OF "watched"` clause on the trigger and
-- the `IS DISTINCT FROM` check inside the function are both guarding the
-- same failure mode, deliberately redundantly.
--
-- On INSERT, watched_at is set only when the row arrives already watched AND
-- carries no watched_at of its own -- so a future historical import that
-- supplies a real timestamp is never overwritten with now().
--
-- This migration does NOT touch existing rows. Every already-watched episode
-- keeps watched_at = null until it is next toggled, per the no-backfill
-- decision recorded on that column in 20260912090000: a fabricated timestamp
-- reads exactly like a real one, so there is no honest value to backfill.
--
-- ## pinned / trailer_key
--
-- pinned backs the countdown widget: exactly one title pinned at a time, but
-- "at most one" is enforced in WatchlistContext.tsx, not by a partial unique
-- index here -- see the column comments for why.
--
-- trailer_key holds a YouTube video key from TMDB's videos append (e.g.
-- "dQw4w9WgXcQ"), not a URL.

BEGIN;

-- Function lives in 01_functions.sql (schema-file convention: functions
-- there, triggers in the table's own schema file once the table exists).
-- Restated here so the migration is runnable on its own against a database
-- that has not yet had the schema files replayed onto it.
CREATE OR REPLACE FUNCTION "public"."set_watched_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.watched IS TRUE AND NEW.watched_at IS NULL THEN
      NEW.watched_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.watched IS DISTINCT FROM NEW.watched THEN
      IF NEW.watched IS TRUE THEN
        NEW.watched_at := now();
      ELSE
        NEW.watched_at := NULL;
      END IF;
    END IF;
    -- watched unchanged: fall through and leave watched_at exactly as it
    -- arrived. No branch here is deliberate -- adding one would be the bug
    -- that resets watch history on the next cron run.
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_watched_at"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "service_role";

DROP TRIGGER IF EXISTS "tr_set_watched_at" ON "public"."tv_show_episodes";

CREATE TRIGGER "tr_set_watched_at"
    BEFORE INSERT OR UPDATE OF "watched" ON "public"."tv_show_episodes"
    FOR EACH ROW EXECUTE FUNCTION "public"."set_watched_at"();

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "trailer_key" text;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "trailer_key" text;

COMMENT ON COLUMN "public"."tv_shows"."pinned" IS
    'Marks the single title the countdown widget shows next. At most one row should be true at a time, but that is enforced in WatchlistContext.tsx, not here -- a partial unique index would only relocate an invariant the UI already guarantees by construction (one toggle, one write).';

COMMENT ON COLUMN "public"."movies"."pinned" IS
    'Marks the single title the countdown widget shows next. At most one row should be true at a time, but that is enforced in WatchlistContext.tsx, not here -- a partial unique index would only relocate an invariant the UI already guarantees by construction (one toggle, one write).';

COMMENT ON COLUMN "public"."tv_shows"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."movies"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';


-- ---------------------------------------------------------------------------
-- watchlist_up_next gains season_in_progress.
--
-- 20260912090000 shipped the view with has_started only, and has_started is
-- true forever once any episode of a show is watched -- so the Up Next rail
-- listed every show ever begun, thirteen cards deep, which is a library and
-- not a next action. season_in_progress is true only while an episode of the
-- SAME season is already watched, which is what "continue watching" actually
-- means. The rail filters on season_in_progress OR a recent air date.
--
-- Replaced here rather than by editing 20260912090000, which has already been
-- applied: a migration that has run is history, and rewriting it would leave
-- the file disagreeing with the database.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "public"."watchlist_up_next" WITH (security_invoker = true) AS
SELECT DISTINCT ON (s.tv_show_id)
       s.tv_show_id,
       sh.title,
       sh.poster,
       sh.platform,
       s.season_number,
       e.episode_number,
       e.title         AS episode_title,
       e.release_date,
       e.runtime,
       CASE
         WHEN e.release_date IS NULL            THEN 'unscheduled'
         WHEN e.release_date <= CURRENT_DATE     THEN 'ready'
         ELSE                                         'upcoming'
       END             AS state,
       -- Distinguishes "continue watching" from "start watching". Without it
       -- the view cannot tell a show mid-run from one never opened, and the
       -- Up Next rail would invite you to begin twelve things at once.
       EXISTS (
         SELECT 1
         FROM   "public"."tv_show_episodes" we
         JOIN   "public"."tv_show_seasons"  ws ON ws.id = we.season_id
         WHERE  ws.tv_show_id = s.tv_show_id
           AND  we.watched = true
       )               AS has_started,
       -- True when an episode of THIS SAME season is already watched, i.e. you
       -- are mid-run rather than merely having finished something years ago.
       -- has_started cannot make that distinction: a show whose S1 you
       -- completed in 2023 has_started forever, which is what turned the Up
       -- Next rail into the whole library. The rail filters on this OR a
       -- recent air date; the difference is "keep going" versus "just dropped".
       EXISTS (
         SELECT 1
         FROM   "public"."tv_show_episodes" se
         WHERE  se.season_id = e.season_id
           AND  se.watched = true
       )               AS season_in_progress
FROM   "public"."tv_show_episodes" e
JOIN   "public"."tv_show_seasons"  s  ON s.id = e.season_id
JOIN   "public"."tv_shows"         sh ON sh.id = s.tv_show_id
WHERE  e.watched = false
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

COMMIT;
