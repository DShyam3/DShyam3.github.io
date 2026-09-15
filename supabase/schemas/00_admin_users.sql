-- Who is an administrator.
--
-- Sorts first, ahead of 00_extensions.sql, because it depends on nothing and
-- `01_functions.sql` depends on it: `is_admin()` is `LANGUAGE sql`, so
-- Postgres parses its body at creation time and the table has to exist by
-- then.
--
-- Why a table at all. `is_admin()` used to be a string literal:
--
--     SELECT auth.jwt() ->> 'email' = 'd.shyam1256@gmail.com';
--
-- which made one person's email address the authorization boundary for all 25
-- finance policies and every admin write across the site. Three things follow
-- from that which a table fixes:
--
--   * There is no second administrator, ever, without a migration.
--   * There is no test account either, so an automated smoke test of the
--     finance page cannot be run without handing over the real credentials.
--   * The claim it trusted is mutable. Supabase lets a signed-in user change
--     their own email; the confirmation mail makes taking *this* address
--     impractical rather than impossible, and identity should not rest on
--     that. `auth.uid()` is the subject claim and cannot be reassigned.
--
-- Membership is therefore keyed on the user id. `email` is stored so a person
-- reading this table can tell who a row is, and is never read by any policy.

CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_users" OWNER TO "postgres";

ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");

-- Deleting the account removes the grant with it, rather than leaving a row
-- that would make a recycled uuid an administrator.
ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;

-- RLS is enabled here, with the table, so admin_users is never briefly
-- unprotected in a from-empty build. The read policy itself lives in
-- 01_functions.sql instead of here: it calls is_admin(), which is LANGUAGE
-- sql and has its body validated by Postgres at creation time, so the policy
-- must be created after that function exists -- and is_admin() itself must
-- be created after this table exists, for the same reason. See
-- 01_functions.sql, immediately after is_admin(), for the policy and its
-- recursion note.

-- Grants
--
-- Stated as REVOKEs as well as GRANTs because pg_dump emits GRANT and never
-- REVOKE, so a privilege this database has deliberately taken away would not
-- appear in a generated diff and would be silently restored.

REVOKE ALL ON TABLE "public"."admin_users" FROM "anon";

REVOKE ALL ON TABLE "public"."admin_users" FROM "authenticated";

GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";

GRANT ALL ON TABLE "public"."admin_users" TO "service_role";

COMMENT ON TABLE "public"."admin_users" IS
    'Administrator grants, keyed on auth.users.id. Read by is_admin(), which is the authorization boundary for every admin policy in this database. Writes are service-role only.';

COMMENT ON COLUMN "public"."admin_users"."email" IS
    'For human identification when reading this table. Never read by a policy -- authorization is on user_id.';
