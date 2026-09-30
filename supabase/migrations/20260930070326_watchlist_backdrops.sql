-- Landscape backdrops for the watchlist.
--
-- `poster` holds a full TMDB image URL; `backdrop` is the same idea in
-- landscape, at TMDB's w1280 size, for wide surfaces. Written by
-- watchlist-cron-sync (nightly; it only fills a backdrop that is still null)
-- and by the client's add flow (useTMDB.getBackdropUrl via
-- WatchlistContext.tsx), and read by useWatchlistNews.ts.
--
-- text, nullable, no default, no CHECK -- exactly like `poster`, which has
-- neither. Not backfilled in SQL: the value only exists in TMDB, and the
-- nightly sync fills existing rows over time.
--
-- Grants: none to add. movies and tv_shows carry table-level grants only --
-- SELECT to anon (20260905160000, re-asserted in 20260912130000), ALL to
-- authenticated and service_role -- and no column-level grants anywhere, so the
-- new column inherits them, `poster` included. RLS is unchanged too: public
-- read, and INSERT/UPDATE/DELETE gated on is_admin().
--
-- The watchlist_up_next view is deliberately untouched; it selects explicit
-- columns, so the new one does not reach it.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS, and COMMENT replaces in place.

BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "backdrop" "text";

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "backdrop" "text";

COMMENT ON COLUMN "public"."movies"."backdrop" IS
    'Full TMDB backdrop image URL at w1280 (e.g. https://image.tmdb.org/t/p/w1280/abc.jpg), the landscape counterpart of poster. Written by watchlist-cron-sync (only while still null) and the client add flow. Null until one of them fills it; never backfilled in SQL, because the value only exists in TMDB.';

COMMENT ON COLUMN "public"."tv_shows"."backdrop" IS
    'Full TMDB backdrop image URL at w1280 (e.g. https://image.tmdb.org/t/p/w1280/abc.jpg), the landscape counterpart of poster. Written by watchlist-cron-sync (only while still null) and the client add flow. Null until one of them fills it; never backfilled in SQL, because the value only exists in TMDB.';

COMMIT;
