-- TMDB credits on the watchlist: adds directors and top_cast to public.movies,
-- and creators and top_cast to public.tv_shows, so the detail view can show who
-- made and who stars in a title.
--
-- ## Columns
--
-- All four are text[], nullable, no default, no CHECK, no index (nothing
-- filters or sorts by them; they are only read back with the row).
--   - movies.directors: TMDB credits crew where job = 'Director', TMDB order.
--   - movies.top_cast: up to three leads, TMDB billing order.
--   - tv_shows.creators: TMDB created_by (a series has no single director).
--   - tv_shows.top_cast: up to three actors with the most episodes across all
--     seasons (aggregate_credits).
--
-- Written by watchlist-cron-sync and the client add flow from the same TMDB
-- detail call, with credits appended, so there is no extra request. Existing
-- rows stay NULL until the nightly shard runs fill them, a capped number per
-- run (MAX_CREDITS_BACKFILL_PER_RUN); a single-title Resync refreshes one. An
-- empty top_cast is [], so a title with no cast is not asked again.
--
-- ## RLS and Grants
--
-- No RLS or grant changes are needed.
-- Table-level grants (SELECT to anon, SELECT/INSERT/UPDATE/DELETE to authenticated,
-- and ALL to service_role) already apply to all columns on movies and tv_shows;
-- neither table has column-level grants. Existing "Admin insert", "Admin update"
-- and "Admin delete" policies verify `(SELECT public.is_admin())`, and
-- "Public Read Access" allows SELECT.

BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "directors" text[],
    ADD COLUMN IF NOT EXISTS "top_cast" text[];

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "creators" text[],
    ADD COLUMN IF NOT EXISTS "top_cast" text[];

COMMENT ON COLUMN "public"."movies"."directors" IS
    'Names of the film''s directors (TMDB credits crew where job = Director), in TMDB order. Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (credits is appended, no extra request). An empty array means TMDB lists no director; null means not fetched yet. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."movies"."top_cast" IS
    'Up to three lead actors, in TMDB billing order. Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (credits is appended, no extra request). Null means not fetched yet: the nightly shard runs fill a capped number per run, and a single-title Resync refreshes one. An empty array means TMDB lists no cast. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."tv_shows"."creators" IS
    'Names from TMDB''s created_by (a series has no single director). Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (no extra request). An empty array means TMDB lists no creator; null means not fetched yet. Public facts, shown in the detail view.';

COMMENT ON COLUMN "public"."tv_shows"."top_cast" IS
    'Up to three actors with the most episodes across all seasons (TMDB aggregate_credits). Written by watchlist-cron-sync and the client add flow from the same TMDB detail call (aggregate_credits is appended, no extra request). Null means not fetched yet: the nightly shard runs fill a capped number per run, and a single-title Resync refreshes one. An empty array means TMDB lists no cast. Public facts, shown in the detail view.';

COMMIT;
