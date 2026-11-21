-- Run against an isolated/local migrated database with psql -v ON_ERROR_STOP=1.
-- All fixtures and changes are rolled back. No credentials or real user rows used.
--
-- Pins the rule behind movies/tv_shows.last_activity_at
-- (20261120230000_watchlist_last_activity.sql): writes shaped like
-- watchlist-cron-sync's never move it; the owner's adds, watches and Library
-- visibility changes always do.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, description text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', description; END IF;
END $$;

CREATE FUNCTION pg_temp.movie_stamp() RETURNS timestamptz
LANGUAGE sql AS $$ SELECT last_activity_at FROM public.movies WHERE id = 990000001 $$;
CREATE FUNCTION pg_temp.show_stamp() RETURNS timestamptz
LANGUAGE sql AS $$ SELECT last_activity_at FROM public.tv_shows WHERE id = 990000001 $$;

-- Fixtures. The inserts stamp both rows; clearing it afterwards does not fire
-- the triggers, whose column lists leave last_activity_at out.
INSERT INTO public.movies (id, title, tmdb_id, watched) VALUES (990000001, 'Activity test film', 990000001, false);
INSERT INTO public.tv_shows (id, title, platform, tmdb_id) VALUES (990000001, 'Activity test show', 'Online', 990000001);
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NOT NULL, 'adding a film stamps it');
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NOT NULL, 'adding a show stamps it');
INSERT INTO public.tv_show_seasons (id, tv_show_id, season_number) VALUES (990000001, 990000001, 1);
INSERT INTO public.tv_show_episodes (id, season_id, episode_number, watched) VALUES
 (990000001, 990000001, 1, false),
 (990000002, 990000001, 2, false);
UPDATE public.movies SET last_activity_at = NULL WHERE id = 990000001;
UPDATE public.tv_shows SET last_activity_at = NULL WHERE id = 990000001;

-- The sync, as service_role.
SET LOCAL ROLE service_role;
UPDATE public.movies SET poster = '/p.jpg', overview = 'o', runtime = 100, release_year = 2020 WHERE id = 990000001;
UPDATE public.movies SET imdb_rating = 7.5, scores_checked_at = now() WHERE id = 990000001;
UPDATE public.tv_shows SET status = 'Ended', platform = 'Elsewhere', imdb_rating = 8.0 WHERE id = 990000001;
INSERT INTO public.tv_show_seasons (tv_show_id, season_number, release_date) VALUES (990000001, 1, '2020-01-01')
  ON CONFLICT (tv_show_id, season_number) DO UPDATE SET release_date = EXCLUDED.release_date;
-- The episode upsert's shape: PostgREST sets exactly the keys sent, and the
-- sync sends no `watched`.
INSERT INTO public.tv_show_episodes (season_id, episode_number, title, runtime, release_date) VALUES
 (990000001, 1, 'Renamed', 50, '2020-01-01'),
 (990000001, 3, 'Newly aired', 50, '2020-01-15')
  ON CONFLICT (season_id, episode_number) DO UPDATE
  SET season_id = EXCLUDED.season_id, episode_number = EXCLUDED.episode_number,
      title = EXCLUDED.title, runtime = EXCLUDED.runtime, release_date = EXCLUDED.release_date;
SELECT pg_temp.assert_true(
  (SELECT watched IS FALSE FROM public.tv_show_episodes WHERE season_id = 990000001 AND episode_number = 3),
  'a newly aired episode from the sync starts unwatched'
);
DELETE FROM public.tv_show_episodes WHERE season_id = 990000001 AND episode_number = 3;
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NULL, 'sync writes leave a film untouched');
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NULL, 'sync writes leave a show untouched');

-- Same-value writes are not activity either.
UPDATE public.movies SET watched = watched, watched_at = watched_at, library_state = library_state WHERE id = 990000001;
UPDATE public.tv_shows SET library_state = library_state WHERE id = 990000001;
UPDATE public.tv_show_episodes SET watched = watched, watched_at = watched_at WHERE season_id = 990000001;
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NULL, 'a same-value film write is not activity');
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NULL, 'a same-value show or episode write is not activity');
RESET ROLE;

-- The owner, as an admin through RLS.
INSERT INTO auth.users (id) VALUES ('10000000-0000-4000-8000-0000000000a1');
INSERT INTO public.admin_users (user_id, email, note) VALUES
 ('10000000-0000-4000-8000-0000000000a1', 'watchlist-owner@example.invalid', 'transactional test');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

UPDATE public.movies SET watched = true WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NOT NULL, 'watching a film stamps it');
RESET ROLE;
UPDATE public.movies SET last_activity_at = NULL WHERE id = 990000001;
SET LOCAL ROLE authenticated;

UPDATE public.movies SET watched_at = '2024-05-01T20:00:00Z' WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NOT NULL, 're-dating a watch stamps the film');
RESET ROLE;
UPDATE public.movies SET last_activity_at = NULL WHERE id = 990000001;
SET LOCAL ROLE authenticated;

UPDATE public.movies SET library_state = 'hidden' WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.movie_stamp() IS NOT NULL, 'changing Library visibility stamps a film');

UPDATE public.tv_shows SET library_state = 'paused' WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NOT NULL, 'changing Library visibility stamps a show');
RESET ROLE;
UPDATE public.tv_shows SET last_activity_at = NULL WHERE id = 990000001;
SET LOCAL ROLE authenticated;

UPDATE public.tv_show_episodes SET watched = true WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NOT NULL, 'watching an episode stamps its show');
RESET ROLE;
UPDATE public.tv_shows SET last_activity_at = NULL WHERE id = 990000001;
SET LOCAL ROLE authenticated;

UPDATE public.tv_show_seasons SET watched = true WHERE id = 990000001;
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NOT NULL, 'marking a season watched stamps its show');
SELECT pg_temp.assert_true(
  (SELECT bool_and(watched) FROM public.tv_show_episodes WHERE season_id = 990000001),
  'the season toggle still cascades to its episodes'
);
RESET ROLE;

-- A sync run that read the season before the owner's watch above must not
-- undo it when TMDB has renamed an episode, nor stamp the show.
UPDATE public.tv_shows SET last_activity_at = NULL WHERE id = 990000001;
SET LOCAL ROLE service_role;
INSERT INTO public.tv_show_episodes (season_id, episode_number, title, runtime, release_date) VALUES
 (990000001, 1, 'Renamed again', 55, '2020-01-01')
  ON CONFLICT (season_id, episode_number) DO UPDATE
  SET season_id = EXCLUDED.season_id, episode_number = EXCLUDED.episode_number,
      title = EXCLUDED.title, runtime = EXCLUDED.runtime, release_date = EXCLUDED.release_date;
SELECT pg_temp.assert_true(
  (SELECT watched IS TRUE AND watched_at IS NOT NULL FROM public.tv_show_episodes WHERE season_id = 990000001 AND episode_number = 1),
  'a sync rewrite keeps the owner''s watch and its date'
);
SELECT pg_temp.assert_true(pg_temp.show_stamp() IS NULL, 'a sync rewrite of a watched episode does not stamp its show');
RESET ROLE;

SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.touch_last_activity_at()', 'EXECUTE'), 'anon cannot call touch_last_activity_at');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated', 'public.touch_show_last_activity_from_episode()', 'EXECUTE'), 'authenticated cannot call touch_show_last_activity_from_episode');

ROLLBACK;
