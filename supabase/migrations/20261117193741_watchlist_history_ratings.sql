-- Preserve watch history and optional owner ratings on the existing records.
-- No rows are deleted or inferred to be watched. Existing public SELECT and
-- admin-only write policies/grants continue to cover these added columns.
-- Unconstrained numeric preserves submitted precision so the half-point CHECK
-- rejects values such as 7.49 instead of silently rounding them to 7.5.
BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN "watched" boolean DEFAULT false NOT NULL,
    ADD COLUMN "watched_at" timestamp with time zone,
    ADD COLUMN "library_state" text DEFAULT 'active' NOT NULL,
    ADD COLUMN "personal_rating" numeric;

ALTER TABLE "public"."tv_shows"
    ADD COLUMN "library_state" text DEFAULT 'active' NOT NULL,
    ADD COLUMN "personal_rating" numeric;

ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN "personal_rating" numeric;

ALTER TABLE "public"."tv_show_episodes"
    ADD COLUMN "personal_rating" numeric;

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_personal_rating_check"
    CHECK ("personal_rating" IS NULL OR ("personal_rating" BETWEEN 0.5 AND 10 AND mod("personal_rating", 0.5) = 0));

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_personal_rating_check"
    CHECK ("personal_rating" IS NULL OR ("personal_rating" BETWEEN 0.5 AND 10 AND mod("personal_rating", 0.5) = 0));

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_personal_rating_check"
    CHECK ("personal_rating" IS NULL OR ("personal_rating" BETWEEN 0.5 AND 10 AND mod("personal_rating", 0.5) = 0));

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_personal_rating_check"
    CHECK ("personal_rating" IS NULL OR ("personal_rating" BETWEEN 0.5 AND 10 AND mod("personal_rating", 0.5) = 0));

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_library_state_check"
    CHECK ("library_state" IN ('active', 'hidden', 'stopped'));

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_library_state_check"
    CHECK ("library_state" IN ('active', 'hidden', 'stopped'));

-- Film watch dates use the same transition-aware stamping as episodes.
CREATE TRIGGER "tr_set_movie_watched_at" BEFORE INSERT OR UPDATE OF "watched" ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."set_watched_at"();

COMMIT;
