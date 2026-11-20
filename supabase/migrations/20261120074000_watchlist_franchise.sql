-- Custom franchise grouping on the watchlist: adds a nullable `franchise` text
-- column to `public.movies` and `public.tv_shows` so titles (films and series
-- together) can be assigned to a franchise directly in Supabase without
-- depending on TMDB collection lookups or Wikidata spin-offs.
--
-- ## RLS and Grants
--
-- No RLS or grant changes are needed. Table-level grants (SELECT to anon,
-- SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role) apply to
-- all columns on movies and tv_shows. Existing "Admin insert", "Admin update",
-- "Admin delete" policies verify `(SELECT public.is_admin())` and
-- "Public Read Access" allows SELECT.

BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "franchise" text;

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "franchise" text;

COMMENT ON COLUMN "public"."movies"."franchise" IS
    'Optional custom franchise name assigned in the library (e.g. "Marvel Cinematic Universe"). Null means not assigned.';

COMMENT ON COLUMN "public"."tv_shows"."franchise" IS
    'Optional custom franchise name assigned in the library (e.g. "Taylor Sheridan Universe"). Null means not assigned.';

COMMIT;
