-- Watchlist home: an "Up Next" view, and the two columns it needs.
--
-- Neither column needs a TMDB call -- both just change what is derivable.
--
-- watched_at records *when* an episode was watched, which the existing
-- `watched` boolean destroys. It gates stalled-show detection, watch
-- history and year-in-review, and it is left NULL on every existing row: a
-- fabricated timestamp reads exactly like a real one, so backfilling to
-- now() would state that every episode ever watched was watched today.
-- Every consumer must treat NULL as "watched, date unknown."
--
-- created_at lets a "recently added" feed exist at all, and carries exactly
-- the same trap as watched_at: a backfill would set every existing
-- season/episode row to this migration's timestamp, and a feed reading
-- "created_at > now() - interval '7 days'" would report the entire
-- pre-existing library as announced today. So it takes the same answer --
-- left NULL on every pre-migration row, never fabricated.
--
-- REHAUL_PLAN.md 8.B originally chose the other branch: stamp the backfill
-- and require every consumer to gate on a fixed floor of this migration's
-- own timestamp. NULL reaches the same place without asking anyone to
-- remember a constant. A rolling window is then correct by construction,
-- because NULL > anything is UNKNOWN and the row drops out on its own,
-- where the floor was correct only for as long as every future consumer
-- recalled it. Both leave the feed empty for a week; only one of them stays
-- right afterwards.
--
-- watchlist_up_next derives, once, in the one place both the Vite bundle
-- and the watchlist-cron-sync Deno function can share logic: SQL against
-- the same database. security_invoker = true is load-bearing -- without it
-- the view runs as its owner and reads straight past the RLS on the three
-- underlying tables.

BEGIN;

ALTER TABLE "public"."tv_show_episodes"
    ADD COLUMN IF NOT EXISTS "watched_at" timestamp with time zone;

-- Two steps, deliberately. `ADD COLUMN ... DEFAULT now()` backfills every
-- existing row even when the column is nullable, which is the exact
-- fabrication this is avoiding. Adding the column bare and then setting the
-- default leaves pre-existing rows NULL and stamps only rows inserted later.
ALTER TABLE "public"."tv_show_seasons"
    ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE "public"."tv_show_seasons"
    ALTER COLUMN "created_at" SET DEFAULT "now"();

ALTER TABLE "public"."tv_show_episodes"
    ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone;
ALTER TABLE "public"."tv_show_episodes"
    ALTER COLUMN "created_at" SET DEFAULT "now"();

COMMENT ON COLUMN "public"."tv_show_episodes"."watched_at" IS
    'When the episode was actually watched. Left null on every pre-migration row and never backfilled to now() -- a fabricated watch timestamp reads exactly like a real one. Every consumer must treat null as "watched, date unknown" and exclude it from anything time-bucketed (stalled-show detection, watch history, year in review).';

COMMENT ON COLUMN "public"."tv_show_episodes"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

COMMENT ON COLUMN "public"."tv_show_seasons"."created_at" IS
    'When this row was inserted, for the season/episode announcements feed. Left null on every pre-migration row and never backfilled -- a fabricated announcement date reads exactly like a real one, and stamping the backfill would make the whole pre-existing library look announced at once. Null means "inserted before this was recorded", so a rolling window (created_at > now() - interval ''7 days'') excludes those rows on its own and is the correct way to read this column.';

-- Partial: the view below (and every "what's next" query) only ever reads
-- unwatched rows, so there is no reason to index the rest.
CREATE INDEX IF NOT EXISTS "tv_show_episodes_up_next_idx"
    ON "public"."tv_show_episodes" USING "btree" ("season_id", "episode_number")
    WHERE ("watched" = false);

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
       )               AS has_started
FROM   "public"."tv_show_episodes" e
JOIN   "public"."tv_show_seasons"  s  ON s.id = e.season_id
JOIN   "public"."tv_shows"         sh ON sh.id = s.tv_show_id
WHERE  e.watched = false
ORDER  BY s.tv_show_id, s.season_number, e.episode_number;

-- The three underlying tables already carry "Public Read Access" policies
-- (FOR SELECT USING (true)), so this view is a deliberate public surface,
-- not an admin one -- no is_admin() gate belongs here.
GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "anon";

GRANT SELECT ON TABLE "public"."watchlist_up_next" TO "authenticated";

COMMIT;
