-- Store TMDB community rating and vote count on movies and tv_shows so the
-- detail view works without a live TMDB proxy call and nightly sync keeps
-- them up to date.

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "tmdb_rating" numeric(3,1),
    ADD COLUMN IF NOT EXISTS "tmdb_votes" integer,
    ADD CONSTRAINT "movies_tmdb_rating_check" CHECK ("tmdb_rating" BETWEEN 0 AND 10),
    ADD CONSTRAINT "movies_tmdb_votes_check" CHECK ("tmdb_votes" >= 0);

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "tmdb_rating" numeric(3,1),
    ADD COLUMN IF NOT EXISTS "tmdb_votes" integer,
    ADD CONSTRAINT "tv_shows_tmdb_rating_check" CHECK ("tmdb_rating" BETWEEN 0 AND 10),
    ADD CONSTRAINT "tv_shows_tmdb_votes_check" CHECK ("tmdb_votes" >= 0);
