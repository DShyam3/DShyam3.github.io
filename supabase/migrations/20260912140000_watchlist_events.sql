-- Phase 8.D: watchlist_events, a change feed for the News page.
--
-- tv_shows.platform and tv_shows/movies.status are single columns the
-- nightly sync overwrites in place. When a show moves from Netflix to
-- Disney+, or a season goes from Returning Series to Ended, the old value is
-- gone and nothing records that it changed. This table is the history the
-- News page reads.
--
-- Detection lives in a trigger, not TypeScript. README.md:101 already
-- explains why the watchlist sync is two runtime implementations --
-- WatchlistContext.tsx in the browser, watchlist-cron-sync/index.ts in Deno,
-- sharing no module -- so a change-detection rule written in TypeScript
-- would be a third and fourth copy. A trigger is one implementation both
-- runtimes get for free, the same reasoning that put set_watched_at() in a
-- trigger in 20260912100000.
--
-- No foreign key on entity_id: it points at tv_shows.id or movies.id
-- depending on entity_type, and no single FK column can reference two
-- different parent tables (and the id ranges are not disjoint, so the pair
-- is not unique either without entity_type baked into both parents' keys).
-- The trigger is the only writer and is the integrity boundary instead.

BEGIN;

-- Function lives in 01_functions.sql (schema-file convention: functions
-- there, triggers in the table's own schema file once the table exists).
-- Restated here so the migration is runnable on its own against a database
-- that has not yet had the schema files replayed onto it.
--
-- movies has no status column. The status branch is gated on
-- TG_TABLE_NAME = 'tv_shows' first and nested rather than folded into a
-- single AND condition, so NEW.status is only ever resolved when the
-- trigger is actually firing on tv_shows -- PL/pgSQL resolves a record
-- field reference against the calling table's row type at that statement's
-- first execution, so a reference that is never reached for movies is never
-- resolved against it and never errors.
--
-- IS DISTINCT FROM, not <>: a NULL on either side (a show with no platform
-- yet, or a status the sync just cleared) is still a change and must still
-- produce a row, with the NULL carried into the JSON payload as JSON null.
-- COALESCE is deliberately absent -- it would swallow a real first-time
-- value being set.
--
-- Not SECURITY DEFINER: the watchlist_events RLS policies (public SELECT,
-- admin-gated INSERT) are the actual gate on who can write history. Running
-- as the function owner would let this trigger write past a future RLS
-- mistake on the table it feeds.
CREATE OR REPLACE FUNCTION "public"."log_watchlist_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  entity "text";
BEGIN
  entity := CASE TG_TABLE_NAME WHEN 'tv_shows' THEN 'tv_show' WHEN 'movies' THEN 'movie' END;

  IF NEW.platform IS DISTINCT FROM OLD.platform THEN
    INSERT INTO public.watchlist_events (entity_type, entity_id, kind, payload)
    VALUES (
      entity,
      NEW.id,
      'platform_change',
      jsonb_build_object('from', OLD.platform, 'to', NEW.platform)
    );
  END IF;

  IF TG_TABLE_NAME = 'tv_shows' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.watchlist_events (entity_type, entity_id, kind, payload)
      VALUES (
        'tv_show',
        NEW.id,
        'status_change',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."log_watchlist_event"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_watchlist_event"() TO "service_role";

CREATE TABLE IF NOT EXISTS "public"."watchlist_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "entity_type" "text" NOT NULL,
    "entity_id" integer NOT NULL,
    "kind" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "watchlist_events_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['tv_show'::"text", 'movie'::"text"]))),
    CONSTRAINT "watchlist_events_kind_check" CHECK (("kind" = ANY (ARRAY['platform_change'::"text", 'status_change'::"text"])))
);

ALTER TABLE "public"."watchlist_events" OWNER TO "postgres";

COMMENT ON COLUMN "public"."watchlist_events"."entity_id" IS
    'References tv_shows.id or movies.id depending on entity_type. Deliberately no foreign key: a single FK column cannot point at two different parent tables, and entity_id alone is not unique across them (a tv_show and a movie can share an id). Integrity is enforced by the trigger that is the only writer -- log_watchlist_event() -- not by a constraint.';

-- Every consumer (the News page feed) reads newest-first and nothing reads
-- it any other way.
CREATE INDEX "watchlist_events_occurred_at_idx" ON "public"."watchlist_events" USING "btree" ("occurred_at" DESC);

ALTER TABLE "public"."watchlist_events" ENABLE ROW LEVEL SECURITY;

-- Public read: this table holds show names and platform names, nothing
-- private, same as every sibling watchlist table.
CREATE POLICY "Public Read Access" ON "public"."watchlist_events" FOR SELECT USING (true);

-- log_watchlist_event() is not SECURITY DEFINER, so it inserts as whoever
-- ran the UPDATE on tv_shows/movies. The browser sync runs as a signed-in
-- admin, so without this policy the admin's own sync would fail RLS on its
-- own trigger-driven insert. watchlist-cron-sync's nightly UPSERT uses the
-- service role and bypasses RLS entirely, so it needs no policy here.
CREATE POLICY "Admin insert" ON "public"."watchlist_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

-- No UPDATE or DELETE policy anywhere for this table: events are
-- append-only, and nothing should ever be able to rewrite history.

CREATE OR REPLACE TRIGGER "tr_log_tv_show_watchlist_event" AFTER UPDATE ON "public"."tv_shows" FOR EACH ROW EXECUTE FUNCTION "public"."log_watchlist_event"();

CREATE OR REPLACE TRIGGER "tr_log_movie_watchlist_event" AFTER UPDATE ON "public"."movies" FOR EACH ROW EXECUTE FUNCTION "public"."log_watchlist_event"();

-- Grants: narrower than every existing watchlist table, on purpose. Default
-- privileges on this project still hand ALL on a newly created public table
-- to anon, authenticated and service_role, so the REVOKE lines are not idle
-- defence -- without them this table starts out exactly as over-granted as
-- every sibling table was before 20260905160000 and 20260912130000 narrowed
-- them.
--
-- anon: SELECT only.
--
-- authenticated: SELECT + INSERT, not ALL. The trigger's INSERT runs as the
-- authenticated admin who fired the UPDATE (see "not SECURITY DEFINER"
-- above), and needs the underlying table privilege to succeed -- the "Admin
-- insert" RLS policy is a second, independent gate on top of this grant, not
-- a substitute for it. No UPDATE, DELETE or TRUNCATE grant: append-only, and
-- TRUNCATE in particular is never subject to RLS at all.
--
-- service_role: ALL, matching every table in this schema -- its bypass of
-- RLS does not bypass the underlying grant.
REVOKE ALL ON TABLE "public"."watchlist_events" FROM "anon";

REVOKE ALL ON TABLE "public"."watchlist_events" FROM "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_events" TO "anon";

GRANT SELECT, INSERT ON TABLE "public"."watchlist_events" TO "authenticated";

GRANT ALL ON TABLE "public"."watchlist_events" TO "service_role";

COMMIT;
