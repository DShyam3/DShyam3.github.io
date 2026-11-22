-- Cache of every part (film) of each TMDB collection that has a visible
-- (not hidden, not stopped) library film. Populated nightly by
-- watchlist-cron-sync (service_role) so Discover's "Have you already
-- watched?" walk reads one query instead of one tmdb-proxy call per
-- collection. TMDB catalogue data only: no library membership, no owner data.
--
-- Security checklist:
-- - RLS enabled; public SELECT policy (matches watchlist_collection_upcoming).
-- - No INSERT/UPDATE/DELETE policies and no write grants for anon/authenticated
--   (service_role bypasses RLS and holds ALL).
-- - No bare is_admin() calls.

BEGIN;

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

COMMIT;
