-- Watchlist "Not interested" suggestion dismissals, synced across devices.
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

-- TMDB titles the owner marked "Not interested" on Watchlist News discovery,
-- kept in the database so the dismissal follows the owner across devices.
-- Insert and delete only: a dismissal is made or undone, never edited.
CREATE TABLE IF NOT EXISTS "public"."watchlist_dismissed_suggestions" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "media" "text" NOT NULL,
    "tmdb_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "watchlist_dismissed_suggestions_media_check" CHECK (("media" = ANY (ARRAY['movie'::"text", 'tv'::"text"]))),
    CONSTRAINT "watchlist_dismissed_suggestions_tmdb_id_check" CHECK (("tmdb_id" > 0)),
    CONSTRAINT "watchlist_dismissed_suggestions_media_tmdb_id_key" UNIQUE ("media", "tmdb_id")
);

ALTER TABLE "public"."watchlist_dismissed_suggestions" OWNER TO "postgres";

COMMENT ON TABLE "public"."watchlist_dismissed_suggestions" IS
    'TMDB titles the owner marked "Not interested" on Watchlist News discovery. Identity is media + tmdb_id because TMDB film and show ids can collide. Public read so the public page hides the same suggestions; writes are admin only.';

ALTER TABLE "public"."watchlist_dismissed_suggestions" ENABLE ROW LEVEL SECURITY;

-- Public read, like the rest of the watchlist: a TMDB id and a media type,
-- nothing private. No UPDATE policy -- rows are inserted or deleted.
CREATE POLICY "Public Read Access" ON "public"."watchlist_dismissed_suggestions" FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "Admin insert" ON "public"."watchlist_dismissed_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin delete" ON "public"."watchlist_dismissed_suggestions" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

-- A fresh table starts from the image's default of ALL for anon and
-- authenticated, so the REVOKE is load-bearing: TRUNCATE is not filtered by
-- RLS and the grant is the only barrier. The identity column needs no
-- sequence grant.
REVOKE ALL ON TABLE "public"."watchlist_dismissed_suggestions" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_dismissed_suggestions" TO "anon";

GRANT SELECT, INSERT, DELETE ON TABLE "public"."watchlist_dismissed_suggestions" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_dismissed_suggestions" TO "service_role";

COMMIT;
