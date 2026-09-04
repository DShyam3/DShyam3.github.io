CREATE TABLE IF NOT EXISTS "public"."favourites" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "poster" "text",
    "media_type" "text" DEFAULT 'movie'::"text" NOT NULL,
    "tmdb_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'Hollywood'::"text",
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
    "runtime" integer
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
    "title" "text"
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
    "release_date" "date"
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
    "tmdb_id" integer
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

CREATE TABLE IF NOT EXISTS "public"."weekly_schedule" (
    "id" integer NOT NULL,
    "tv_show_id" integer,
    "day_of_week" "text" NOT NULL,
    "movie_id" bigint,
    CONSTRAINT "weekly_schedule_day_of_week_check" CHECK (("day_of_week" = ANY (ARRAY['Sunday'::"text", 'Monday'::"text", 'Tuesday'::"text", 'Wednesday'::"text", 'Thursday'::"text", 'Friday'::"text", 'Saturday'::"text"])))
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

ALTER TABLE "public"."favourites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_show_episodes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_show_seasons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tv_shows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."weekly_schedule" ENABLE ROW LEVEL SECURITY;

-- Triggers live here rather than with the functions in 01_functions.sql:
-- schema files run in filename order, so the tables must exist first.

CREATE OR REPLACE TRIGGER "tr_update_episodes_watched" AFTER UPDATE OF "watched" ON "public"."tv_show_seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_episodes_watched_status"();

CREATE OR REPLACE TRIGGER "tr_update_season_watched" AFTER INSERT OR DELETE OR UPDATE OF "watched" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_watched_status"();

-- Grants

GRANT ALL ON TABLE "public"."favourites" TO "anon";

GRANT ALL ON TABLE "public"."favourites" TO "authenticated";

GRANT ALL ON TABLE "public"."favourites" TO "service_role";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."movies" TO "anon";

GRANT ALL ON TABLE "public"."movies" TO "authenticated";

GRANT ALL ON TABLE "public"."movies" TO "service_role";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "service_role";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sync_log" TO "anon";

GRANT ALL ON TABLE "public"."sync_log" TO "authenticated";

GRANT ALL ON TABLE "public"."sync_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "anon";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_episodes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "anon";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_show_seasons" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."tv_shows" TO "anon";

GRANT ALL ON TABLE "public"."tv_shows" TO "authenticated";

GRANT ALL ON TABLE "public"."tv_shows" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "anon";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "authenticated";

GRANT ALL ON TABLE "public"."weekly_schedule" TO "service_role";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "service_role";

-- Revoked privileges (see the note in 40_finance.sql)
REVOKE DELETE, INSERT ON TABLE "public"."sync_log" FROM "anon";
