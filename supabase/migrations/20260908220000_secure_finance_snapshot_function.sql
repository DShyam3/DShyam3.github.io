-- capture_finance_snapshots is SECURITY DEFINER and writes the historical
-- position for every profile. PostgreSQL grants EXECUTE to PUBLIC by default,
-- so revoking only anon/authenticated leaves it externally callable.
--
-- The nightly cron is the postgres owner. The TrueLayer Edge Function uses
-- service_role after each successful bank sync, so grant only that role.

BEGIN;

REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."capture_finance_snapshots"() TO "service_role";

COMMIT;
