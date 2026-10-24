-- Schema-level grants and default privileges.
-- Per-table grants live in each collection file so that deleting a
-- collection removes everything about it in one place.

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";

-- New tables: an allowlist. authenticated gets the four data verbs and nothing
-- else; anon gets nothing, so a public-read table says so with its own
-- GRANT SELECT ... TO "anon" (every one does, in its collection file) and a
-- forgotten REVOKE on a future table fails safe. TRUNCATE is not filtered by
-- RLS, so a default grant of it would make the grant the only guard on every
-- future table; REFERENCES and TRIGGER only matter for DDL nobody runs as these
-- roles. An allowlist rather than a REVOKE of those three, because it also
-- covers any privilege Postgres adds to ALL later (PG17 added MAINTAIN). A fresh
-- build starts from the image's default of ALL, hence each GRANT is preceded by
-- a REVOKE ALL. The authenticated grants on existing tables are narrowed by
-- 20261024150000_authenticated_grants_least_privilege.sql. Only the postgres
-- defaults are altered: supabase_admin's cannot be changed from postgres on
-- hosted, and no app table is owned by supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
