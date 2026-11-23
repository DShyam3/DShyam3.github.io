-- Watchlist dismissals carry the title's TMDB facts, so a deterministic taste
-- profile can learn which genres the owner turns down.
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

-- All nullable, no default: old rows, and rows from clients that do not know the
-- title's facts, stay null. A separate one-off fills old rows from TMDB.
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD COLUMN IF NOT EXISTS "genre_ids" integer[],
    ADD COLUMN IF NOT EXISTS "original_language" "text",
    ADD COLUMN IF NOT EXISTS "release_year" smallint;

ALTER TABLE "public"."watchlist_dismissed_suggestions"
    DROP CONSTRAINT IF EXISTS "watchlist_dismissed_suggestions_original_language_check";
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD CONSTRAINT "watchlist_dismissed_suggestions_original_language_check" CHECK (("original_language" IS NULL OR "original_language" ~ '^[a-z]{2,3}$'));

ALTER TABLE "public"."watchlist_dismissed_suggestions"
    DROP CONSTRAINT IF EXISTS "watchlist_dismissed_suggestions_release_year_check";
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD CONSTRAINT "watchlist_dismissed_suggestions_release_year_check" CHECK (("release_year" IS NULL OR "release_year" BETWEEN 1870 AND 2100));

-- No genres is null, never an empty list: the one-off fill only touches rows
-- whose facts are all null.
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    DROP CONSTRAINT IF EXISTS "watchlist_dismissed_suggestions_genre_ids_check";
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD CONSTRAINT "watchlist_dismissed_suggestions_genre_ids_check" CHECK (("genre_ids" IS NULL OR "cardinality"("genre_ids") > 0));

COMMENT ON TABLE "public"."watchlist_dismissed_suggestions" IS
    'TMDB titles the owner marked "Not interested" on Watchlist News discovery. Identity is media + tmdb_id because TMDB film and show ids can collide. Public read so the public page hides the same suggestions; writes are admin only. reason: not_interested hides the title everywhere, skip (bulk "Skip these", formerly "None of these") hides it from suggestion lists for 90 days, a window the client applies. source: where the answer was given, unknown for rows from before it was recorded. answered_at: when the current answer was given; unlike created_at it moves when the answer changes. genre_ids, original_language, release_year: the title''s TMDB genre ids, original language and release year when the writer knew them; kept across later answers.';

-- An upsert can never weaken an answer. Two devices can upsert out of order, so
-- a stale device must not overwrite a newer or stronger answer. The client
-- already merges this way; the table agrees so the rule holds for any writer.
-- Rank: not_interested outranks skip. The row keeps its current answer when the
-- incoming reason ranks lower, or ranks equal and is older. Equal rank and
-- equal time takes the incoming row. The title's facts (genre_ids,
-- original_language, release_year) describe the title, not the answer, so a
-- write never loses them: a null incoming fact keeps the stored one, and facts
-- arriving with a weaker answer are still stored while the stronger answer
-- (reason, source, answered_at) is kept.
CREATE OR REPLACE FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
  old_rank integer := CASE OLD.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
  new_rank integer := CASE NEW.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
BEGIN
  NEW.genre_ids := COALESCE(NEW.genre_ids, OLD.genre_ids);
  NEW.original_language := COALESCE(NEW.original_language, OLD.original_language);
  NEW.release_year := COALESCE(NEW.release_year, OLD.release_year);
  IF new_rank < old_rank OR (new_rank = old_rank AND NEW.answered_at < OLD.answered_at) THEN
    NEW.reason := OLD.reason;
    NEW.source := OLD.source;
    NEW.answered_at := OLD.answered_at;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() OWNER TO "postgres";

-- Trigger-only: nothing calls it directly, so no role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "authenticated";

COMMIT;
