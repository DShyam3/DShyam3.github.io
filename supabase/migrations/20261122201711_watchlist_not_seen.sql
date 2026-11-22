-- Watchlist "Not seen" answers from Discover's "Have you already watched?".
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

-- TMDB titles the owner said they have NOT seen, answered under Discover's
-- "Have you already watched?". Kept apart from watchlist_dismissed_suggestions
-- on purpose: "not seen" and "not interested" are different answers and must
-- not overwrite each other. Insert and delete only: an answer is made or
-- undone, never edited.
CREATE TABLE IF NOT EXISTS "public"."watchlist_not_seen" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "media" "text" NOT NULL,
    "tmdb_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_not_seen_media_check" CHECK (("media" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "watchlist_not_seen_tmdb_id_check" CHECK (("tmdb_id" > 0)),
    CONSTRAINT "watchlist_not_seen_media_tmdb_id_key" UNIQUE ("media", "tmdb_id")
);

ALTER TABLE "public"."watchlist_not_seen" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_not_seen" IS
    'TMDB titles the owner said they have not seen, from Discover''s "Have you already watched?". Kept apart from watchlist_dismissed_suggestions because not seen and not interested are different answers. Identity is media + tmdb_id because TMDB film and show ids can collide. Public read so the public page stops asking about the same titles; writes are admin only.';

ALTER TABLE "public"."watchlist_not_seen" ENABLE ROW LEVEL SECURITY;

-- Public read, like the rest of the watchlist: a TMDB id and a media type,
-- nothing private. No UPDATE policy -- rows are inserted or deleted.
DROP POLICY IF EXISTS "Public Read Access" ON "public"."watchlist_not_seen";
CREATE POLICY "Public Read Access" ON "public"."watchlist_not_seen" FOR SELECT TO "anon", "authenticated" USING (true);

DROP POLICY IF EXISTS "Admin insert" ON "public"."watchlist_not_seen";
CREATE POLICY "Admin insert" ON "public"."watchlist_not_seen" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Admin delete" ON "public"."watchlist_not_seen";
CREATE POLICY "Admin delete" ON "public"."watchlist_not_seen" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- A fresh table starts from the image's default of ALL for anon and
-- authenticated, so the REVOKE is load-bearing: TRUNCATE is not filtered by
-- RLS and the grant is the only barrier. The identity column needs no
-- sequence grant.
REVOKE ALL ON TABLE "public"."watchlist_not_seen" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_not_seen" TO "anon";

GRANT SELECT, INSERT, DELETE ON TABLE "public"."watchlist_not_seen" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_not_seen" TO "service_role";

COMMIT;
