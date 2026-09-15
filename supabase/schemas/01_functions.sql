-- The authorization boundary for the whole database: every admin policy on
-- every table calls this, so it is the one place that decides who may write.
--
-- Membership lives in `public.admin_users` (see 00_admin_users.sql for why it
-- stopped being a hardcoded email literal). Keyed on the subject claim, which
-- is immutable, rather than on the email claim, which the account holder can
-- change.
--
-- `auth.uid()` is null for an anonymous request, and EXISTS over no rows is
-- false, so an unauthenticated caller is denied without a special case.
--
-- Takes no arguments and reads no column of the row being checked, so the
-- planner evaluates it once per statement as a one-time filter rather than
-- once per row. The added table read does not scale with the size of a scan.
CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

-- This policy lives here rather than in 00_admin_users.sql, where the table
-- it protects is defined: it calls is_admin() above, and is_admin() is
-- LANGUAGE sql, so Postgres validates its body at creation time and needs the
-- function to already exist. 00_admin_users.sql sorts first only because it
-- has to -- is_admin() needs admin_users to exist first, for the same
-- reason. RLS itself is still enabled with the table in 00_admin_users.sql,
-- so admin_users is never briefly unprotected in a from-empty build.
--
-- An administrator may read the list, which is what lets the account page say
-- who has access. Nobody may write it through the API: granting administrator
-- rights is not something an administrator session should be able to do by
-- sending a request, so inserts and deletes go through the service role (the
-- seed script, or the SQL editor). RLS on with no write policy denies the rest
-- by default.
CREATE POLICY "Admin read" ON "public"."admin_users"
    FOR SELECT TO "authenticated" USING ("public"."is_admin"());

-- Note on recursion: that policy calls a function that reads this table.
-- `is_admin()` is SECURITY DEFINER and owned by postgres, and a table's owner
-- is exempt from its own RLS, so the inner read does not re-enter the policy.
-- This table must therefore never be given FORCE ROW LEVEL SECURITY, which
-- would remove that exemption and turn the check into infinite recursion.

CREATE OR REPLACE FUNCTION "public"."update_episodes_watched_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Only run if the 'watched' status actually changed
  IF (OLD.watched IS DISTINCT FROM NEW.watched) THEN
    UPDATE tv_show_episodes
    SET watched = NEW.watched
    WHERE season_id = NEW.id
    AND watched IS DISTINCT FROM NEW.watched; -- Only update rows that actually need to change
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_episodes_watched_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_season_watched_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_season_id INT;
  all_watched BOOLEAN;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_season_id := OLD.season_id;
  ELSE
    target_season_id := NEW.season_id;
  END IF;

  -- Calculate if everything is watched
  SELECT COALESCE(bool_and(watched), false)
  INTO all_watched
  FROM tv_show_episodes
  WHERE season_id = target_season_id;

  -- Update ONLY if the status is different from current
  UPDATE tv_show_seasons
  SET watched = all_watched
  WHERE id = target_season_id
    AND watched IS DISTINCT FROM all_watched;

  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."update_season_watched_status"() OWNER TO "postgres";

-- Stamps tv_show_episodes.watched_at from the `watched` boolean, so the four
-- write paths that can flip it (WatchlistContext.tsx's single-episode toggle,
-- its bulk season toggle, its browser sync upsert, and watchlist-cron-sync's
-- Deno upsert -- see README.md:101 for why the last two duplicate the same
-- logic across two runtimes) get one shared, correct implementation instead
-- of four.
--
-- BEFORE, not AFTER: the function edits NEW and returns it, which only takes
-- effect from a BEFORE trigger.
--
-- INSERT sets watched_at only when the row arrives already watched AND the
-- caller left watched_at null -- an insert that supplies its own watched_at
-- (a real historical import) must not be overwritten.
--
-- UPDATE sets or clears watched_at only when `watched` itself is DISTINCT
-- FROM its old value. This is the load-bearing branch: watchlist-cron-sync's
-- nightly upsert runs over every episode whether or not anything changed. If
-- an unrelated column update (release_date, runtime, title) or a same-value
-- rewrite of `watched` touched watched_at, the nightly cron would reset the
-- entire watch history to now() on its first run.
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
    -- arrived. No branch here is deliberate -- adding one would be the bug.
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_watched_at"() OWNER TO "postgres";

-- Logs public.watchlist_events rows when tv_shows.platform, movies.platform,
-- or tv_shows.status changes, so the News page has history instead of a
-- column the sync silently overwrites. One function, triggers on BOTH tables
-- (see 20_watchlist.sql) rather than TypeScript in WatchlistContext.tsx and
-- watchlist-cron-sync/index.ts -- README.md:101 already explains why the
-- watchlist sync is two runtime implementations, and a detection rule
-- belongs in the one place both of them write through, not a third copy.
--
-- movies has no status column. The status check is gated on TG_TABLE_NAME =
-- 'tv_shows' first and nested rather than folded into one AND condition, so
-- NEW.status is only ever resolved when the trigger is actually firing on
-- tv_shows -- PL/pgSQL resolves a record field reference against the calling
-- table's row type at that statement's first execution, so a reference that
-- is never reached for movies is never resolved against it and never
-- errors.
--
-- IS DISTINCT FROM, not <>: a NULL on either side (a show with no platform
-- yet, or a status the sync just cleared) is still a change and must still
-- produce a row, with the NULL carried into the JSON payload as JSON null.
-- COALESCE is deliberately absent here for the same reason it is absent from
-- set_watched_at's watched IS DISTINCT FROM check above -- it would swallow
-- a real first-time value.
--
-- Not SECURITY DEFINER: the two watchlist_events RLS policies (public
-- SELECT, admin-gated INSERT) are the actual gate on who can write history.
-- Running as the function owner would let this trigger write past a future
-- RLS mistake on the table it feeds.
CREATE OR REPLACE FUNCTION "public"."log_watchlist_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
      jsonb_build_object('from', OLD.platform, 'to', NEW.platform)
    );
  END IF;

  IF TG_TABLE_NAME = 'tv_shows' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.watchlist_events (entity_type, entity_id, kind, payload)
      VALUES (
        'tv_show',
        NEW.id,
        'status_change',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."log_watchlist_event"() OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_watched_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "service_role";
