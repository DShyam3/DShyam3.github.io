-- Cache of dated future films in TMDB collections present in the library.
-- Populated nightly by watchlist-cron-sync (service_role) so Discover's
-- Coming soon surfaces newly dated sequels across every franchise without
-- scanning every collection from the browser.
--
-- Security checklist:
-- - RLS enabled; public SELECT policy (matches movies / viewing_orders).
-- - No INSERT/UPDATE/DELETE policies and no write grants for anon/authenticated
--   (service_role bypasses RLS and holds ALL).
-- - No bare is_admin() calls.

BEGIN;

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

COMMIT;
