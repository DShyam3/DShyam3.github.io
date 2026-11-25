-- Cron-only RPC for watchlist-cron-sync to update existing episode OMDb scores
-- and stamp tv_show_seasons.scores_checked_at in a single round trip without
-- ever inserting ghost tv_show_episodes rows.
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

CREATE OR REPLACE FUNCTION "public"."set_season_omdb_scores"(
    p_season_id integer,
    p_checked_at timestamp with time zone,
    p_episodes jsonb
)
    RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
BEGIN
  IF jsonb_typeof(p_episodes) = 'array' AND jsonb_array_length(p_episodes) > 0 THEN
    UPDATE public.tv_show_episodes e
    SET imdb_id = COALESCE(x.imdb_id, e.imdb_id),
        imdb_rating = x.imdb_rating
    FROM jsonb_to_recordset(p_episodes) AS x(
      episode_number integer,
      imdb_id text,
      imdb_rating numeric(3,1)
    )
    WHERE e.season_id = p_season_id
      AND e.episode_number = x.episode_number
      AND (
        e.imdb_rating IS DISTINCT FROM x.imdb_rating
        OR (x.imdb_id IS NOT NULL AND e.imdb_id IS DISTINCT FROM x.imdb_id)
      );
  END IF;

  UPDATE public.tv_show_seasons
  SET scores_checked_at = p_checked_at
  WHERE id = p_season_id;
END;
$$;

ALTER FUNCTION "public"."set_season_omdb_scores"(integer, timestamp with time zone, jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_season_omdb_scores"(integer, timestamp with time zone, jsonb) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_season_omdb_scores"(integer, timestamp with time zone, jsonb) TO "service_role";

COMMIT;
