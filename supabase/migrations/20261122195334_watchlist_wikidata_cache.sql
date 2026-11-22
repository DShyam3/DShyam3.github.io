-- Nightly cache of tmdb-proxy's two Wikidata lookups (wikidata/tv-spinoffs and
-- wikidata/film-universes). watchlist-cron-sync (service_role) upserts one row
-- per lookup holding the proxy's exact JSON results array, so Discover and
-- Franchises read one row instead of calling the proxy. Wikidata/TMDB
-- catalogue data only: no owner data. seed_ids are TMDB ids of visible (not
-- hidden, not stopped) TV shows, which are already public.
--
-- Security checklist:
-- - RLS enabled; public SELECT policy (matches watchlist_collection_parts).
-- - No INSERT/UPDATE/DELETE policies and no write grants for anon/authenticated
--   (service_role bypasses RLS and holds ALL).
-- - No bare is_admin() calls.

BEGIN;

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

COMMIT;
