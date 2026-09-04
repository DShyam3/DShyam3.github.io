CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.jwt() ->> 'email' = 'd.shyam1256@gmail.com';
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

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


GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "service_role";
