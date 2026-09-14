-- Least privilege for `anon` on the public watchlist tables and their sequences.
--
-- Two halves, with quite different standing:
--
-- 1. The TABLES were already narrowed in 20260905160000
--    (revoke_anon_writes_on_content_tables), which ran REVOKE ALL / GRANT
--    SELECT over favourites, movies, tv_show*, weekly_schedule among others.
--    The live database is already correct. What is wrong is
--    supabase/schemas/20_watchlist.sql, which still declares
--    `GRANT ALL ON TABLE ... TO anon` -- because pg_dump emits GRANT and never
--    REVOKE, so the revoke never made it back into the declarative file. A
--    declarative diff run against that file would hand anon its write
--    privileges back, silently. The statements below are therefore a
--    re-assertion, idempotent by construction, and the accompanying edit to
--    20_watchlist.sql is the part that actually closes the hole.
--
-- 2. The SEQUENCES were not covered by 20260905160000 and are still
--    over-granted live. `GRANT ALL ON SEQUENCE` is USAGE + SELECT + UPDATE,
--    and UPDATE on a sequence is what nextval() and setval() need: anon can
--    advance or rewind the id counters for all six tables. anon holds no
--    INSERT on any of them, so it has no use for the grant at all.
--
-- Accurate risk, not a scare story:
--
--  * RLS is enabled on every one of these tables, and the only
--    INSERT/UPDATE/DELETE policies are TO authenticated with is_admin(). So
--    anon INSERT/UPDATE/DELETE matches zero rows regardless of the grant.
--  * TRUNCATE is the exception that makes the table grant worth removing:
--    Postgres applies row-level security to SELECT/INSERT/UPDATE/DELETE only,
--    never to TRUNCATE. Under `GRANT ALL` the grant layer is the sole barrier
--    between anon and an empty table.
--  * Neither TRUNCATE nor setval() is reachable through PostgREST, which
--    exposes no verb for either. Nothing here is exploitable today.
--
-- So: defence in depth and least privilege, and specifically insurance against
-- a future RLS mistake on a public-read table becoming data loss. Not a fix
-- for an open door.
--
-- Deliberately not touched:
--
--  * `authenticated` keeps GRANT ALL. It holds the same latent TRUNCATE, but
--    every finance_* and content table in this project grants ALL to
--    authenticated and relies on is_admin() in RLS to gate the writes -- the
--    only tables that narrow it revoke it outright (rate_limits, admin_users,
--    finance_truelayer_source_sync) because authenticated has no business
--    reading them at all. authenticated is the signed-in admin's own role and
--    does need INSERT/UPDATE/DELETE plus sequence USAGE here, so narrowing it
--    to a privilege subset would invent a pattern this schema does not use.
--    Worth revisiting globally rather than on six tables.
--  * `service_role` keeps GRANT ALL. watchlist-cron-sync authenticates with
--    SUPABASE_SERVICE_ROLE_KEY (supabase/functions/watchlist-cron-sync/index.ts),
--    which bypasses both RLS and these grants; its nightly upserts are
--    unaffected by anything in this file.
--  * ALTER DEFAULT PRIVILEGES, which still grants ALL on new tables and
--    sequences in `public` to anon. A table created after this migration
--    starts permissive again, exactly as 20260905160000 noted.

BEGIN;

-- Tables: strip everything, hand back only the SELECT the public site reads.
DO $$
DECLARE
  readable_table text;
BEGIN
  FOREACH readable_table IN ARRAY ARRAY[
    'favourites',
    'movies',
    'tv_show_episodes',
    'tv_show_seasons',
    'tv_shows',
    'weekly_schedule'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', readable_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', readable_table);
  END LOOP;
END
$$;

-- Sequences: nothing handed back. anon cannot INSERT into any of these
-- tables, so it needs neither USAGE nor UPDATE on their id counters.
REVOKE ALL ON SEQUENCE "public"."favourites_id_seq"        FROM "anon";
REVOKE ALL ON SEQUENCE "public"."movies_id_seq"            FROM "anon";
REVOKE ALL ON SEQUENCE "public"."tv_show_episodes_id_seq"  FROM "anon";
REVOKE ALL ON SEQUENCE "public"."tv_show_seasons_id_seq"   FROM "anon";
REVOKE ALL ON SEQUENCE "public"."tv_shows_id_seq"          FROM "anon";
REVOKE ALL ON SEQUENCE "public"."weekly_schedule_id_seq"   FROM "anon";

-- sync_log rides along because it sits in the same file and has the same
-- staleness: its RLS was narrowed to is_admin() in 20260904111858 and
-- 20260905160000 revoked anon's table grants without handing SELECT back, yet
-- 20_watchlist.sql still declared a partial anon grant and its sequence was
-- never touched. anon has no business reading it, so nothing is granted back.
REVOKE ALL ON TABLE    "public"."sync_log"        FROM "anon";
REVOKE ALL ON SEQUENCE "public"."sync_log_id_seq" FROM "anon";

COMMIT;
