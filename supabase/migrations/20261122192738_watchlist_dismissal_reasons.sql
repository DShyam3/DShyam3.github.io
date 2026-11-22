-- Watchlist dismissals record why and where each answer was given.
-- Declarative copy: supabase/schemas/20_watchlist.sql.
BEGIN;

-- reason: not_interested is the per-title button and hides the title
-- everywhere; skip is the bulk "Skip these" button (formerly "None of these") and hides it from
-- suggestion lists for 90 days (the window is client logic). source: where the
-- answer was given. answered_at: when the current answer was given -- unlike
-- created_at it moves when the answer changes.
--
-- The backfill runs only on the run that adds the columns. Re-running the file
-- must not rewrite real answers with guesses, so it is gated on answered_at
-- not existing yet.
DO $$
DECLARE
    first_run boolean;
BEGIN
    SELECT NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'watchlist_dismissed_suggestions'
          AND column_name = 'answered_at'
    ) INTO first_run;

    ALTER TABLE "public"."watchlist_dismissed_suggestions"
        ADD COLUMN IF NOT EXISTS "reason" "text" NOT NULL DEFAULT 'not_interested',
        ADD COLUMN IF NOT EXISTS "source" "text" NOT NULL DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS "answered_at" timestamp with time zone NOT NULL DEFAULT "now"();

    IF first_run THEN
        -- ADD COLUMN stamped the migration time; set it back to when the row was made.
        UPDATE "public"."watchlist_dismissed_suggestions"
        SET "answered_at" = "created_at";

        -- Rows sharing a created_at came in one statement (a bulk "None of these",
        -- or a browser's saved list handed over): skips. A unique created_at is a
        -- single click and keeps the not_interested default. source stays unknown.
        -- Exception: the group sharing the table's earliest created_at is the
        -- first browser handover when the table went live, before any bulk button
        -- existed, so it holds per-title Not interested clicks and stays
        -- not_interested. A wrong skip is the costlier mistake: a wrongly skipped
        -- Not interested reappears on franchise cards and in Likely seen, while a
        -- wrongly kept Not interested only keeps today's behaviour.
        UPDATE "public"."watchlist_dismissed_suggestions" AS d
        SET "reason" = 'skip'
        WHERE EXISTS (
            SELECT 1 FROM "public"."watchlist_dismissed_suggestions" AS o
            WHERE o."created_at" = d."created_at" AND o."id" <> d."id"
        )
        AND d."created_at" <> (SELECT min("created_at") FROM "public"."watchlist_dismissed_suggestions");
    END IF;
END
$$;

ALTER TABLE "public"."watchlist_dismissed_suggestions"
    DROP CONSTRAINT IF EXISTS "watchlist_dismissed_suggestions_reason_check";
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD CONSTRAINT "watchlist_dismissed_suggestions_reason_check" CHECK (("reason" = ANY (ARRAY['not_interested'::"text", 'skip'::"text"])));

ALTER TABLE "public"."watchlist_dismissed_suggestions"
    DROP CONSTRAINT IF EXISTS "watchlist_dismissed_suggestions_source_check";
ALTER TABLE "public"."watchlist_dismissed_suggestions"
    ADD CONSTRAINT "watchlist_dismissed_suggestions_source_check" CHECK (("source" = ANY (ARRAY['coming_soon'::"text", 'you_might_like'::"text", 'likely_seen'::"text", 'franchise'::"text", 'unknown'::"text"])));

COMMENT ON TABLE "public"."watchlist_dismissed_suggestions" IS
    'TMDB titles the owner marked "Not interested" on Watchlist News discovery. Identity is media + tmdb_id because TMDB film and show ids can collide. Public read so the public page hides the same suggestions; writes are admin only. reason: not_interested hides the title everywhere, skip (bulk "Skip these", formerly "None of these") hides it from suggestion lists for 90 days, a window the client applies. source: where the answer was given, unknown for rows from before it was recorded. answered_at: when the current answer was given; unlike created_at it moves when the answer changes.';

-- The client upserts (ON CONFLICT DO UPDATE), which needs UPDATE.
DROP POLICY IF EXISTS "Admin update" ON "public"."watchlist_dismissed_suggestions";
CREATE POLICY "Admin update" ON "public"."watchlist_dismissed_suggestions" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."watchlist_dismissed_suggestions" TO "authenticated";

-- An upsert can never weaken an answer. Two devices can upsert out of order, so
-- a stale device must not overwrite a newer or stronger answer. The client
-- already merges this way; the table agrees so the rule holds for any writer.
-- Rank: not_interested outranks skip. The row keeps its current answer when the
-- incoming reason ranks lower, or ranks equal and is older. Equal rank and
-- equal time takes the incoming row.
CREATE OR REPLACE FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
DECLARE
  old_rank integer := CASE OLD.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
  new_rank integer := CASE NEW.reason WHEN 'not_interested' THEN 2 ELSE 1 END;
BEGIN
  IF new_rank < old_rank OR (new_rank = old_rank AND NEW.answered_at < OLD.answered_at) THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() OWNER TO "postgres";

-- Trigger-only: nothing calls it directly, so no role needs EXECUTE.
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "anon";
REVOKE EXECUTE ON FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"() FROM "authenticated";

DROP TRIGGER IF EXISTS "tr_watchlist_dismissed_suggestions_keep_stronger" ON "public"."watchlist_dismissed_suggestions";

CREATE TRIGGER "tr_watchlist_dismissed_suggestions_keep_stronger" BEFORE UPDATE ON "public"."watchlist_dismissed_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."watchlist_dismissed_suggestions_keep_stronger"();

COMMIT;
