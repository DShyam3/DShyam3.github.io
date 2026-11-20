-- Owner-activity timestamp: adds a nullable `last_activity_at` to
-- `public.movies` and `public.tv_shows`, which the client ranks Discover
-- franchises by. It moves on owner actions only (add, watch, re-file) and
-- never on watchlist-cron-sync writes. Existing rows stay NULL: no backfill,
-- NULL means "not touched since this column was added".
--
-- ## RLS and Grants
--
-- No RLS policy changes. Table-level grants (SELECT to anon, SELECT/INSERT/
-- UPDATE/DELETE to authenticated, ALL to service_role) cover the new column.
-- anon can SELECT it, the same sensitivity as the already-public watched_at.
-- The new trigger functions are SECURITY INVOKER; EXECUTE is revoked from
-- PUBLIC, anon and authenticated (a trigger fires without an EXECUTE check),
-- and kept for service_role. Writes on tv_shows from the episode trigger pass
-- the existing "Admin update" policy ((SELECT public.is_admin())).

BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;

-- Owner-only stamp: INSERT sets it; UPDATE bumps only on a real change, so the
-- cron's same-value rewrites stay no-ops. watched / watched_at are gated on
-- TG_TABLE_NAME (nested, as log_watchlist_event() does) because tv_shows lacks
-- them. Full reasoning: 01_functions.sql.
CREATE OR REPLACE FUNCTION "public"."touch_last_activity_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.last_activity_at := pg_catalog.now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.library_state IS DISTINCT FROM OLD.library_state THEN
      NEW.last_activity_at := pg_catalog.now();
    END IF;

    IF TG_TABLE_NAME = 'movies' THEN
      IF NEW.watched IS DISTINCT FROM OLD.watched
         OR NEW.watched_at IS DISTINCT FROM OLD.watched_at THEN
        NEW.last_activity_at := pg_catalog.now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."touch_last_activity_at"() OWNER TO "postgres";

-- Episode watched flips bump the parent show (series are watched on episodes).
-- UPDATE only: the cron inserts new episodes. The IS DISTINCT guard makes a
-- season toggle write the show once per transaction. SECURITY INVOKER is enough:
-- the owner passes "Admin update" on tv_shows, service_role bypasses RLS, anon
-- cannot update episodes.
CREATE OR REPLACE FUNCTION "public"."touch_show_last_activity_from_episode"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.watched IS DISTINCT FROM NEW.watched
     OR OLD.watched_at IS DISTINCT FROM NEW.watched_at THEN
    UPDATE public.tv_shows s
       SET last_activity_at = pg_catalog.now()
      FROM public.tv_show_seasons se
     WHERE se.id = NEW.season_id
       AND s.id = se.tv_show_id
       AND s.last_activity_at IS DISTINCT FROM pg_catalog.now();
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."touch_show_last_activity_from_episode"() OWNER TO "postgres";

REVOKE EXECUTE ON FUNCTION "public"."touch_last_activity_at"() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION "public"."touch_last_activity_at"() FROM "anon";

REVOKE EXECUTE ON FUNCTION "public"."touch_last_activity_at"() FROM "authenticated";

GRANT ALL ON FUNCTION "public"."touch_last_activity_at"() TO "service_role";

REVOKE EXECUTE ON FUNCTION "public"."touch_show_last_activity_from_episode"() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION "public"."touch_show_last_activity_from_episode"() FROM "anon";

REVOKE EXECUTE ON FUNCTION "public"."touch_show_last_activity_from_episode"() FROM "authenticated";

GRANT ALL ON FUNCTION "public"."touch_show_last_activity_from_episode"() TO "service_role";

DROP TRIGGER IF EXISTS "tr_touch_movie_last_activity" ON "public"."movies";

CREATE TRIGGER "tr_touch_movie_last_activity" BEFORE INSERT OR UPDATE OF "watched", "watched_at", "library_state" ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_activity_at"();

DROP TRIGGER IF EXISTS "tr_touch_tv_show_last_activity" ON "public"."tv_shows";

CREATE TRIGGER "tr_touch_tv_show_last_activity" BEFORE INSERT OR UPDATE OF "library_state" ON "public"."tv_shows" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_activity_at"();

-- Series are watched on episodes, so an episode flip bumps its show. UPDATE
-- only: episode INSERT is the cron adding newly aired episodes, not the owner.
-- Row-level because Postgres refuses transition tables on a trigger with a
-- column list; the function's IS DISTINCT guard collapses a season toggle to
-- one show write.
DROP TRIGGER IF EXISTS "tr_touch_show_last_activity_from_episode" ON "public"."tv_show_episodes";

CREATE TRIGGER "tr_touch_show_last_activity_from_episode" AFTER UPDATE OF "watched", "watched_at" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_show_last_activity_from_episode"();

COMMENT ON COLUMN "public"."movies"."last_activity_at" IS
    'Owner-activity timestamp: set when the film is added, and bumped when watched, watched_at or library_state changes (touch_last_activity_at()). Never moved by watchlist-cron-sync or the scores refresh, which is why it is not updated_at. NULL means no owner action since this column was added (existing rows are not backfilled).';

COMMENT ON COLUMN "public"."tv_shows"."last_activity_at" IS
    'Owner-activity timestamp: set when the show is added, and bumped when library_state changes (touch_last_activity_at()) or an episode is marked or unmarked watched (touch_show_last_activity_from_episode()). Never moved by watchlist-cron-sync, which inserts newly aired episodes and rewrites metadata, nor by the scores refresh. NULL means no owner action since this column was added (existing rows are not backfilled).';

COMMIT;
