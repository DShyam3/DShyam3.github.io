-- Run against an isolated/local migrated database with psql -v ON_ERROR_STOP=1.
-- All fixtures and changes are rolled back. No credentials or real user rows used.
--
-- Pins watchlist_dismissed_suggestions_keep_stronger
-- (20261122192738_watchlist_dismissal_reasons.sql, facts from
-- 20261123135113_watchlist_dismissal_facts.sql): an upsert never weakens an
-- answer, and never loses the title's facts.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, description text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', description; END IF;
END $$;

CREATE FUNCTION pg_temp.answer(title integer) RETURNS public.watchlist_dismissed_suggestions
LANGUAGE sql AS $$ SELECT * FROM public.watchlist_dismissed_suggestions WHERE media = 'movie' AND tmdb_id = title $$;

-- 1. An old client's upsert, which names no fact columns, of a weaker answer:
-- the stronger answer and the facts both stay.
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at, genre_ids, original_language, release_year)
VALUES ('movie', 990000001, 'not_interested', 'you_might_like', '2026-11-01', ARRAY[27], 'en', 2015);
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at)
VALUES ('movie', 990000001, 'skip', 'coming_soon', '2026-11-20')
  ON CONFLICT (media, tmdb_id) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, answered_at = EXCLUDED.answered_at;
SELECT pg_temp.assert_true(
  (SELECT reason = 'not_interested' AND source = 'you_might_like' AND answered_at = '2026-11-01'
     AND genre_ids = ARRAY[27] AND original_language = 'en' AND release_year = 2015 FROM pg_temp.answer(990000001)),
  'a weaker upsert without facts keeps the answer and the facts'
);

-- 2. A stronger answer with only some facts: it wins, and null facts keep the stored ones.
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at, genre_ids)
VALUES ('movie', 990000002, 'skip', 'you_might_like', '2026-11-01', ARRAY[35]);
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at, genre_ids, original_language, release_year)
VALUES ('movie', 990000002, 'not_interested', 'franchise', '2026-11-20', NULL, NULL, 2019)
  ON CONFLICT (media, tmdb_id) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, answered_at = EXCLUDED.answered_at,
    genre_ids = EXCLUDED.genre_ids, original_language = EXCLUDED.original_language, release_year = EXCLUDED.release_year;
SELECT pg_temp.assert_true(
  (SELECT reason = 'not_interested' AND source = 'franchise' AND genre_ids = ARRAY[35] AND original_language IS NULL AND release_year = 2019
     FROM pg_temp.answer(990000002)),
  'a stronger answer wins and keeps the stored genres'
);

-- 3. A weaker answer that brings facts: the facts are stored, the answer is not.
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at)
VALUES ('movie', 990000003, 'not_interested', 'unknown', '2026-11-01');
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at, genre_ids, original_language, release_year)
VALUES ('movie', 990000003, 'skip', 'you_might_like', '2026-11-20', ARRAY[18], 'fr', 2001)
  ON CONFLICT (media, tmdb_id) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, answered_at = EXCLUDED.answered_at,
    genre_ids = EXCLUDED.genre_ids, original_language = EXCLUDED.original_language, release_year = EXCLUDED.release_year;
SELECT pg_temp.assert_true(
  (SELECT reason = 'not_interested' AND source = 'unknown' AND answered_at = '2026-11-01'
     AND genre_ids = ARRAY[18] AND original_language = 'fr' AND release_year = 2001 FROM pg_temp.answer(990000003)),
  'facts arriving with a weaker answer are stored, and the stronger answer kept'
);

-- 4. The one-off fill, as written: only rows with no facts, and never the answer.
INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, reason, source, answered_at)
VALUES ('movie', 990000004, 'skip', 'unknown', '2026-10-01');
UPDATE public.watchlist_dismissed_suggestions AS d
SET genre_ids = v.genre_ids, original_language = v.lang, release_year = v.year
FROM (VALUES
  ((SELECT id FROM pg_temp.answer(990000004)), ARRAY[99]::integer[], 'de', 1999::smallint),
  ((SELECT id FROM pg_temp.answer(990000003)), ARRAY[99]::integer[], 'de', 1999::smallint)
) AS v(id, genre_ids, lang, year)
WHERE d.id = v.id AND d.genre_ids IS NULL AND d.original_language IS NULL AND d.release_year IS NULL;
SELECT pg_temp.assert_true(
  (SELECT reason = 'skip' AND source = 'unknown' AND answered_at = '2026-10-01' AND genre_ids = ARRAY[99] AND release_year = 1999
     FROM pg_temp.answer(990000004)),
  'the fill adds facts without touching the answer'
);
SELECT pg_temp.assert_true(
  (SELECT genre_ids = ARRAY[18] AND original_language = 'fr' FROM pg_temp.answer(990000003)),
  'the fill leaves a row that already has facts alone'
);

-- 5. Facts the table refuses.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, original_language) VALUES ('movie', 990000005, 'English');
    RAISE EXCEPTION 'Assertion failed: a language that is not a code is refused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, release_year) VALUES ('movie', 990000005, 1869);
    RAISE EXCEPTION 'Assertion failed: a year before film is refused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.watchlist_dismissed_suggestions (media, tmdb_id, genre_ids) VALUES ('movie', 990000005, '{}');
    RAISE EXCEPTION 'Assertion failed: an empty genre list is refused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

SELECT pg_temp.assert_true(NOT has_table_privilege('anon', 'public.watchlist_dismissed_suggestions', 'INSERT'), 'anon cannot insert answers');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon', 'public.watchlist_dismissed_suggestions_keep_stronger()', 'EXECUTE'), 'anon cannot call keep_stronger');

ROLLBACK;
