-- Watchlist review fixes: close the direct-insert path on watchlist_events,
-- keep specials out of Watch Next, and correct the pinned comments.
--
-- Four findings on migrations that have already been applied
-- (20260912100000, 20260912140000). Those files are history and are not
-- edited; this is the forward step.
--
-- 1. log_watchlist_event() becomes SECURITY DEFINER. 20260912140000 left it
--    SECURITY INVOKER on the argument that RLS on watchlist_events was the
--    gate. In practice that argument required the "Admin insert" policy and an
--    INSERT grant for authenticated, which is exactly a direct-insert path:
--    any admin session could write arbitrary rows into a table whose whole
--    point is that only the trigger writes it (entity_id has no foreign key
--    because the trigger is the integrity boundary). As definer the trigger
--    writes as its owner, postgres, which owns the table and is exempt from
--    its RLS (the table is never FORCE ROW LEVEL SECURITY), so the caller no
--    longer needs INSERT. search_path becomes '' with every name in the body
--    schema-qualified (it was public, pg_temp), and EXECUTE is revoked from
--    PUBLIC, anon and authenticated. Firing a trigger does not check EXECUTE
--    on its function (only CREATE TRIGGER does), so the revoke cannot stop the
--    triggers on tv_shows and movies. service_role keeps its default grant.
--    The body is otherwise unchanged.
--
-- 2. With (1) in place the direct path is closed at both layers: DROP the
--    "Admin insert" policy and take INSERT back from authenticated. anon and
--    authenticated keep SELECT only (the "Public Read Access" policy has no
--    TO clause, so the signed-in admin reads the News feed through it);
--    service_role is unchanged. Nothing in src/ or supabase/functions/ inserts
--    into watchlist_events; the one reader is useWatchlistNews.ts.
--
-- 3. watchlist_up_next gains "season_number > 0". A special (season 0) sorted
--    ahead of every real season under the view's DISTINCT ON ordering, so a
--    show with an unwatched special led Watch Next with it. 28 rows in the
--    view had season_number = 0 on 2026-09-29. Filtering rather than
--    re-ordering means a show whose only unwatched episodes are specials no
--    longer appears in the view at all; that is intended. Column list, order
--    and types are exactly as 20260912100000 left them, and security_invoker
--    stays on. The view held ALL privileges for anon and authenticated
--    (default privileges hand ALL to a new relation, and 20260912090000 only
--    ever added a GRANT SELECT on top of that, never a REVOKE); a view is
--    read-only in practice, but the grant should say so. Revoke, then grant
--    SELECT back.
--
-- 4. The tv_shows.pinned and movies.pinned comments claimed the at-most-one
--    rule was enforced in WatchlistContext.tsx and guaranteed by the UI. Both
--    are false: nothing in src/ writes pinned (it is set by hand) and nothing
--    enforces at most one. usePinnedTitle takes one row from each table and
--    prefers the show, so with several pinned an arbitrary show beats any
--    movie. The comments now say so. Behaviour is unchanged.
--
-- Re-runnable: CREATE OR REPLACE, DROP POLICY IF EXISTS, and REVOKE/GRANT are
-- all idempotent.

BEGIN;

-- 1. log_watchlist_event(): definer, same body.
--
-- The trigger is meant to be the only writer of watchlist_events. As
-- SECURITY DEFINER it inserts as its owner, so a caller who fires it needs no
-- INSERT privilege on the table, and that is what lets the direct-insert path
-- close (see below). search_path is empty and every name in the body is
-- schema-qualified, so no function planted in public -- a jsonb_build_object
-- with narrower argument types would outrank pg_catalog's -- can run as
-- postgres through it.
--
-- movies has no status column. The status branch is gated on
-- TG_TABLE_NAME = 'tv_shows' first and nested rather than folded into a
-- single AND condition, so NEW.status is only ever resolved when the trigger
-- is firing on tv_shows.
CREATE OR REPLACE FUNCTION "public"."log_watchlist_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  entity "text";
BEGIN
  entity := CASE TG_TABLE_NAME WHEN 'tv_shows' THEN 'tv_show' WHEN 'movies' THEN 'movie' END;

  IF NEW.platform IS DISTINCT FROM OLD.platform THEN
    INSERT INTO public.watchlist_events (entity_type, entity_id, kind, payload)
    VALUES (
      entity,
      NEW.id,
      'platform_change',
      pg_catalog.jsonb_build_object('from', OLD.platform, 'to', NEW.platform)
    );
  END IF;

  IF TG_TABLE_NAME = 'tv_shows' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.watchlist_events (entity_type, entity_id, kind, payload)
      VALUES (
        'tv_show',
        NEW.id,
        'status_change',
        pg_catalog.jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."log_watchlist_event"() OWNER TO "postgres";

REVOKE EXECUTE ON FUNCTION "public"."log_watchlist_event"() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION "public"."log_watchlist_event"() FROM "anon";

REVOKE EXECUTE ON FUNCTION "public"."log_watchlist_event"() FROM "authenticated";

-- 2. watchlist_events: no direct insert for anyone but service_role.
DROP POLICY IF EXISTS "Admin insert" ON "public"."watchlist_events";

REVOKE ALL ON TABLE "public"."watchlist_events" FROM "anon";

REVOKE ALL ON TABLE "public"."watchlist_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "anon";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "authenticated";

-- 3. watchlist_up_next: specials never lead Watch Next.
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
  -- Season 0 is TMDB's "Specials". It sorts ahead of season 1, so without
  -- this a show with an unwatched special led Watch Next with it.
  AND  s.season_number > 0
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

REVOKE ALL ON TABLE "public"."watchlist_up_next" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "anon", "authenticated";

-- 4. The pinned comments, corrected.
COMMENT ON COLUMN "public"."tv_shows"."pinned" IS
    'Marks the title the countdown widget shows. Nothing in the app writes this column yet -- it is set by hand -- and nothing enforces that at most one row is true, here or in the client. The only reader, usePinnedTitle (src/features/watchlist/useWatchlistNews.ts), takes one pinned row from tv_shows and one from movies and prefers the show, so with several rows pinned an arbitrary show wins over any movie.';

COMMENT ON COLUMN "public"."movies"."pinned" IS
    'Marks the title the countdown widget shows. Nothing in the app writes this column yet -- it is set by hand -- and nothing enforces that at most one row is true, here or in the client. The only reader, usePinnedTitle (src/features/watchlist/useWatchlistNews.ts), takes one pinned row from tv_shows and one from movies and prefers the show, so with several rows pinned an arbitrary show wins over any movie.';

COMMIT;
