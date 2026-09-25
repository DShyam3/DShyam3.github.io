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
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer,
    "runtime" integer,
    "pinned" boolean DEFAULT false NOT NULL,
    "trailer_key" "text"
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
    "duration_ms" integer DEFAULT 0
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
    "created_at" timestamp with time zone DEFAULT "now"()
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
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer,
    "pinned" boolean DEFAULT false NOT NULL,
    "trailer_key" "text"
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

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "seasons_unique_match" UNIQUE ("tv_show_id", "season_number");

ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "unique_episode_per_season" UNIQUE ("season_id", "episode_number");

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_tv_show_id_day_of_week_key" UNIQUE ("tv_show_id", "day_of_week");

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

CREATE POLICY "Admin delete" ON "public"."movies" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."tv_show_episodes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."tv_show_seasons" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."tv_shows" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."weekly_schedule" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete favourites" ON "public"."favourites" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete sync_log" ON "public"."sync_log" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."movies" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."tv_show_episodes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."tv_show_seasons" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."tv_shows" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."weekly_schedule" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert favourites" ON "public"."favourites" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert sync_log" ON "public"."sync_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

-- The trigger that writes this table (log_watchlist_event(), 01_functions.sql)
-- is not SECURITY DEFINER, so it inserts as whoever ran the UPDATE on
-- tv_shows/movies. The browser sync (WatchlistContext.tsx) runs as a signed-in
-- admin, so without this policy the admin's own sync would fail RLS on its
-- own trigger-driven insert. watchlist-cron-sync's nightly UPSERT uses the
-- service role and bypasses RLS entirely, so it needs no policy here.
CREATE POLICY "Admin insert" ON "public"."watchlist_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin read sync_log" ON "public"."sync_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."movies" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."tv_show_episodes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."tv_show_seasons" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."tv_shows" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."weekly_schedule" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update favourites" ON "public"."favourites" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Anyone can read favourites" ON "public"."favourites" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."movies" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_show_episodes" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_show_seasons" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."tv_shows" FOR SELECT USING (true);

CREATE POLICY "Public Read Access" ON "public"."weekly_schedule" FOR SELECT USING (true);

-- Public read, same as every sibling table above: this table holds show
-- names and platform names, nothing private. No UPDATE or DELETE policy
-- anywhere in this file for this table -- events are append-only, and
-- nothing should ever be able to rewrite history.
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
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

-- Grants

GRANT SELECT ON TABLE "public"."favourites" TO "anon";

GRANT ALL ON TABLE "public"."favourites" TO "authenticated";

GRANT ALL ON TABLE "public"."favourites" TO "service_role";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."movies" TO "anon";

GRANT ALL ON TABLE "public"."movies" TO "authenticated";

GRANT ALL ON TABLE "public"."movies" TO "service_role";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."sync_log" TO "authenticated";

GRANT ALL ON TABLE "public"."sync_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_show_episodes" TO "anon";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_show_seasons" TO "anon";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."tv_shows" TO "anon";

GRANT ALL ON TABLE "public"."tv_shows" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_shows" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "service_role";

GRANT SELECT ON TABLE "public"."weekly_schedule" TO "anon";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "authenticated";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "service_role";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "service_role";

-- watchlist_up_next is a read composition of three already-public-read
-- tables (see the "Public Read Access" policies above), so it is a public
-- surface deliberately, not an oversight -- it carries no is_admin() gate.
GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "anon";

GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "authenticated";

-- watchlist_events grants: narrower than every other table in this file, on
-- purpose. Default privileges on this project still hand ALL on a newly
-- created public table to anon, authenticated and service_role (the note at
-- "ALTER DEFAULT PRIVILEGES" below explains why), so the REVOKE lines here
-- are not idle defence -- without them this table would start out exactly as
-- over-granted as every sibling table was before 20260905160000 and
-- 20260912130000 narrowed them.
--
-- anon: SELECT only, same reasoning as every table above -- show names and
-- platform names, nothing private.
--
-- authenticated: SELECT + INSERT, not ALL. log_watchlist_event() is not
-- SECURITY DEFINER (deliberately -- see 01_functions.sql), so the browser
-- sync's trigger-driven INSERT runs as the authenticated admin who fired the
-- UPDATE, and needs the underlying table privilege to succeed -- the "Admin
-- insert" RLS policy above is a second, independent gate on top of this
-- grant, not a substitute for it. No UPDATE, DELETE or TRUNCATE grant:
-- this table is append-only, and revoking those at the grant layer (not just
-- relying on "no policy exists for them") means a future RLS mistake here
-- still cannot rewrite history. TRUNCATE in particular is never subject to
-- RLS at all, which is exactly the gap 20260912130000 closed for anon on the
-- other six tables -- here it is closed for authenticated too, because
-- nothing legitimate needs it.
--
-- service_role: ALL, matching every table above -- watchlist-cron-sync
-- authenticates with SUPABASE_SERVICE_ROLE_KEY and bypasses RLS, but its
-- trigger-driven INSERT still needs the underlying grant to succeed.
REVOKE ALL ON TABLE "public"."watchlist_events" FROM "anon";

REVOKE ALL ON TABLE "public"."watchlist_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "anon";

GRANT SELECT, INSERT ON TABLE "public"."watchlist_events" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_events" TO "service_role";

-- Revoked privileges (see the note in 40_finance.sql)
--
-- pg_dump emits GRANT and never REVOKE, so a privilege this database has
-- deliberately taken away is invisible to a generated diff and gets silently
-- restored. These six tables are public-read and anon needs exactly SELECT on
-- them: RLS already gates INSERT/UPDATE/DELETE to authenticated + is_admin(),
-- but TRUNCATE is not subject to RLS at all, so under `GRANT ALL` the grant
-- layer was the only barrier between anon and an empty table. Not reachable
-- through PostgREST, which exposes no TRUNCATE verb -- least privilege rather
-- than an open door. Applied in 20260905160000 (tables) and
-- 20260912130000 (sequences); `authenticated` and `service_role` keep ALL,
-- and the reasoning for leaving them is in that second migration.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  "public"."favourites",
  "public"."movies",
  "public"."tv_show_episodes",
  "public"."tv_show_seasons",
  "public"."tv_shows",
  "public"."weekly_schedule"
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

COMMENT ON COLUMN "public"."tv_show_episodes"."watched_at" IS
    'When the episode was actually watched. Left null on every pre-migration row and never backfilled to now() -- a fabricated watch timestamp reads exactly like a real one. Every consumer must treat null as "watched, date unknown" and exclude it from anything time-bucketed (stalled-show detection, watch history, year in review).';

COMMENT ON COLUMN "public"."tv_show_episodes"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

COMMENT ON COLUMN "public"."tv_show_seasons"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

COMMENT ON COLUMN "public"."tv_shows"."pinned" IS
    'Marks the single title the countdown widget shows next. At most one row should be true at a time, but that is enforced in WatchlistContext.tsx, not here -- a partial unique index would only relocate an invariant the UI already guarantees by construction (one toggle, one write).';

COMMENT ON COLUMN "public"."movies"."pinned" IS
    'Marks the single title the countdown widget shows next. At most one row should be true at a time, but that is enforced in WatchlistContext.tsx, not here -- a partial unique index would only relocate an invariant the UI already guarantees by construction (one toggle, one write).';

COMMENT ON COLUMN "public"."tv_shows"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."movies"."trailer_key" IS
    'A YouTube video key from TMDB''s videos append (e.g. "dQw4w9WgXcQ"), not a URL -- the player builds the embed URL client-side.';

COMMENT ON COLUMN "public"."favourites"."original_language" IS
    'TMDB''s original_language (ISO 639-1, e.g. "ko", "ja", "hi", "en"), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."origin_country" IS
    'TMDB''s origin_country (ISO 3166-1 alpha-2, e.g. "{KR}", "{JP}"), for deriving the favourites grid''s category bucket (e.g. K-Drama, Anime) from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';

COMMENT ON COLUMN "public"."favourites"."genre_ids" IS
    'TMDB genre ids (e.g. 16 = Animation, 18 = Drama), for deriving the favourites grid''s category bucket from TMDB data instead of the frozen category string. Left null on every pre-migration row and never backfilled in SQL -- the value only exists in TMDB and is fetched by an admin-triggered client action; a fabricated value here reads exactly like a real one. Falls back to category when null.';
