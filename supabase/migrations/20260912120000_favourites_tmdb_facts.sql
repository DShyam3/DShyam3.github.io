-- Favourites: three TMDB "facts" columns so the favourites grid can derive
-- its category bucket (Bollywood / Hollywood / Anime / K-Drama / Others) from
-- TMDB data instead of the string frozen into `category` at add-time.
--
-- `category` was written once, on insert, from whatever the add-flow guessed
-- at the time -- it cannot reflect a better derivation rule later, and it
-- cannot be recomputed without re-fetching TMDB. original_language (ISO
-- 639-1), origin_country (ISO 3166-1 alpha-2) and genre_ids together let the
-- bucket be derived from source data on every read instead: origin_country
-- "KR" or original_language "ko" -> K-Drama, "ja"/"JP" -> Anime candidate,
-- genre_id 16 (Animation) narrows it further, and so on.
--
-- All three are left NULL on every existing row and are not backfilled here.
-- The values only exist in TMDB, not in this database, and filling them in
-- SQL would mean inventing them -- a fabricated language or genre reads
-- exactly like a real one. They are populated later by an admin-triggered
-- client action that calls TMDB directly. Until that runs for a given row,
-- `category` remains the fallback: the derivation reads original_language /
-- origin_country / genre_ids first and only falls back to category when they
-- are null, so existing rows keep classifying correctly in the meantime.
--
-- `category` itself is untouched -- same column, same default, same values --
-- because it is still the fallback path, not a column being replaced.
--
-- No RLS, policy or grant changes: `public.favourites` already carries
-- table-wide RLS (SELECT USING (true), INSERT/UPDATE/DELETE gated on
-- is_admin()) and table-wide grants (SELECT to anon; ALL to authenticated and
-- service_role, with anon's INSERT/UPDATE/DELETE/TRUNCATE already revoked in
-- 20260905160000). Postgres privileges and RLS policies are table-wide, not
-- per-column, so three new nullable columns on an existing table are covered
-- by what is already there.

BEGIN;

ALTER TABLE "public"."favourites"
    ADD COLUMN IF NOT EXISTS "original_language" "text";

ALTER TABLE "public"."favourites"
    ADD COLUMN IF NOT EXISTS "origin_country" "text"[];

ALTER TABLE "public"."favourites"
    ADD COLUMN IF NOT EXISTS "genre_ids" integer[];

COMMENT ON COLUMN "public"."favourites"."original_language" IS
    'TMDB''s original_language (ISO 639-1, e.g. "ko", "ja", "hi", "en"), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."origin_country" IS
    'TMDB''s origin_country (ISO 3166-1 alpha-2, e.g. "{KR}", "{JP}"), for deriving the favourites grid''s category bucket (e.g. K-Drama, Anime) from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."genre_ids" IS
    'TMDB genre ids (e.g. 16 = Animation, 18 = Drama), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMIT;
