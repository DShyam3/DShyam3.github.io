-- Watchlist tracking: a watched state for films, the owner's own 1-10 ratings
-- beside TMDB's community vote average, pause/drop for shows, hand-built
-- viewing orders, and three admin RPCs. Mirrors supabase/schemas/20_watchlist.sql
-- (and the comment on set_watched_at() in schemas/01_functions.sql).
--
-- ## Columns
--
-- movies: watched (NOT NULL DEFAULT false -- false is the truth for every
-- existing row, so the default fabricates nothing), watched_at (no default,
-- never backfilled), rating, tmdb_vote_average, tmdb_vote_count, collection_id,
-- collection_name. tv_shows: rating, tmdb_vote_average, tmdb_vote_count,
-- tracking (NOT NULL DEFAULT 'active', which is true of every existing row).
-- tv_show_seasons: rating, tmdb_vote_average (TMDB gives seasons no count).
-- All new CHECKs are on nullable columns, so existing rows satisfy them.
--
-- ## Trigger
--
-- tr_set_watched_at is added to movies. set_watched_at() is generic over
-- NEW.watched / NEW.watched_at and is NOT redefined here; only its leading
-- comment in schemas/01_functions.sql changed.
--
-- ## View
--
-- watchlist_up_next: same column list, plus tracking = 'active' in the WHERE.
-- CREATE OR REPLACE keeps the existing grants.
--
-- ## RLS and Grants
--
-- The new columns inherit the table-level grants and the existing admin-write
-- policies. The two new tables get RLS, public read, is_admin() writes and the
-- same grants as tv_shows, with anon's default ALL revoked before its SELECT.
-- The three functions are SECURITY INVOKER.
--
-- ## Cascade fix
--
-- update_episodes_watched_status() is redefined (same signature, owner and
-- search_path) with a trigger-depth guard. Before it, unmarking one episode of
-- a fully watched season flipped season.watched to false, which cascaded
-- watched = false onto every sibling and cleared all their watched_at.

BEGIN;

-- ## movies

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "watched" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "watched_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "rating" smallint
        CONSTRAINT "movies_rating_check" CHECK ("rating" BETWEEN 1 AND 10),
    ADD COLUMN IF NOT EXISTS "tmdb_vote_average" numeric(3,1)
        CONSTRAINT "movies_tmdb_vote_average_check" CHECK ("tmdb_vote_average" BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS "tmdb_vote_count" integer
        CONSTRAINT "movies_tmdb_vote_count_check" CHECK ("tmdb_vote_count" >= 0),
    ADD COLUMN IF NOT EXISTS "collection_id" integer,
    ADD COLUMN IF NOT EXISTS "collection_name" text;

CREATE INDEX IF NOT EXISTS "movies_collection_id_idx" ON "public"."movies" USING "btree" ("collection_id") WHERE ("collection_id" IS NOT NULL);

DROP TRIGGER IF EXISTS "tr_set_watched_at" ON "public"."movies";

CREATE TRIGGER "tr_set_watched_at" BEFORE INSERT OR UPDATE OF "watched" ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."set_watched_at"();

-- ## tv_shows

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "rating" smallint
        CONSTRAINT "tv_shows_rating_check" CHECK ("rating" BETWEEN 1 AND 10),
    ADD COLUMN IF NOT EXISTS "tmdb_vote_average" numeric(3,1)
        CONSTRAINT "tv_shows_tmdb_vote_average_check" CHECK ("tmdb_vote_average" BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS "tmdb_vote_count" integer
        CONSTRAINT "tv_shows_tmdb_vote_count_check" CHECK ("tmdb_vote_count" >= 0),
    ADD COLUMN IF NOT EXISTS "tracking" text DEFAULT 'active' NOT NULL
        CONSTRAINT "tv_shows_tracking_check" CHECK ("tracking" IN ('active', 'paused', 'dropped'));

-- ## tv_show_seasons

ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN IF NOT EXISTS "rating" smallint
        CONSTRAINT "tv_show_seasons_rating_check" CHECK ("rating" BETWEEN 1 AND 10),
    ADD COLUMN IF NOT EXISTS "tmdb_vote_average" numeric(3,1)
        CONSTRAINT "tv_show_seasons_tmdb_vote_average_check" CHECK ("tmdb_vote_average" BETWEEN 0 AND 10);

-- ## Comments

COMMENT ON COLUMN "public"."movies"."watched_at" IS
    'When the film was actually watched. Left null on every pre-migration row and never backfilled to now() -- a fabricated watch timestamp reads exactly like a real one. Null with watched = true means "watched, date unknown"; every consumer must exclude null from anything time-bucketed (watch history, year in review).';

COMMENT ON COLUMN "public"."movies"."rating" IS
    'The owner''s own score, 1 to 10. Null means not rated. Not TMDB''s score -- see tmdb_vote_average.';

COMMENT ON COLUMN "public"."tv_shows"."rating" IS
    'The owner''s own score, 1 to 10. Null means not rated. Not TMDB''s score -- see tmdb_vote_average.';

COMMENT ON COLUMN "public"."tv_show_seasons"."rating" IS
    'The owner''s own score, 1 to 10. Null means not rated. Not TMDB''s score -- see tmdb_vote_average.';

COMMENT ON COLUMN "public"."movies"."tmdb_vote_average" IS
    'TMDB''s community user-vote average, 0 to 10 (not critics). Stored to show beside the owner''s rating. Null until the sync has fetched it.';

COMMENT ON COLUMN "public"."tv_shows"."tmdb_vote_average" IS
    'TMDB''s community user-vote average, 0 to 10 (not critics). Stored to show beside the owner''s rating. Null until the sync has fetched it.';

COMMENT ON COLUMN "public"."tv_show_seasons"."tmdb_vote_average" IS
    'TMDB''s community user-vote average for the season, 0 to 10 (not critics). TMDB gives seasons an average but no vote count. Null until the sync has fetched it.';

COMMENT ON COLUMN "public"."movies"."tmdb_vote_count" IS
    'How many TMDB users voted behind tmdb_vote_average; a low count means a noisy average. Null until the sync has fetched it.';

COMMENT ON COLUMN "public"."tv_shows"."tmdb_vote_count" IS
    'How many TMDB users voted behind tmdb_vote_average; a low count means a noisy average. Null until the sync has fetched it.';

COMMENT ON COLUMN "public"."tv_shows"."tracking" IS
    'active, paused or dropped. Only active shows appear in Watch Next (watchlist_up_next); paused and dropped ones stay in the library. active is the truth for every pre-existing row.';

COMMENT ON COLUMN "public"."movies"."collection_id" IS
    'TMDB belongs_to_collection.id, e.g. a franchise. Null when the film is in no collection or the sync has not fetched it yet.';

-- ## watchlist_up_next: paused and dropped shows leave Watch Next.

-- Same column list as before; the only change is `AND sh.tracking = 'active'`
-- in the WHERE, so a paused or dropped show leaves Watch Next.
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
       EXISTS (
         SELECT 1
         FROM   "public"."tv_show_episodes" we
         JOIN   "public"."tv_show_seasons"  ws ON ws.id = we.season_id
         WHERE  ws.tv_show_id = s.tv_show_id
           AND  we.watched = true
       )               AS has_started,
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
  AND  sh.tracking = 'active'
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

-- ## viewing_orders, viewing_order_entries

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
CREATE POLICY "Public Read Access" ON "public"."viewing_orders" FOR SELECT USING (true);

CREATE POLICY "Admin insert" ON "public"."viewing_orders" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."viewing_orders" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."viewing_orders" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Public Read Access" ON "public"."viewing_order_entries" FOR SELECT USING (true);

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

-- ## Functions

-- Cascade a season's watched flag onto its episodes only when the season row
-- was updated directly. When the update came from update_season_watched_status()
-- (an episode changed, so the season is merely recomputed) the trigger depth is
-- 2 or more and copying the flag back down would unwatch the sibling episodes
-- and wipe their watched_at. CREATE OR REPLACE keeps the existing grants.
CREATE OR REPLACE FUNCTION "public"."update_episodes_watched_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Depth 1 is this trigger fired by a direct UPDATE of tv_show_seasons.
  -- Deeper means the UPDATE came from an episode trigger: do not cascade back.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only run if the 'watched' status actually changed
  IF (OLD.watched IS DISTINCT FROM NEW.watched) THEN
    UPDATE tv_show_episodes
    SET watched = NEW.watched
    WHERE season_id = NEW.id
    AND watched IS DISTINCT FROM NEW.watched; -- Only update rows that actually need to change
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_episodes_watched_status"() OWNER TO "postgres";

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
-- Why two statements: tr_set_watched_at stamps now() whenever `watched` flips,
-- and an UPDATE that sets watched cannot also pick a different date, because
-- the trigger runs after the SET list and overwrites it. So step 1 flips
-- `watched` (the trigger stamps now(), or clears on unwatch) and step 2
-- rewrites only watched_at. Step 2 lists watched_at alone, so the BEFORE UPDATE
-- OF watched trigger does not fire for it. Step 2 touches only the rows step 1
-- flipped: rows that were already watched keep the date they had.
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
      SET watched_at = CASE p_when
        WHEN 'unknown' THEN NULL
        WHEN 'at' THEN p_at
        WHEN 'release' THEN (
          CASE WHEN release_date IS NULL OR release_date > CURRENT_DATE THEN NULL
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
      SET watched_at = CASE p_when
        WHEN 'unknown' THEN NULL
        WHEN 'at' THEN p_at
        WHEN 'release' THEN (
          CASE WHEN release_date IS NULL OR release_date > CURRENT_DATE THEN NULL
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
-- An imported watched_at more than a day ahead of now() is treated as null
-- ("date unknown"): a future watch date is never real, and the day of slack
-- absorbs clock and timezone skew.
--
-- Every listed episode and movie ends up watched. Rows that flip are stamped
-- now() by tr_set_watched_at, so the second statement then writes the imported
-- value over it -- including null, which means "watched, date unknown" and
-- must not be left as the import-time now(). Rows that were already watched
-- keep the earlier of their existing and imported dates; a null on either side
-- never erases a known date. The second statement lists watched_at alone, so
-- the trigger does not fire again.
--
-- Ratings are set only where the row has none yet and the imported value is
-- 1 to 10: an import never overwrites the owner's own score. Ids that match no
-- row are ignored. A repeated id within one array is collapsed first (earliest
-- date, highest rating) so the outcome does not depend on row order.
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
           i.watched_at AS imported,
           CASE
             WHEN e.id = ANY (COALESCE(v_flipped_eps, '{}'::integer[])) THEN i.watched_at
             WHEN i.watched_at IS NULL THEN e.watched_at
             WHEN e.watched_at IS NULL THEN i.watched_at
             ELSE LEAST(e.watched_at, i.watched_at)
           END AS new_at
    FROM public.tv_show_episodes e
    JOIN i ON i.id = e.id
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
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating integer)
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
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating integer)
    WHERE x.id IS NOT NULL
    GROUP BY x.id
  ), n AS (
    SELECT m.id,
           i.watched_at AS imported,
           CASE
             WHEN m.id = ANY (COALESCE(v_flipped_movies, '{}'::integer[])) THEN i.watched_at
             WHEN i.watched_at IS NULL THEN m.watched_at
             WHEN m.watched_at IS NULL THEN i.watched_at
             ELSE LEAST(m.watched_at, i.watched_at)
           END AS new_at
    FROM public.movies m
    JOIN i ON i.id = m.id
    WHERE m.watched
  ), u AS (
    UPDATE public.movies m
    SET watched_at = n.new_at
    FROM n
    WHERE m.id = n.id AND m.watched_at IS DISTINCT FROM n.new_at
    RETURNING n.imported
  )
  SELECT count(*) FILTER (WHERE imported IS NOT NULL) INTO v_dated_movies FROM u;

  -- Ratings: only where none is set yet, only 1 to 10.
  WITH i AS (
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_movies) AS x(id integer, watched_at timestamptz, rating integer)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 1 AND 10
    GROUP BY x.id
  ), u AS (
    UPDATE public.movies m SET rating = i.rating
    FROM i WHERE m.id = i.id AND m.rating IS NULL
    RETURNING m.id
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_shows) AS x(id integer, rating integer)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 1 AND 10
    GROUP BY x.id
  ), u AS (
    UPDATE public.tv_shows s SET rating = i.rating
    FROM i WHERE s.id = i.id AND s.rating IS NULL
    RETURNING s.id
  )
  SELECT count(*) INTO v_n FROM u;
  v_ratings := v_ratings + v_n;

  WITH i AS (
    SELECT x.id, max(x.rating) AS rating
    FROM jsonb_to_recordset(p_seasons) AS x(id integer, rating integer)
    WHERE x.id IS NOT NULL AND x.rating BETWEEN 1 AND 10
    GROUP BY x.id
  ), u AS (
    UPDATE public.tv_show_seasons s SET rating = i.rating
    FROM i WHERE s.id = i.id AND s.rating IS NULL
    RETURNING s.id
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

COMMIT;
