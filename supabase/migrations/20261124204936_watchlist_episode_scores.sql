-- Store per-episode IMDb and TMDB community ratings on tv_show_episodes, and
-- track per-season TMDB episode-score sync and OMDb season-score lookup
-- timestamps on tv_show_seasons.
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

ALTER TABLE "public"."tv_show_episodes"
    ADD COLUMN IF NOT EXISTS "imdb_id" "text",
    ADD COLUMN IF NOT EXISTS "imdb_rating" numeric(3,1),
    ADD COLUMN IF NOT EXISTS "tmdb_rating" numeric(3,1),
    ADD COLUMN IF NOT EXISTS "tmdb_votes" integer;

ALTER TABLE "public"."tv_show_episodes"
    DROP CONSTRAINT IF EXISTS "tv_show_episodes_imdb_id_check";
ALTER TABLE "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_imdb_id_check" CHECK ("imdb_id" ~ '^tt[0-9]{7,10}$');

ALTER TABLE "public"."tv_show_episodes"
    DROP CONSTRAINT IF EXISTS "tv_show_episodes_imdb_rating_check";
ALTER TABLE "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_imdb_rating_check" CHECK ("imdb_rating" BETWEEN 0 AND 10);

ALTER TABLE "public"."tv_show_episodes"
    DROP CONSTRAINT IF EXISTS "tv_show_episodes_tmdb_rating_check";
ALTER TABLE "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_tmdb_rating_check" CHECK ("tmdb_rating" BETWEEN 0 AND 10);

ALTER TABLE "public"."tv_show_episodes"
    DROP CONSTRAINT IF EXISTS "tv_show_episodes_tmdb_votes_check";
ALTER TABLE "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_tmdb_votes_check" CHECK ("tmdb_votes" >= 0);

COMMENT ON COLUMN "public"."tv_show_episodes"."imdb_id" IS
    'IMDb episode id (tt + 7..10 digits) from OMDb''s ?Season=N response; null when unknown.';

COMMENT ON COLUMN "public"."tv_show_episodes"."imdb_rating" IS
    'IMDb weighted user rating (0..10) from OMDb''s ?Season=N response; null when unknown or unrated.';

COMMENT ON COLUMN "public"."tv_show_episodes"."tmdb_rating" IS
    'TMDB community episode rating (0..10) from tv/{id}/season/{n}; null when unrated (vote_average = 0 or not fetched yet).';

COMMENT ON COLUMN "public"."tv_show_episodes"."tmdb_votes" IS
    'TMDB vote count (>= 0) from tv/{id}/season/{n}; null until synced.';

ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN IF NOT EXISTS "episodes_checked_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "scores_checked_at" timestamp with time zone;

COMMENT ON COLUMN "public"."tv_show_seasons"."episodes_checked_at" IS
    'When watchlist-cron-sync (or the add flow) last fetched tv/{id}/season/{n} from TMDB with episode scores. Null on pre-migration seasons so settled seasons backfill once and then stay quiet.';

COMMENT ON COLUMN "public"."tv_show_seasons"."scores_checked_at" IS
    'When watchlist-cron-sync last asked OMDb (?i=<show_imdb_id>&Season=<n>) for this season''s episode IMDb ratings. Null means never asked; stamped even when OMDb has no entry so missing seasons are not retried every night.';

COMMIT;
