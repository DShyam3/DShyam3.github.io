-- Record when each rating was first given (`rated_at`), separate from `updated_at`,
-- and preserve Trakt's `rated_at` during import. Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

ALTER TABLE "public"."watchlist_ratings"
  ADD COLUMN IF NOT EXISTS "rated_at" timestamp with time zone;

UPDATE "public"."watchlist_ratings"
SET "rated_at" = "updated_at"
WHERE "rated_at" IS NULL;

ALTER TABLE "public"."watchlist_ratings"
  ALTER COLUMN "rated_at" SET DEFAULT "now"(),
  ALTER COLUMN "rated_at" SET NOT NULL;

COMMENT ON COLUMN "public"."watchlist_ratings"."rated_at" IS
  'When the score was first given (or imported from Trakt). Preserved when the rating is later edited, unlike updated_at.';

CREATE OR REPLACE FUNCTION "public"."import_watch_history"(
  p_episodes jsonb DEFAULT '[]'::jsonb,
  p_movies   jsonb DEFAULT '[]'::jsonb,
  p_shows    jsonb DEFAULT '[]'::jsonb,
  p_seasons  jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_flipped_eps    integer[];
  v_flipped_movies integer[];
  v_dated_eps      integer := 0;
  v_dated_movies   integer := 0;
  v_ratings        integer := 0;
  v_n              integer;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_typeof(p_movies) <> 'array'
     OR jsonb_typeof(p_shows) <> 'array' OR jsonb_typeof(p_seasons) <> 'array' THEN
    RAISE EXCEPTION 'array arguments required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_episodes) > 5000 OR jsonb_array_length(p_movies) > 5000
     OR jsonb_array_length(p_shows) > 5000 OR jsonb_array_length(p_seasons) > 5000 THEN
    RAISE EXCEPTION 'batch exceeds 5000 items' USING ERRCODE = '22023';
  END IF;

  -- Flip unwatched episodes first; the watch trigger stamps them with now(),
  -- which the date step below then replaces when the import has a date.
  WITH d AS (
    SELECT DISTINCT x.id
    FROM jsonb_to_recordset(p_episodes) AS x(id integer, watched_at timestamptz)
    WHERE x.id IS NOT NULL
  ), u AS (
    UPDATE public.tv_show_episodes e
    SET watched = true
    FROM d
    WHERE e.id = d.id AND e.watched = false
    RETURNING e.id
  )
  SELECT array_agg(id) INTO v_flipped_eps FROM u;

  WITH d AS (
    SELECT x.id, min(x.watched_at) AS imported
    FROM jsonb_to_recordset(p_episodes) AS x(id integer, watched_at timestamptz)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), n AS (
    SELECT e.id, d.imported,
           CASE
             WHEN e.id = ANY(COALESCE(v_flipped_eps, '{}')) THEN d.imported
             WHEN d.imported IS NULL THEN e.watched_at
             WHEN e.watched_at IS NULL THEN d.imported
             ELSE LEAST(e.watched_at, d.imported)
           END AS new_at
    FROM public.tv_show_episodes e
    JOIN d ON d.id = e.id
    WHERE e.watched = true
  ), u AS (
    UPDATE public.tv_show_episodes e
    SET watched_at = n.new_at
    FROM n
    WHERE e.id = n.id AND e.watched_at IS DISTINCT FROM n.new_at
    RETURNING n.imported
  )
  SELECT count(*) FILTER (WHERE imported IS NOT NULL) INTO v_dated_eps FROM u;

  WITH d AS (
    SELECT DISTINCT x.id
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric)
    WHERE x.id IS NOT NULL
  ), u AS (
    UPDATE public.movies m
    SET watched = true
    FROM d
    WHERE m.id = d.id AND m.watched = false
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_flipped_movies FROM u;

  WITH d AS (
    SELECT x.id, min(x.watched_at) AS imported
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), n AS (
    SELECT m.id, d.imported,
           CASE
             WHEN m.id = ANY(COALESCE(v_flipped_movies, '{}')) THEN d.imported
             WHEN d.imported IS NULL THEN m.watched_at
             WHEN m.watched_at IS NULL THEN d.imported
             ELSE LEAST(m.watched_at, d.imported)
           END AS new_at
    FROM public.movies m
    JOIN d ON d.id = m.id
    WHERE m.watched = true
  ), u AS (
    UPDATE public.movies m
    SET watched_at = n.new_at
    FROM n
    WHERE m.id = n.id AND m.watched_at IS DISTINCT FROM n.new_at
    RETURNING n.imported
  )
  SELECT count(*) FILTER (WHERE imported IS NOT NULL) INTO v_dated_movies FROM u;

  -- Ratings go to the watchlist_ratings table (admin write), only where the
  -- target has none yet, only 0.5 to 10 in half-point steps.
  WITH i AS (
    SELECT x.id, max(x.rating) AS rating, max(x.rated_at) AS rated_at
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric, rated_at timestamptz)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (movie_id, rating, rated_at, updated_at)
    SELECT t.id, i.rating, COALESCE(i.rated_at, now()), now()
    FROM i JOIN public.movies t ON t.id = i.id
    ON CONFLICT (movie_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating, max(x.rated_at) AS rated_at
    FROM jsonb_to_recordset(p_shows) AS x(id integer, rating numeric, rated_at timestamptz)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (tv_show_id, rating, rated_at, updated_at)
    SELECT t.id, i.rating, COALESCE(i.rated_at, now()), now()
    FROM i JOIN public.tv_shows t ON t.id = i.id
    ON CONFLICT (tv_show_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating, max(x.rated_at) AS rated_at
    FROM jsonb_to_recordset(p_seasons) AS x(id integer, rating numeric, rated_at timestamptz)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (season_id, rating, rated_at, updated_at)
    SELECT t.id, i.rating, COALESCE(i.rated_at, now()), now()
    FROM i JOIN public.tv_show_seasons t ON t.id = i.id
    ON CONFLICT (season_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  RETURN jsonb_build_object(
    'episodes_marked', COALESCE(cardinality(v_flipped_eps), 0),
    'movies_marked', COALESCE(cardinality(v_flipped_movies), 0),
    'episodes_dated', v_dated_eps,
    'movies_dated', v_dated_movies,
    'dated', v_dated_eps + v_dated_movies,
    'ratings_set', v_ratings
  );
END;
$$;

COMMIT;
