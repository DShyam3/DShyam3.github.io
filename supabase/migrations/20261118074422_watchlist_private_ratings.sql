-- Personal ratings become owner-only. Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

-- The owner's personal scores, kept out of the public-read watchlist tables so
-- a visitor can never read them through the API. One row per rated target;
-- exactly one of the four target columns is set. The UNIQUE constraints back
-- client upserts (onConflict on each column) and index the foreign keys.
-- No updated_at trigger exists in 01_functions.sql, so the client sets it.
CREATE TABLE IF NOT EXISTS "public"."watchlist_ratings" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "movie_id" integer REFERENCES "public"."movies"("id") ON DELETE CASCADE,
    "tv_show_id" integer REFERENCES "public"."tv_shows"("id") ON DELETE CASCADE,
    "season_id" integer REFERENCES "public"."tv_show_seasons"("id") ON DELETE CASCADE,
    "episode_id" integer REFERENCES "public"."tv_show_episodes"("id") ON DELETE CASCADE,
    "rating" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_ratings_rating_check" CHECK (("rating" BETWEEN 0.5 AND 10 AND mod("rating", 0.5) = 0)),
    CONSTRAINT "watchlist_ratings_one_target_check" CHECK (num_nonnulls("movie_id", "tv_show_id", "season_id", "episode_id") = 1),
    CONSTRAINT "watchlist_ratings_movie_id_key" UNIQUE ("movie_id"),
    CONSTRAINT "watchlist_ratings_tv_show_id_key" UNIQUE ("tv_show_id"),
    CONSTRAINT "watchlist_ratings_season_id_key" UNIQUE ("season_id"),
    CONSTRAINT "watchlist_ratings_episode_id_key" UNIQUE ("episode_id")
);

ALTER TABLE "public"."watchlist_ratings" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_ratings" IS
    'The owner''s personal scores for films, shows, seasons and episodes; kept apart from the public watchlist tables so they are never readable by visitors; exactly one target per row.';

ALTER TABLE "public"."watchlist_ratings" ENABLE ROW LEVEL SECURITY;

-- Admin only, reads included. No anon policy at all.
CREATE POLICY "Admin read" ON "public"."watchlist_ratings" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."watchlist_ratings" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."watchlist_ratings" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."watchlist_ratings" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- anon holds nothing: TRUNCATE is not filtered by RLS, so the grant is the
-- only barrier. The identity column needs no sequence grant.
REVOKE ALL ON TABLE "public"."watchlist_ratings" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."watchlist_ratings" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_ratings" TO "service_role";

-- Copy the existing scores across before the columns go.
INSERT INTO "public"."watchlist_ratings" ("movie_id", "rating")
SELECT "id", "personal_rating" FROM "public"."movies" WHERE "personal_rating" IS NOT NULL;

INSERT INTO "public"."watchlist_ratings" ("tv_show_id", "rating")
SELECT "id", "personal_rating" FROM "public"."tv_shows" WHERE "personal_rating" IS NOT NULL;

INSERT INTO "public"."watchlist_ratings" ("season_id", "rating")
SELECT "id", "personal_rating" FROM "public"."tv_show_seasons" WHERE "personal_rating" IS NOT NULL;

INSERT INTO "public"."watchlist_ratings" ("episode_id", "rating")
SELECT "id", "personal_rating" FROM "public"."tv_show_episodes" WHERE "personal_rating" IS NOT NULL;

ALTER TABLE "public"."movies" DROP CONSTRAINT IF EXISTS "movies_personal_rating_check";
ALTER TABLE "public"."tv_shows" DROP CONSTRAINT IF EXISTS "tv_shows_personal_rating_check";
ALTER TABLE "public"."tv_show_seasons" DROP CONSTRAINT IF EXISTS "tv_show_seasons_personal_rating_check";
ALTER TABLE "public"."tv_show_episodes" DROP CONSTRAINT IF EXISTS "tv_show_episodes_personal_rating_check";

ALTER TABLE "public"."movies" DROP COLUMN IF EXISTS "personal_rating";
ALTER TABLE "public"."tv_shows" DROP COLUMN IF EXISTS "personal_rating";
ALTER TABLE "public"."tv_show_seasons" DROP COLUMN IF EXISTS "personal_rating";
ALTER TABLE "public"."tv_show_episodes" DROP COLUMN IF EXISTS "personal_rating";

-- Latest episode watch date per series, so the Library can sort finished
-- series by when they were watched. security_invoker keeps the underlying
-- RLS in force; tv_show_episodes.watched_at is already public-read, so this
-- exposes nothing new.
CREATE OR REPLACE VIEW "public"."watchlist_show_last_watched" WITH (security_invoker = true) AS
SELECT s.tv_show_id,
       max(e.watched_at) AS last_watched_at
FROM   "public"."tv_show_episodes" e
JOIN   "public"."tv_show_seasons"  s ON s.id = e.season_id
WHERE  e.watched_at IS NOT NULL
GROUP  BY s.tv_show_id;

COMMENT ON VIEW "public"."watchlist_show_last_watched" IS
    'The most recent episode watched_at per series, for sorting finished series by when they were watched. Series with no dated watch are absent. security_invoker; public read, like the episode table beneath it.';

REVOKE ALL ON TABLE "public"."watchlist_show_last_watched" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_show_last_watched" TO "anon", "authenticated";

COMMIT;
