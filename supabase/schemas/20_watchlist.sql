CREATE TABLE IF NOT EXISTS "public"."favourites" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "poster" "text",
    "media_type" "text" DEFAULT 'movie'::"text" NOT NULL,
    "tmdb_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'Hollywood'::"text",
    "original_language" "text",
    "origin_country" "text"[],
    "genre_ids" integer[],
    CONSTRAINT "favourites_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);

ALTER TABLE "public"."favourites" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."favourites_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."favourites_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."favourites_id_seq" OWNED BY "public"."favourites"."id";

CREATE TABLE IF NOT EXISTS "public"."movies" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text",
    "genre" "text",
    "release_year" integer,
    "poster" "text",
    "backdrop" "text",
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer,
    "original_language" "text",
    "origin_country" "text"[],
    "genre_ids" integer[],
    "runtime" integer,
    "pinned" boolean DEFAULT false NOT NULL,
    "trailer_key" "text",
    "directors" "text"[],
    "top_cast" "text"[],
    "watched" boolean DEFAULT false NOT NULL,
    "watched_at" timestamp with time zone,
    "library_state" "text" DEFAULT 'active'::"text" NOT NULL,
    "imdb_id" "text",
    "imdb_rating" numeric(3,1),
    "imdb_votes" integer,
    "rt_score" smallint,
    "metascore" smallint,
    "tmdb_rating" numeric(3,1),
    "tmdb_votes" integer,
    "scores_checked_at" timestamp with time zone,
    "collection_id" integer,
    "collection_name" "text",
    "franchise" "text",
    "last_activity_at" timestamp with time zone,
    CONSTRAINT "movies_imdb_id_check" CHECK ("imdb_id" ~ '^tt[0-9]{7,10}$'),
    CONSTRAINT "movies_imdb_rating_check" CHECK ("imdb_rating" BETWEEN 0 AND 10),
    CONSTRAINT "movies_imdb_votes_check" CHECK ("imdb_votes" >= 0),
    CONSTRAINT "movies_rt_score_check" CHECK ("rt_score" BETWEEN 0 AND 100),
    CONSTRAINT "movies_metascore_check" CHECK ("metascore" BETWEEN 0 AND 100),
    CONSTRAINT "movies_tmdb_rating_check" CHECK ("tmdb_rating" BETWEEN 0 AND 10),
    CONSTRAINT "movies_tmdb_votes_check" CHECK ("tmdb_votes" >= 0)
);

ALTER TABLE "public"."movies" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."movies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."movies_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."movies_id_seq" OWNED BY "public"."movies"."id";

CREATE TABLE IF NOT EXISTS "public"."sync_log" (
    "id" integer NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sync_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "items_synced" integer DEFAULT 0,
    "error_message" "text",
    "duration_ms" integer DEFAULT 0,
    "shard" smallint,
    "shard_count" smallint,
    CONSTRAINT "sync_log_shard_check" CHECK (
        ("shard" IS NULL AND "shard_count" IS NULL)
        OR (
            "shard" IS NOT NULL
            AND "shard_count" IS NOT NULL
            AND "shard_count" BETWEEN 1 AND 10
            AND "shard" >= 0
            AND "shard" < "shard_count"
        )
    )
);

ALTER TABLE "public"."sync_log" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."sync_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."sync_log_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."sync_log_id_seq" OWNED BY "public"."sync_log"."id";

CREATE TABLE IF NOT EXISTS "public"."tv_show_episodes" (
    "id" integer NOT NULL,
    "season_id" integer,
    "episode_number" integer NOT NULL,
    "release_date" "date",
    "watched" boolean DEFAULT false,
    "runtime" integer,
    "title" "text",
    "watched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."tv_show_episodes" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."tv_show_episodes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."tv_show_episodes_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."tv_show_episodes_id_seq" OWNED BY "public"."tv_show_episodes"."id";

CREATE TABLE IF NOT EXISTS "public"."tv_show_seasons" (
    "id" integer NOT NULL,
    "tv_show_id" integer,
    "season_number" integer NOT NULL,
    "release_year" integer,
    "watched" boolean DEFAULT false,
    "release_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "trailer_key" "text",
    "trailer_checked_at" timestamp with time zone
);

ALTER TABLE "public"."tv_show_seasons" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."tv_show_seasons_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."tv_show_seasons_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."tv_show_seasons_id_seq" OWNED BY "public"."tv_show_seasons"."id";

CREATE TABLE IF NOT EXISTS "public"."tv_shows" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "genre" "text",
    "status" "text",
    "poster" "text",
    "backdrop" "text",
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer,
    "original_language" "text",
    "origin_country" "text"[],
    "genre_ids" integer[],
    "pinned" boolean DEFAULT false NOT NULL,
    "trailer_key" "text",
    "creators" "text"[],
    "top_cast" "text"[],
    "library_state" "text" DEFAULT 'active'::"text" NOT NULL,
    "imdb_id" "text",
    "imdb_rating" numeric(3,1),
    "imdb_votes" integer,
    "rt_score" smallint,
    "metascore" smallint,
    "tmdb_rating" numeric(3,1),
    "tmdb_votes" integer,
    "scores_checked_at" timestamp with time zone,
    "franchise" "text",
    "last_activity_at" timestamp with time zone,
    CONSTRAINT "tv_shows_imdb_id_check" CHECK ("imdb_id" ~ '^tt[0-9]{7,10}$'),
    CONSTRAINT "tv_shows_imdb_rating_check" CHECK ("imdb_rating" BETWEEN 0 AND 10),
    CONSTRAINT "tv_shows_imdb_votes_check" CHECK ("imdb_votes" >= 0),
    CONSTRAINT "tv_shows_rt_score_check" CHECK ("rt_score" BETWEEN 0 AND 100),
    CONSTRAINT "tv_shows_metascore_check" CHECK ("metascore" BETWEEN 0 AND 100),
    CONSTRAINT "tv_shows_tmdb_rating_check" CHECK ("tmdb_rating" BETWEEN 0 AND 10),
    CONSTRAINT "tv_shows_tmdb_votes_check" CHECK ("tmdb_votes" >= 0)
);

ALTER TABLE "public"."tv_shows" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."tv_shows_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."tv_shows_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."tv_shows_id_seq" OWNED BY "public"."tv_shows"."id";

-- One append-only row per platform or status change on tv_shows/movies, so
-- the News page has history instead of a column the nightly sync silently
-- overwrites. Written by log_watchlist_event() (01_functions.sql) via
-- triggers on both tables, below -- never written directly by the app.
CREATE TABLE IF NOT EXISTS "public"."watchlist_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "entity_type" "text" NOT NULL,
    "entity_id" integer NOT NULL,
    "kind" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "watchlist_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['tv_show'::"text", 'movie'::"text"]))),
    CONSTRAINT "watchlist_events_kind_check" CHECK (("kind" = ANY (ARRAY['platform_change'::"text", 'status_change'::"text"])))
);

ALTER TABLE "public"."watchlist_events" OWNER TO "postgres";

COMMENT ON COLUMN "public"."watchlist_events"."entity_id" IS
    'References tv_shows.id or movies.id depending on entity_type. Deliberately no foreign key: a single FK column cannot point at two different parent tables, and entity_id alone is not unique across them (a tv_show and a movie can share an id). Integrity is enforced by the trigger that is the only writer -- log_watchlist_event() -- not by a constraint.';

CREATE TABLE IF NOT EXISTS "public"."weekly_schedule" (
    "id" integer NOT NULL,
    "tv_show_id" integer,
    "day_of_week" "text" NOT NULL,
    "movie_id" bigint,
    "scheduled_date" date,
    "schedule_mode" "text" DEFAULT 'weekly'::"text" NOT NULL,
    CONSTRAINT "weekly_schedule_day_of_week_check" CHECK (("day_of_week" = ANY (ARRAY['Sunday'::"text", 'Monday'::"text", 'Tuesday'::"text", 'Wednesday'::"text", 'Thursday'::"text", 'Friday'::"text", 'Saturday'::"text"]))),
    CONSTRAINT "weekly_schedule_schedule_mode_check" CHECK (("schedule_mode" = ANY (ARRAY['weekly'::"text", 'date'::"text"])))
);

ALTER TABLE "public"."weekly_schedule" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."weekly_schedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."weekly_schedule_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."weekly_schedule_id_seq" OWNED BY "public"."weekly_schedule"."id";

ALTER TABLE ONLY "public"."favourites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."favourites_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."movies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movies_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."sync_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sync_log_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."tv_show_episodes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_show_episodes_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."tv_show_seasons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_show_seasons_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."tv_shows" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_shows_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."weekly_schedule" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."weekly_schedule_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."favourites"
    ADD CONSTRAINT "favourites_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_trailer_key_format" CHECK ((trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$'));

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "seasons_unique_match" UNIQUE ("tv_show_id", "season_number");

ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_trailer_key_format" CHECK ((trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$'));

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_trailer_key_format" CHECK ((trailer_key IS NULL OR trailer_key ~ '^[A-Za-z0-9_-]{6,20}$'));

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "unique_episode_per_season" UNIQUE ("season_id", "episode_number");

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_tv_show_id_day_of_week_key" UNIQUE ("tv_show_id", "day_of_week");

-- Partial: only films in a TMDB collection are ever looked up by it.
CREATE INDEX IF NOT EXISTS "movies_collection_id_idx" ON "public"."movies" USING "btree" ("collection_id") WHERE ("collection_id" IS NOT NULL);

ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_library_state_check"
    CHECK ("library_state" IN ('active', 'hidden', 'stopped'));

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_library_state_check"
    CHECK ("library_state" IN ('active', 'paused', 'hidden', 'stopped'));

CREATE INDEX "idx_tv_shows_tmdb_id" ON "public"."tv_shows" USING "btree" ("tmdb_id");

CREATE INDEX "idx_weekly_schedule_movie_id" ON "public"."weekly_schedule" USING "btree" ("movie_id");

-- Date-mode rows are read by month-range queries in the calendar. Weekly rows
-- remain keyed by their weekday and are not included in this partial index.
CREATE INDEX "idx_weekly_schedule_scheduled_date" ON "public"."weekly_schedule" USING "btree" ("scheduled_date") WHERE ("schedule_mode" = 'date'::"text");

-- Partial: the view below (and every "what's next" query) only ever reads
-- unwatched rows, so there is no reason to index the rest.
CREATE INDEX IF NOT EXISTS "tv_show_episodes_up_next_idx" ON "public"."tv_show_episodes" USING "btree" ("season_id", "episode_number") WHERE ("watched" = false);

-- Every consumer of watchlist_events (the News page feed) reads newest-first
-- and nothing reads it any other way.
CREATE INDEX "watchlist_events_occurred_at_idx" ON "public"."watchlist_events" USING "btree" ("occurred_at" DESC);

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."tv_show_seasons"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_tv_show_id_fkey" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_tv_show_id_fkey" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE CASCADE;

CREATE POLICY "Admin delete" ON "public"."movies" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."tv_show_episodes" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."tv_show_seasons" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."tv_shows" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."weekly_schedule" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete favourites" ON "public"."favourites" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete sync_log" ON "public"."sync_log" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."movies" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."tv_show_episodes" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."tv_show_seasons" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."tv_shows" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."weekly_schedule" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert favourites" ON "public"."favourites" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert sync_log" ON "public"."sync_log" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

-- watchlist_events deliberately has no INSERT policy. Its only writer is the
-- trigger function log_watchlist_event() (01_functions.sql), which is SECURITY
-- DEFINER and so inserts as its owner, postgres, without the caller holding
-- INSERT. That covers the browser sync (WatchlistContext.tsx, a signed-in
-- admin) and watchlist-cron-sync's nightly UPSERT alike, since both cause the
-- row by updating tv_shows/movies. No signed-in role can insert directly, admin
-- included; service_role bypasses RLS and keeps its grant.

CREATE POLICY "Admin read sync_log" ON "public"."sync_log" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."movies" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."tv_show_episodes" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."tv_show_seasons" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."tv_shows" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."weekly_schedule" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update favourites" ON "public"."favourites" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Anyone can read favourites" ON "public"."favourites" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."movies" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_show_episodes" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_show_seasons" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_shows" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."weekly_schedule" FOR SELECT USING (true);

-- Public read, same as every sibling table above: this table holds show
-- names and platform names, nothing private. No INSERT, UPDATE or DELETE
-- policy anywhere in this file for this table -- events are append-only,
-- written only by the definer trigger, and nothing should ever be able to
-- rewrite history.
CREATE POLICY "Public Read Access" ON "public"."watchlist_events" FOR SELECT USING (true);

ALTER TABLE "public"."favourites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_show_episodes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_show_seasons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_shows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."weekly_schedule" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."watchlist_events" ENABLE ROW LEVEL SECURITY;

-- Triggers live here rather than with the functions in 01_functions.sql:
-- schema files run in filename order, so the tables must exist first.

CREATE OR REPLACE TRIGGER "tr_update_episodes_watched" AFTER UPDATE OF "watched" ON "public"."tv_show_seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_episodes_watched_status"();

CREATE OR REPLACE TRIGGER "tr_update_season_watched" AFTER INSERT OR DELETE OR UPDATE OF "watched" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_watched_status"();

-- Stamps `watched_at` from the `watched` boolean so none of the four write
-- paths (WatchlistContext.tsx's single-episode toggle, its bulk season
-- toggle, its browser sync upsert, and watchlist-cron-sync's Deno upsert)
-- have to carry that logic themselves. See set_watched_at() in
-- 01_functions.sql for why it runs BEFORE rather than AFTER, and why a
-- same-value UPDATE (the shape of every row the nightly cron touches) must
-- be a no-op.
DROP TRIGGER IF EXISTS "tr_set_watched_at" ON "public"."tv_show_episodes";

CREATE TRIGGER "tr_set_watched_at" BEFORE INSERT OR UPDATE OF "watched" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."set_watched_at"();

-- Film watch dates use the same transition-aware stamping as episodes.
CREATE TRIGGER "tr_set_movie_watched_at" BEFORE INSERT OR UPDATE OF "watched" ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."set_watched_at"();

-- Owner-activity timestamp for ranking Discover franchises. BEFORE, so the
-- stamp lands in the same write; the column lists keep a cron metadata
-- UPDATE from firing these at all, and the function body is the second guard.
-- See touch_last_activity_at() in 01_functions.sql.
DROP TRIGGER IF EXISTS "tr_touch_movie_last_activity" ON "public"."movies";

CREATE TRIGGER "tr_touch_movie_last_activity" BEFORE INSERT OR UPDATE OF "watched", "watched_at", "library_state" ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_activity_at"();

DROP TRIGGER IF EXISTS "tr_touch_tv_show_last_activity" ON "public"."tv_shows";

CREATE TRIGGER "tr_touch_tv_show_last_activity" BEFORE INSERT OR UPDATE OF "library_state" ON "public"."tv_shows" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_activity_at"();

-- Series are watched on episodes, so an episode flip bumps its show. UPDATE
-- only: episode INSERT is the cron adding newly aired episodes, not the owner.
-- Row-level because Postgres refuses transition tables on a trigger with a
-- column list; the function's IS DISTINCT guard collapses a season toggle to
-- one show write.
DROP TRIGGER IF EXISTS "tr_touch_show_last_activity_from_episode" ON "public"."tv_show_episodes";

CREATE TRIGGER "tr_touch_show_last_activity_from_episode" AFTER UPDATE OF "watched", "watched_at" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_show_last_activity_from_episode"();

-- Records platform/status history into watchlist_events for the News page.
-- One function (log_watchlist_event(), 01_functions.sql) on triggers over
-- both tv_shows and movies -- see README.md:101 for why the watchlist sync
-- is already two runtime implementations (WatchlistContext.tsx and
-- watchlist-cron-sync), and why a detection rule belongs here instead of
-- becoming a third and fourth copy in TypeScript.
CREATE OR REPLACE TRIGGER "tr_log_tv_show_watchlist_event" AFTER UPDATE ON "public"."tv_shows" FOR EACH ROW EXECUTE FUNCTION "public"."log_watchlist_event"();

CREATE OR REPLACE TRIGGER "tr_log_movie_watchlist_event" AFTER UPDATE ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."log_watchlist_event"();

-- Derives "what to watch next" per show so the same rule lives in one place
-- for both the Vite bundle and the watchlist-cron-sync Deno function, instead
-- of being reimplemented in TypeScript on each side.
--
-- `security_invoker = true` is load-bearing, not decoration: without it this
-- view runs as its owner and reads straight past the RLS on the three
-- underlying tables, turning a public-read surface into an admin-only-in-name
-- one. Postgres 15.8 supports it; this must not ship without it.
--
-- Season 0 is TMDB's "Specials". It sorts ahead of season 1 under the
-- DISTINCT ON ordering, so without `season_number > 0` a show with an unwatched
-- special led Watch Next with it. A show whose only unwatched episodes are
-- specials is therefore absent from the view; that is intended.
CREATE OR REPLACE VIEW "public"."watchlist_up_next" WITH (security_invoker = true) AS
SELECT DISTINCT ON (s.tv_show_id)
       s.tv_show_id,
       sh.title,
       sh.poster,
       sh.platform,
       s.season_number,
       e.episode_number,
       e.title         AS episode_title,
       e.release_date,
       e.runtime,
       CASE
         WHEN e.release_date IS NULL            THEN 'unscheduled'
         WHEN e.release_date <= CURRENT_DATE     THEN 'ready'
         ELSE                                         'upcoming'
       END             AS state,
       -- Distinguishes "continue watching" from "start watching". Without it
       -- the view cannot tell a show mid-run from one never opened, and the
       -- Up Next rail would invite you to begin twelve things at once.
       EXISTS (
         SELECT 1
         FROM   "public"."tv_show_episodes" we
         JOIN   "public"."tv_show_seasons"  ws ON ws.id = we.season_id
         WHERE  ws.tv_show_id = s.tv_show_id
           AND  we.watched = true
       )               AS has_started,
       -- True when an episode of THIS SAME season is already watched, i.e. you
       -- are mid-run rather than merely having finished something years ago.
       -- has_started cannot make that distinction: a show whose S1 you
       -- completed in 2023 has_started forever, which is what turned the Up
       -- Next rail into the whole library. The rail filters on this OR a
       -- recent air date; the difference is "keep going" versus "just dropped".
       EXISTS (
         SELECT 1
         FROM   "public"."tv_show_episodes" se
         WHERE  se.season_id = e.season_id
           AND  se.watched = true
       )               AS season_in_progress
FROM   "public"."tv_show_episodes" e
JOIN   "public"."tv_show_seasons"  s  ON s.id = e.season_id
JOIN   "public"."tv_shows"         sh ON sh.id = s.tv_show_id
WHERE  e.watched = false
  AND  s.season_number > 0
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

-- Grants

GRANT SELECT ON TABLE "public"."favourites" TO "anon";

REVOKE ALL ON TABLE "public"."favourites" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."favourites" TO "authenticated";

GRANT ALL ON TABLE "public"."favourites" TO "service_role";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."movies" TO "anon";

REVOKE ALL ON TABLE "public"."movies" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."movies" TO "authenticated";

GRANT ALL ON TABLE "public"."movies" TO "service_role";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "service_role";

REVOKE ALL ON TABLE "public"."sync_log" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."sync_log" TO "authenticated";

GRANT ALL ON TABLE "public"."sync_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_show_episodes" TO "anon";

REVOKE ALL ON TABLE "public"."tv_show_episodes" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."tv_show_episodes" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_show_seasons" TO "anon";

REVOKE ALL ON TABLE "public"."tv_show_seasons" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."tv_show_seasons" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_shows" TO "anon";

REVOKE ALL ON TABLE "public"."tv_shows" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."tv_shows" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_shows" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."weekly_schedule" TO "anon";

REVOKE ALL ON TABLE "public"."weekly_schedule" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."weekly_schedule" TO "authenticated";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "service_role";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "service_role";

-- watchlist_up_next is a read composition of three already-public-read
-- tables (see the "Public Read Access" policies above), so it is a public
-- surface deliberately, not an oversight -- it carries no is_admin() gate.
--
-- SELECT only: a fresh build starts from the image's default of ALL on a newly
-- created view (90_privileges.sql narrows the default last), and pg_dump emits
-- GRANT and never REVOKE, so without the REVOKE below anon and authenticated
-- would hold INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on it
-- as they did before 20260929202643.
REVOKE ALL ON TABLE "public"."watchlist_up_next" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "anon", "authenticated";

-- watchlist_events grants: narrower than every other table in this file, on
-- purpose. A fresh build starts from the image's default of ALL on a newly
-- created public table for anon, authenticated and service_role (90_privileges.sql
-- narrows the default last), so the REVOKE lines here are not idle defence --
-- without them this table would start out exactly as over-granted as every
-- sibling table was before 20260905160000 and 20260912130000 narrowed them.
--
-- anon: SELECT only, same reasoning as every table above -- show names and
-- platform names, nothing private.
--
-- authenticated: SELECT only, same as anon (the signed-in admin reads the News
-- feed through the "Public Read Access" policy, which has no TO clause).
-- log_watchlist_event() is SECURITY DEFINER (see 01_functions.sql), so its
-- INSERT runs as the function owner and the caller needs no INSERT here; that
-- is what lets this grant and the INSERT policy both be absent. No INSERT,
-- UPDATE, DELETE or TRUNCATE grant: this table is append-only, and revoking
-- those at the grant layer (not just relying on "no policy exists for them")
-- means a future RLS mistake here still cannot write or rewrite history.
-- TRUNCATE in particular is never subject to RLS at all, which is exactly the
-- gap 20260912130000 closed for anon on the other six tables -- here it is
-- closed for authenticated too, because nothing legitimate needs it.
--
-- service_role: ALL, matching every table above -- its bypass of RLS does not
-- bypass the underlying grant.
REVOKE ALL ON TABLE "public"."watchlist_events" FROM "anon";

REVOKE ALL ON TABLE "public"."watchlist_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "anon";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_events" TO "service_role";

-- ## Viewing orders

-- Viewing orders: hand-built franchise watch orders (e.g. the MCU) that mix
-- films and shows and may name titles that are not in the library, so each
-- entry carries its own small snapshot (title, poster, release_date) rather
-- than a foreign key into movies or tv_shows. media_type + tmdb_id identify
-- the title; nothing joins on them as a constraint.
CREATE TABLE IF NOT EXISTS "public"."viewing_orders" (
    "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "name" "text" NOT NULL,
    "description" "text",
    "tmdb_collection_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "viewing_orders_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
    CONSTRAINT "viewing_orders_description_check" CHECK ("description" IS NULL OR char_length("description") <= 500)
);

ALTER TABLE "public"."viewing_orders" OWNER TO "postgres";

COMMENT ON COLUMN "public"."viewing_orders"."tmdb_collection_id" IS
    'The TMDB collection (movies.collection_id) this order was started from, if any. Informational only: the order is hand-edited after that and nothing keeps it in step with TMDB.';

CREATE TABLE IF NOT EXISTS "public"."viewing_order_entries" (
    "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "order_id" integer NOT NULL REFERENCES "public"."viewing_orders"("id") ON DELETE CASCADE,
    "position" integer NOT NULL,
    "media_type" "text" NOT NULL,
    "tmdb_id" integer NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "date",
    "poster" "text",
    "note" "text",
    CONSTRAINT "viewing_order_entries_position_check" CHECK ("position" >= 1),
    CONSTRAINT "viewing_order_entries_media_type_check" CHECK ("media_type" IN ('movie', 'tv')),
    CONSTRAINT "viewing_order_entries_tmdb_id_check" CHECK ("tmdb_id" > 0),
    CONSTRAINT "viewing_order_entries_title_check" CHECK (char_length("title") BETWEEN 1 AND 300),
    CONSTRAINT "viewing_order_entries_poster_check" CHECK ("poster" IS NULL OR char_length("poster") <= 500),
    CONSTRAINT "viewing_order_entries_note_check" CHECK ("note" IS NULL OR char_length("note") <= 200),
    CONSTRAINT "viewing_order_entries_order_title_key" UNIQUE ("order_id", "media_type", "tmdb_id")
);

ALTER TABLE "public"."viewing_order_entries" OWNER TO "postgres";

COMMENT ON COLUMN "public"."viewing_order_entries"."position" IS
    'Place in the order, from 1. Deliberately NOT unique: a unique constraint would make every drag-reorder collide with itself mid-statement. Readers order by (position, id); reorder_viewing_order() renumbers the whole order atomically.';

COMMENT ON COLUMN "public"."viewing_order_entries"."title" IS
    'Snapshot of the title, release_date and poster taken when the entry was added, so an order can list titles that are not in the library. Not kept in step with TMDB or with movies/tv_shows afterwards.';

-- Serves the position-ordered read of one order, and is the covering index for
-- the order_id foreign key (cascade deletes from viewing_orders use it too).
CREATE INDEX IF NOT EXISTS "viewing_order_entries_order_position_idx" ON "public"."viewing_order_entries" USING "btree" ("order_id", "position");

ALTER TABLE "public"."viewing_orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."viewing_order_entries" ENABLE ROW LEVEL SECURITY;

-- Public read, deliberately: the watchlist is a public page and these are
-- franchise watch orders of public titles, nothing private. Writes are admin only.
CREATE POLICY "Public Read Access" ON "public"."viewing_orders" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Admin insert" ON "public"."viewing_orders" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."viewing_orders" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."viewing_orders" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Public Read Access" ON "public"."viewing_order_entries" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Admin insert" ON "public"."viewing_order_entries" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."viewing_order_entries" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."viewing_order_entries" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- Grants, as on tv_shows: anon reads, authenticated gets the four data verbs,
-- service_role everything. Each REVOKE ALL comes first because a fresh build
-- starts from the image's default of ALL (and schemas/ applies 20_ before
-- 90_privileges, so anon would otherwise keep TRUNCATE and the rest).
REVOKE ALL ON TABLE "public"."viewing_orders" FROM "anon";

GRANT SELECT ON TABLE "public"."viewing_orders" TO "anon";

REVOKE ALL ON TABLE "public"."viewing_orders" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."viewing_orders" TO "authenticated";

GRANT ALL ON TABLE "public"."viewing_orders" TO "service_role";

REVOKE ALL ON TABLE "public"."viewing_order_entries" FROM "anon";

GRANT SELECT ON TABLE "public"."viewing_order_entries" TO "anon";

REVOKE ALL ON TABLE "public"."viewing_order_entries" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."viewing_order_entries" TO "authenticated";

GRANT ALL ON TABLE "public"."viewing_order_entries" TO "service_role";

-- Identity columns need no sequence grant for an INSERT: Postgres does not
-- check privileges on a column's own identity sequence (watchlist_events relies
-- on the same). The default privileges in 90_privileges.sql would still hand
-- anon and authenticated ALL on these two sequences, which nothing needs, so
-- they are revoked. anon in particular holds no INSERT and so no use for one.
-- service_role keeps its default grant.
REVOKE ALL ON SEQUENCE "public"."viewing_orders_id_seq" FROM "anon", "authenticated";

REVOKE ALL ON SEQUENCE "public"."viewing_order_entries_id_seq" FROM "anon", "authenticated";

-- ## Watchlist RPCs

-- Admin RPCs for the watchlist. All three are SECURITY INVOKER with an empty
-- search_path (every name schema-qualified), so the caller's RLS and grants
-- still apply to each statement; the leading is_admin() check is a second,
-- explicit gate that fails loudly instead of silently updating zero rows.
-- EXECUTE is closed to PUBLIC and anon (default privileges would otherwise
-- hand anon ALL on every new function) and given to authenticated and
-- service_role.

-- Marks episodes or movies watched or unwatched in bulk and returns how many
-- rows actually changed.
--
-- Why two statements: tr_set_watched_at (episodes) and tr_set_movie_watched_at
-- (films) stamp now() whenever `watched` flips,
-- and an UPDATE that sets watched cannot also pick a different date, because
-- the trigger runs after the SET list and overwrites it. So step 1 flips
-- `watched` (the trigger stamps now(), or clears on unwatch) and step 2
-- rewrites only watched_at. Step 2 lists watched_at alone, so the BEFORE UPDATE
-- OF watched trigger does not fire for it. Step 2 touches only the rows step 1
-- flipped: rows that were already watched keep the date they had.
--
-- A row whose release_date is still in the future is never given a watch date,
-- whatever p_when says: step 2 stores null for it ("watched, date unknown"), and
-- for 'now' the trigger itself declines to stamp it (see set_watched_at).
--
-- p_when: 'now' keeps the trigger's stamp; 'unknown' stores null ("watched,
-- date unknown"); 'at' stores p_at; 'release' stores the row's release_date at
-- 12:00 UTC (null when it has none, and null when it is still in the future:
-- marking an airing season "on release date" must not stamp future dates on
-- episodes that have not aired). Noon UTC, because release_date is a date
-- with no time: midnight UTC would land on the previous calendar day in any
-- zone west of UTC, while noon UTC stays on the same day anywhere in UK and
-- European time. p_at must be given exactly when p_when = 'at', and may not be
-- more than a day ahead of now() (the day of slack absorbs clock and timezone
-- skew; anything beyond raises 22023). p_when is ignored when p_watched is
-- false (unwatching always clears), but its arguments are still validated.
CREATE OR REPLACE FUNCTION "public"."set_watched"(
    p_kind text,
    p_ids integer[],
    p_watched boolean,
    p_when text DEFAULT 'now',
    p_at timestamptz DEFAULT NULL
) RETURNS integer
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
DECLARE
  v_flipped integer[];
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('episode', 'movie') THEN
    RAISE EXCEPTION 'p_kind must be episode or movie' USING ERRCODE = '22023';
  END IF;
  IF p_watched IS NULL THEN
    RAISE EXCEPTION 'p_watched must not be null' USING ERRCODE = '22023';
  END IF;
  IF p_when IS NULL OR p_when NOT IN ('now', 'release', 'unknown', 'at') THEN
    RAISE EXCEPTION 'p_when must be now, release, unknown or at' USING ERRCODE = '22023';
  END IF;
  IF (p_when = 'at') <> (p_at IS NOT NULL) THEN
    RAISE EXCEPTION 'p_at must be given exactly when p_when is at' USING ERRCODE = '22023';
  END IF;
  IF p_when = 'at' AND p_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'p_at must not be in the future' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'episode' THEN
    WITH u AS (
      UPDATE public.tv_show_episodes
      SET watched = p_watched
      WHERE id = ANY (p_ids) AND watched IS DISTINCT FROM p_watched
      RETURNING id
    )
    SELECT array_agg(id) INTO v_flipped FROM u;

    IF p_watched AND p_when <> 'now' AND v_flipped IS NOT NULL THEN
      UPDATE public.tv_show_episodes
      SET watched_at = CASE
        WHEN release_date > CURRENT_DATE THEN NULL
        WHEN p_when = 'unknown' THEN NULL
        WHEN p_when = 'at' THEN p_at
        WHEN p_when = 'release' THEN (
          CASE WHEN release_date IS NULL THEN NULL
               ELSE (release_date + time '12:00') AT TIME ZONE 'UTC' END
        )
      END
      WHERE id = ANY (v_flipped);
    END IF;
  ELSE
    WITH u AS (
      UPDATE public.movies
      SET watched = p_watched
      WHERE id = ANY (p_ids) AND watched IS DISTINCT FROM p_watched
      RETURNING id
    )
    SELECT array_agg(id) INTO v_flipped FROM u;

    IF p_watched AND p_when <> 'now' AND v_flipped IS NOT NULL THEN
      UPDATE public.movies
      SET watched_at = CASE
        WHEN release_date > CURRENT_DATE THEN NULL
        WHEN p_when = 'unknown' THEN NULL
        WHEN p_when = 'at' THEN p_at
        WHEN p_when = 'release' THEN (
          CASE WHEN release_date IS NULL THEN NULL
               ELSE (release_date + time '12:00') AT TIME ZONE 'UTC' END
        )
      END
      WHERE id = ANY (v_flipped);
    END IF;
  END IF;

  RETURN COALESCE(cardinality(v_flipped), 0);
END;
$$;

ALTER FUNCTION "public"."set_watched"(text, integer[], boolean, text, timestamptz) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_watched"(text, integer[], boolean, text, timestamptz) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."set_watched"(text, integer[], boolean, text, timestamptz) TO "authenticated", "service_role";

-- Bulk import of watch history and ratings (a Trakt/Letterboxd-style export
-- already matched to library ids by the client). Returns jsonb counts:
-- episodes_marked and movies_marked (rows flipped to watched), episodes_dated
-- and movies_dated (rows whose watched_at was set or moved earlier), dated
-- (their sum, kept for compatibility) and ratings_set.
--
-- A row whose release_date is still in the future gets null whatever the file
-- says: an import cannot know an unreleased title was watched.
--
-- An imported watched_at more than a day ahead of now() is treated as null
-- ("date unknown"): a future watch date is never real, and the day of slack
-- absorbs clock and timezone skew.
--
-- Every listed episode and movie ends up watched. Rows that flip are stamped
-- now() by those triggers, so the second statement then writes the imported
-- value over it -- including null, which means "watched, date unknown" and
-- must not be left as the import-time now(). Rows that were already watched
-- keep the earlier of their existing and imported dates; a null on either side
-- never erases a known date. The second statement lists watched_at alone, so
-- the trigger does not fire again.
--
-- Ratings are written to public.watchlist_ratings (public read, admin write, one row per
-- target) only where the target has none yet and the imported value is 0.5 to
-- 10 in half-point steps: an import never overwrites the owner's own score.
-- ratings_set counts the rows actually inserted. Ids that match no row are
-- ignored. A repeated id within one array is collapsed first (earliest date,
-- highest rating) so the outcome does not depend on row order. The function is
-- SECURITY INVOKER, so watchlist_ratings' admin-only write policy applies to the insert.
CREATE OR REPLACE FUNCTION "public"."import_watch_history"(
    p_episodes jsonb DEFAULT '[]',
    p_movies jsonb DEFAULT '[]',
    p_shows jsonb DEFAULT '[]',
    p_seasons jsonb DEFAULT '[]'
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
DECLARE
  v_flipped_eps integer[];
  v_flipped_movies integer[];
  v_dated_eps integer := 0;
  v_dated_movies integer := 0;
  v_ratings integer := 0;
  v_n integer;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  p_episodes := COALESCE(p_episodes, '[]'::jsonb);
  p_movies := COALESCE(p_movies, '[]'::jsonb);
  p_shows := COALESCE(p_shows, '[]'::jsonb);
  p_seasons := COALESCE(p_seasons, '[]'::jsonb);

  IF jsonb_typeof(p_episodes) <> 'array' OR jsonb_typeof(p_movies) <> 'array'
     OR jsonb_typeof(p_shows) <> 'array' OR jsonb_typeof(p_seasons) <> 'array' THEN
    RAISE EXCEPTION 'every argument must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_episodes) > 5000 OR jsonb_array_length(p_movies) > 5000
     OR jsonb_array_length(p_shows) > 5000 OR jsonb_array_length(p_seasons) > 5000 THEN
    RAISE EXCEPTION 'at most 5000 elements per array' USING ERRCODE = '22023';
  END IF;

  -- Episodes: flip, then date.
  WITH i AS (
    SELECT x.id, min(CASE WHEN x.watched_at > now() + interval '1 day' THEN NULL ELSE x.watched_at END) AS watched_at
    FROM jsonb_to_recordset(p_episodes) AS x(id integer, watched_at timestamptz)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), u AS (
    UPDATE public.tv_show_episodes e
    SET watched = true
    FROM i
    WHERE e.id = i.id AND e.watched IS DISTINCT FROM true
    RETURNING e.id
  )
  SELECT array_agg(id) INTO v_flipped_eps FROM u;

  WITH i AS (
    SELECT x.id, min(CASE WHEN x.watched_at > now() + interval '1 day' THEN NULL ELSE x.watched_at END) AS watched_at
    FROM jsonb_to_recordset(p_episodes) AS x(id integer, watched_at timestamptz)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), n AS (
    SELECT e.id,
           d.w AS imported,
           CASE
             WHEN e.id = ANY (COALESCE(v_flipped_eps, '{}'::integer[])) THEN d.w
             WHEN d.w IS NULL THEN e.watched_at
             WHEN e.watched_at IS NULL THEN d.w
             ELSE LEAST(e.watched_at, d.w)
           END AS new_at
    FROM public.tv_show_episodes e
    JOIN i ON i.id = e.id
    CROSS JOIN LATERAL (SELECT CASE WHEN e.release_date > CURRENT_DATE THEN NULL ELSE i.watched_at END AS w) d
    WHERE e.watched
  ), u AS (
    UPDATE public.tv_show_episodes e
    SET watched_at = n.new_at
    FROM n
    WHERE e.id = n.id AND e.watched_at IS DISTINCT FROM n.new_at
    RETURNING n.imported
  )
  SELECT count(*) FILTER (WHERE imported IS NOT NULL) INTO v_dated_eps FROM u;

  -- Movies: flip, then date.
  WITH i AS (
    SELECT x.id, min(CASE WHEN x.watched_at > now() + interval '1 day' THEN NULL ELSE x.watched_at END) AS watched_at
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), u AS (
    UPDATE public.movies m
    SET watched = true
    FROM i
    WHERE m.id = i.id AND m.watched IS DISTINCT FROM true
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_flipped_movies FROM u;

  WITH i AS (
    SELECT x.id, min(CASE WHEN x.watched_at > now() + interval '1 day' THEN NULL ELSE x.watched_at END) AS watched_at
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), n AS (
    SELECT m.id,
           d.w AS imported,
           CASE
             WHEN m.id = ANY (COALESCE(v_flipped_movies, '{}'::integer[])) THEN d.w
             WHEN d.w IS NULL THEN m.watched_at
             WHEN m.watched_at IS NULL THEN d.w
             ELSE LEAST(m.watched_at, d.w)
           END AS new_at
    FROM public.movies m
    JOIN i ON i.id = m.id
    CROSS JOIN LATERAL (SELECT CASE WHEN m.release_date > CURRENT_DATE THEN NULL ELSE i.watched_at END AS w) d
    WHERE m.watched
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
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating numeric)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (movie_id, rating, updated_at)
    SELECT t.id, i.rating, now()
    FROM i JOIN public.movies t ON t.id = i.id
    ON CONFLICT (movie_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_shows) AS x(id integer, rating numeric)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (tv_show_id, rating, updated_at)
    SELECT t.id, i.rating, now()
    FROM i JOIN public.tv_shows t ON t.id = i.id
    ON CONFLICT (tv_show_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_seasons) AS x(id integer, rating numeric)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 0.5 AND 10 AND mod(x.rating, 0.5) = 0
    GROUP BY x.id
  ), u AS (
    INSERT INTO public.watchlist_ratings (season_id, rating, updated_at)
    SELECT t.id, i.rating, now()
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

ALTER FUNCTION "public"."import_watch_history"(jsonb, jsonb, jsonb, jsonb) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."import_watch_history"(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."import_watch_history"(jsonb, jsonb, jsonb, jsonb) TO "authenticated", "service_role";

-- Renumbers one viewing order in a single statement. p_entry_ids must be
-- exactly that order's entry ids, each once, in the new order; anything else
-- (a missing id, an extra one, a duplicate, an id from another order, a
-- missing order) raises rather than half-applying. position is not unique, so
-- the renumbering cannot collide with itself mid-statement.
CREATE OR REPLACE FUNCTION "public"."reorder_viewing_order"(p_order_id integer, p_entry_ids integer[])
    RETURNS void
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.viewing_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such viewing order' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.viewing_order_entries WHERE order_id = p_order_id;

  IF p_entry_ids IS NULL
     OR cardinality(p_entry_ids) <> v_count
     OR (cardinality(p_entry_ids) > 0 AND array_ndims(p_entry_ids) <> 1)
     OR (SELECT count(DISTINCT x) FROM unnest(p_entry_ids) AS x) <> v_count
     OR EXISTS (
       SELECT 1 FROM public.viewing_order_entries
       WHERE order_id = p_order_id AND id <> ALL (p_entry_ids)
     ) THEN
    RAISE EXCEPTION 'p_entry_ids must be exactly the order''s entry ids, once each'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.viewing_order_entries
  SET position = array_position(p_entry_ids, id)
  WHERE order_id = p_order_id;
END;
$$;

ALTER FUNCTION "public"."reorder_viewing_order"(integer, integer[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."reorder_viewing_order"(integer, integer[]) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."reorder_viewing_order"(integer, integer[]) TO "authenticated", "service_role";

-- Revoked privileges
--
-- pg_dump emits GRANT and never REVOKE, so a privilege this database has
-- deliberately taken away is invisible to a generated diff and gets silently
-- restored. These eight tables are public-read and anon needs exactly SELECT on
-- them: RLS already gates INSERT/UPDATE/DELETE to authenticated + is_admin(),
-- but TRUNCATE is not subject to RLS at all, so under `GRANT ALL` the grant
-- layer was the only barrier between anon and an empty table. Not reachable
-- through PostgREST, which exposes no TRUNCATE verb -- least privilege rather
-- than an open door. Applied in 20260905160000 (tables) and
-- 20260912130000 (sequences). The second left `authenticated` with ALL (its
-- reasoning is there); 20261024150000 has since narrowed it on these tables to
-- SELECT, INSERT, UPDATE and DELETE. `service_role` keeps ALL, and so does
-- `authenticated` on the sequences.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  "public"."favourites",
  "public"."movies",
  "public"."tv_show_episodes",
  "public"."tv_show_seasons",
  "public"."tv_shows",
  "public"."weekly_schedule",
  "public"."viewing_orders",
  "public"."viewing_order_entries"
FROM "anon";

-- anon holds no INSERT on any of these tables, so it needs neither USAGE nor
-- the UPDATE that nextval()/setval() require on their id counters.
REVOKE ALL ON SEQUENCE
  "public"."favourites_id_seq",
  "public"."movies_id_seq",
  "public"."sync_log_id_seq",
  "public"."tv_show_episodes_id_seq",
  "public"."tv_show_seasons_id_seq",
  "public"."tv_shows_id_seq",
  "public"."weekly_schedule_id_seq"
FROM "anon";

-- sync_log is admin-only reads (its RLS was narrowed to is_admin() in
-- 20260904111858) and 20260905160000 revoked anon's grants without handing
-- SELECT back. No anon privilege on it at all.
REVOKE ALL ON TABLE "public"."sync_log" FROM "anon";

COMMENT ON COLUMN "public"."sync_log"."shard" IS
    '0-based index of the part of the library this run covered (rows with id % shard_count = shard). Null together with shard_count for a whole-library run: the manual Sync button, and every row written before the nightly sync was split.';

COMMENT ON COLUMN "public"."sync_log"."shard_count" IS
    'How many parts the library was split into for this run (1 to 10). Null together with shard for a whole-library run. Three nightly rows with shard 0, 1 and 2 and shard_count 3 make a complete day; a missing one is a part that never logged.';

COMMENT ON COLUMN "public"."tv_show_episodes"."watched_at" IS
    'When the episode was actually watched. Left null on every pre-migration row and never backfilled to now() -- a fabricated watch timestamp reads exactly like a real one. Every consumer must treat null as "watched, date unknown" and exclude it from anything time-bucketed (stalled-show detection, watch history, year in review).';

COMMENT ON COLUMN "public"."tv_show_episodes"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

COMMENT ON COLUMN "public"."tv_show_seasons"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

COMMENT ON COLUMN "public"."tv_shows"."pinned" IS
    'Marks the title the countdown widget shows. Nothing in the app writes this column yet -- it is set by hand -- and nothing enforces that at most one row is true, here or in the client. The only reader, usePinnedTitle (src/features/watchlist/useWatchlistNews.ts), takes one pinned row from tv_shows and one from movies and prefers the show, so with several rows pinned an arbitrary show wins over any movie.';

COMMENT ON COLUMN "public"."movies"."pinned" IS
    'Marks the title the countdown widget shows. Nothing in the app writes this column yet -- it is set by hand -- and nothing enforces that at most one row is true, here or in the client. The only reader, usePinnedTitle (src/features/watchlist/useWatchlistNews.ts), takes one pinned row from tv_shows and one from movies and prefers the show, so with several rows pinned an arbitrary show wins over any movie.';

COMMENT ON COLUMN "public"."tv_shows"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."movies"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."tv_show_seasons"."trailer_key" IS
    'A YouTube video key from TMDB''s season videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."tv_show_seasons"."trailer_checked_at" IS
    'When the sync last asked TMDB for this season''s videos. Null means never asked, so the sync will fetch it once (backfill).';

COMMENT ON COLUMN "public"."tv_shows"."backdrop" IS
    'Full TMDB backdrop image URL at w1280 (e.g. https://image.tmdb.org/t/p/w1280/abc.jpg), the landscape counterpart of poster. Written by watchlist-cron-sync (only while still null) and the client add flow. Null until one of them fills it; never backfilled in SQL, because the value only exists in TMDB.';

COMMENT ON COLUMN "public"."movies"."backdrop" IS
    'Full TMDB backdrop image URL at w1280 (e.g. https://image.tmdb.org/t/p/w1280/abc.jpg), the landscape counterpart of poster. Written by watchlist-cron-sync (only while still null) and the client add flow. Null until one of them fills it; never backfilled in SQL, because the value only exists in TMDB.';

COMMENT ON COLUMN "public"."movies"."directors" IS
    'Names of the film''s directors (TMDB credits crew where job = Director), in TMDB order. Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (credits is appended, no extra request). An empty array means TMDB lists no director; null means not fetched yet. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."movies"."top_cast" IS
    'Up to three lead actors, in TMDB billing order. Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (credits is appended, no extra request). Null means not fetched yet: the nightly shard runs fill a capped number per run, and a single-title Resync refreshes one. An empty array means TMDB lists no cast. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."tv_shows"."creators" IS
    'Names from TMDB''s created_by (a series has no single director). Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (no extra request). An empty array means TMDB lists no creator; null means not fetched yet. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."tv_shows"."top_cast" IS
    'Up to three actors with the most episodes across all seasons (TMDB aggregate_credits). Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (aggregate_credits is appended, no extra request). Null means not fetched yet: the nightly shard runs fill a capped number per run, and a single-title Resync refreshes one. An empty array means TMDB lists no cast. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."favourites"."original_language" IS
    'TMDB''s original_language (ISO 639-1, e.g. "ko", "ja", "hi", "en"), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."origin_country" IS
    'TMDB''s origin_country (ISO 3166-1 alpha-2, e.g. "{KR}", "{JP}"), for deriving the favourites grid''s category bucket (e.g. K-Drama, Anime) from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."genre_ids" IS
    'TMDB genre ids (e.g. 16 = Animation, 18 = Drama), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."movies"."imdb_id" IS
    'IMDb title id (tt plus 7 to 10 digits), taken from TMDB (movie imdb_id, or tv external_ids.imdb_id). It is the key OMDb is queried by. Null when TMDB has none or the sync has not fetched it.';

COMMENT ON COLUMN "public"."movies"."imdb_rating" IS
    'IMDb''s weighted user rating, 0 to 10, from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Not critics.';

COMMENT ON COLUMN "public"."movies"."imdb_votes" IS
    'How many IMDb users voted behind imdb_rating; a low count means a noisy rating. From OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known.';

COMMENT ON COLUMN "public"."movies"."rt_score" IS
    'Rotten Tomatoes Tomatometer, 0 to 100: the percentage of critics'' reviews that are positive (not an average grade). from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Often missing for TV and for older or foreign films.';

COMMENT ON COLUMN "public"."movies"."metascore" IS
    'Metacritic''s weighted critic score, 0 to 100, from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Often missing for TV and for older or foreign films.';

COMMENT ON COLUMN "public"."movies"."scores_checked_at" IS
    'When OMDb was last asked for this title; null = never. The nightly sync refreshes the oldest first within a daily request budget; a title OMDb has no scores for still gets a time so it is not asked every night. OMDb is an unofficial aggregator.';

COMMENT ON COLUMN "public"."tv_shows"."imdb_id" IS
    'IMDb title id (tt plus 7 to 10 digits), taken from TMDB (movie imdb_id, or tv external_ids.imdb_id). It is the key OMDb is queried by. Null when TMDB has none or the sync has not fetched it.';

COMMENT ON COLUMN "public"."tv_shows"."imdb_rating" IS
    'IMDb''s weighted user rating, 0 to 10, from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Not critics.';

COMMENT ON COLUMN "public"."tv_shows"."imdb_votes" IS
    'How many IMDb users voted behind imdb_rating; a low count means a noisy rating. From OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known.';

COMMENT ON COLUMN "public"."tv_shows"."rt_score" IS
    'Rotten Tomatoes Tomatometer, 0 to 100: the percentage of critics'' reviews that are positive (not an average grade). from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Often missing for TV and for older or foreign films.';

COMMENT ON COLUMN "public"."tv_shows"."metascore" IS
    'Metacritic''s weighted critic score, 0 to 100, from OMDb, an unofficial aggregator, and shown beside the owner''s own score in watchlist_ratings. Null = not known. Often missing for TV and for older or foreign films.';

COMMENT ON COLUMN "public"."tv_shows"."scores_checked_at" IS
    'When OMDb was last asked for this title; null = never. The nightly sync refreshes the oldest first within a daily request budget; a title OMDb has no scores for still gets a time so it is not asked every night. OMDb is an unofficial aggregator.';

COMMENT ON COLUMN "public"."tv_shows"."library_state" IS
    'active, paused, hidden or stopped. paused: a break -- the series leaves Your Week but keeps its shelf. stopped: the owner stopped watching it. hidden: hidden from visitors, owner-only. active is the truth for every pre-existing row. Films have no paused state (movies_library_state_check allows active, hidden, stopped).';

COMMENT ON COLUMN "public"."movies"."collection_id" IS
    'TMDB belongs_to_collection.id, e.g. a franchise. Null when the film is in no collection or the sync has not fetched it yet.';

-- TMDB titles the owner marked "Not interested" on Watchlist News discovery,
-- kept in the database so the dismissal follows the owner across devices.
-- An answer is made, changed (a skip upgraded to "Not interested", or a skip
-- given again) or undone.
CREATE TABLE IF NOT EXISTS "public"."watchlist_dismissed_suggestions" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "media" "text" NOT NULL,
    "tmdb_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text" DEFAULT 'not_interested' NOT NULL,
    "source" "text" DEFAULT 'unknown' NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_dismissed_suggestions_media_check" CHECK (("media" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "watchlist_dismissed_suggestions_tmdb_id_check" CHECK (("tmdb_id" > 0)),
    CONSTRAINT "watchlist_dismissed_suggestions_reason_check" CHECK (("reason" = ANY (ARRAY['not_interested'::"text", 'skip'::"text"]))),
    CONSTRAINT "watchlist_dismissed_suggestions_source_check" CHECK (("source" = ANY (ARRAY['coming_soon'::"text", 'you_might_like'::"text", 'likely_seen'::"text", 'franchise'::"text", 'unknown'::"text"]))),
    CONSTRAINT "watchlist_dismissed_suggestions_media_tmdb_id_key" UNIQUE ("media", "tmdb_id")
);

ALTER TABLE "public"."watchlist_dismissed_suggestions" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_dismissed_suggestions" IS
    'TMDB titles the owner marked "Not interested" on Watchlist News discovery. Identity is media + tmdb_id because TMDB film and show ids can collide. Public read so the public page hides the same suggestions; writes are admin only. reason: not_interested hides the title everywhere, skip (bulk "Skip these", formerly "None of these") hides it from suggestion lists for 90 days, a window the client applies. source: where the answer was given, unknown for rows from before it was recorded. answered_at: when the current answer was given; unlike created_at it moves when the answer changes.';

ALTER TABLE "public"."watchlist_dismissed_suggestions" ENABLE ROW LEVEL SECURITY;

-- Public read, like the rest of the watchlist: a TMDB id and a media type,
-- nothing private. Writes are admin only: insert, update (an upsert changing the
-- answer) and delete.
CREATE POLICY "Public Read Access" ON "public"."watchlist_dismissed_suggestions" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Admin insert" ON "public"."watchlist_dismissed_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."watchlist_dismissed_suggestions" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."watchlist_dismissed_suggestions" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- A fresh table starts from the image's default of ALL for anon and
-- authenticated, so the REVOKE is load-bearing: TRUNCATE is not filtered by
-- RLS and the grant is the only barrier. The identity column needs no
-- sequence grant.
REVOKE ALL ON TABLE "public"."watchlist_dismissed_suggestions" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_dismissed_suggestions" TO "anon";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."watchlist_dismissed_suggestions" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_dismissed_suggestions" TO "service_role";

-- An upsert can never weaken an answer. Two devices can upsert out of order, so
-- a stale device must not overwrite a newer or stronger answer. The client
-- already merges this way; the table agrees so the rule holds for any writer.
-- Rank: not_interested outranks skip. The row keeps its current answer when the
-- incoming reason ranks lower, or ranks equal and is older. Equal rank and
-- equal time takes the incoming row.
CREATE OR REPLACE FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
  old_rank integer := CASE OLD.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
  new_rank integer := CASE NEW.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
BEGIN
  IF new_rank < old_rank OR (new_rank = old_rank AND NEW.answered_at < OLD.answered_at) THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() OWNER TO "postgres";

-- Trigger-only: nothing calls it directly, so no role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "authenticated";

DROP TRIGGER IF EXISTS "tr_watchlist_dismissed_suggestions_keep_stronger" ON "public"."watchlist_dismissed_suggestions";

CREATE TRIGGER "tr_watchlist_dismissed_suggestions_keep_stronger" BEFORE UPDATE ON "public"."watchlist_dismissed_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"();

-- The owner's personal scores. Publicly readable since 2026-11-18 (the owner's
-- choice, reversing the earlier owner-only read); written only by the admin.
-- Kept in their own table rather than as columns on the watchlist tables so the
-- read and write rules can differ from them. One row per rated target;
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
    'The owner''s scores for films, shows, seasons and episodes; publicly readable since 2026-11-18 (the owner''s choice), written only by the admin; exactly one target per row.';

ALTER TABLE "public"."watchlist_ratings" ENABLE ROW LEVEL SECURITY;

-- Public read, deliberately: the owner chose to publish their scores. Writes
-- stay admin only through the three policies below.
CREATE POLICY "Public Read Access" ON "public"."watchlist_ratings" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Admin insert" ON "public"."watchlist_ratings" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."watchlist_ratings" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."watchlist_ratings" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- anon holds SELECT only: TRUNCATE is not filtered by RLS, so the grant is the
-- only barrier to anon writing or truncating. The identity column needs no
-- sequence grant.
REVOKE ALL ON TABLE "public"."watchlist_ratings" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_ratings" TO "anon";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."watchlist_ratings" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_ratings" TO "service_role";

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

COMMENT ON COLUMN "public"."movies"."last_activity_at" IS
    'Owner-activity timestamp: set when the film is added, and bumped when watched, watched_at or library_state changes (touch_last_activity_at()). Never moved by watchlist-cron-sync or the scores refresh, which is why it is not updated_at. NULL means no owner action since this column was added (existing rows are not backfilled).';

COMMENT ON COLUMN "public"."tv_shows"."last_activity_at" IS
    'Owner-activity timestamp: set when the show is added, and bumped when library_state changes (touch_last_activity_at()) or an episode is marked or unmarked watched (touch_show_last_activity_from_episode()). Never moved by watchlist-cron-sync, which inserts newly aired episodes and rewrites metadata, nor by the scores refresh. NULL means no owner action since this column was added (existing rows are not backfilled).';

-- Cached future dated instalments for TMDB film collections present in the
-- library, refreshed nightly by watchlist-cron-sync so Discover's Coming soon
-- catches newly announced sequels across every franchise (including older
-- watched films) without hammering TMDB from the browser. Public read matches
-- movies/viewing_orders; only service_role writes.
CREATE TABLE IF NOT EXISTS "public"."watchlist_collection_upcoming" (
    "collection_id" integer NOT NULL,
    "tmdb_id" integer NOT NULL,
    "collection_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "date" NOT NULL,
    "poster_path" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_collection_upcoming_pkey" PRIMARY KEY ("collection_id", "tmdb_id"),
    CONSTRAINT "watchlist_collection_upcoming_collection_id_pos" CHECK ("collection_id" > 0),
    CONSTRAINT "watchlist_collection_upcoming_tmdb_id_pos" CHECK ("tmdb_id" > 0),
    CONSTRAINT "watchlist_collection_upcoming_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 300)
);

ALTER TABLE "public"."watchlist_collection_upcoming" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_collection_upcoming" IS
    'Nightly-synced cache of dated future films belonging to TMDB collections in the library, used to prioritise franchise sequels in Discover Coming soon. Public read; service_role write only.';

CREATE INDEX IF NOT EXISTS "idx_watchlist_collection_upcoming_release_date"
    ON "public"."watchlist_collection_upcoming" USING "btree" ("release_date");

ALTER TABLE "public"."watchlist_collection_upcoming" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON "public"."watchlist_collection_upcoming"
    FOR SELECT TO "anon", "authenticated" USING (true);

REVOKE ALL ON TABLE "public"."watchlist_collection_upcoming" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_collection_upcoming" TO "anon", "authenticated";

GRANT ALL ON TABLE "public"."watchlist_collection_upcoming" TO "service_role";

-- Cached list of every part of each TMDB collection
-- with a visible library film, refreshed nightly by watchlist-cron-sync so
-- Discover's "Have you already watched?" walk reads one table instead of one
-- tmdb-proxy call per collection. TMDB catalogue data only; public read, and
-- only service_role writes.
CREATE TABLE IF NOT EXISTS "public"."watchlist_collection_parts" (
    "collection_id" integer NOT NULL,
    "tmdb_id" integer NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "date",
    "poster_path" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_collection_parts_pkey" PRIMARY KEY ("collection_id", "tmdb_id"),
    CONSTRAINT "watchlist_collection_parts_collection_id_pos" CHECK ("collection_id" > 0),
    CONSTRAINT "watchlist_collection_parts_tmdb_id_pos" CHECK ("tmdb_id" > 0),
    CONSTRAINT "watchlist_collection_parts_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 300)
);

ALTER TABLE "public"."watchlist_collection_parts" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_collection_parts" IS
    'Nightly-synced cache of every part of each TMDB film collection with a visible film in the library, read by Discover''s collection walk in place of one tmdb-proxy call per collection. Public read; service_role write only.';

ALTER TABLE "public"."watchlist_collection_parts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON "public"."watchlist_collection_parts"
    FOR SELECT TO "anon", "authenticated" USING (true);

REVOKE ALL ON TABLE "public"."watchlist_collection_parts" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_collection_parts" TO "anon", "authenticated";

GRANT ALL ON TABLE "public"."watchlist_collection_parts" TO "service_role";

-- Nightly cache of tmdb-proxy's two Wikidata lookups (wikidata/tv-spinoffs and
-- wikidata/film-universes), refreshed by watchlist-cron-sync so Discover and
-- Franchises read one row instead of calling the proxy. Wikidata/TMDB
-- catalogue data only; seed_ids are TMDB ids of visible TV shows, already
-- public. Public read, and only service_role writes.
CREATE TABLE IF NOT EXISTS "public"."watchlist_wikidata_cache" (
    "lookup" "text" NOT NULL,
    "seed_ids" integer[] DEFAULT '{}' NOT NULL,
    "results" "jsonb" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_wikidata_cache_pkey" PRIMARY KEY ("lookup"),
    CONSTRAINT "watchlist_wikidata_cache_lookup_check" CHECK ("lookup" IN ('tv-spinoffs', 'film-universes')),
    CONSTRAINT "watchlist_wikidata_cache_seed_ids_max" CHECK (cardinality("seed_ids") <= 1000),
    CONSTRAINT "watchlist_wikidata_cache_seed_ids_pos" CHECK (0 < ALL ("seed_ids")),
    CONSTRAINT "watchlist_wikidata_cache_film_universes_no_seeds" CHECK ("lookup" <> 'film-universes' OR cardinality("seed_ids") = 0),
    CONSTRAINT "watchlist_wikidata_cache_results_array" CHECK (jsonb_typeof("results") = 'array')
);

ALTER TABLE "public"."watchlist_wikidata_cache" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_wikidata_cache" IS
    'Nightly cache of tmdb-proxy''s Wikidata lookups (TV spin-off links for the visitor''s exact seed list, and shared film universe members), read by Discover and Franchises in place of the proxy call. Public read; service_role write only.';

ALTER TABLE "public"."watchlist_wikidata_cache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON "public"."watchlist_wikidata_cache"
    FOR SELECT TO "anon", "authenticated" USING (true);

REVOKE ALL ON TABLE "public"."watchlist_wikidata_cache" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_wikidata_cache" TO "anon", "authenticated";

GRANT ALL ON TABLE "public"."watchlist_wikidata_cache" TO "service_role";
