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

-- An administrator may read the list, which is what lets the account page say
-- who has access. Nobody may write it through the API: granting administrator
-- rights is not something an administrator session should be able to do by
-- sending a request, so inserts and deletes go through the service role (the
-- seed script, or the SQL editor). RLS on with no write policy denies the rest
-- by default.
CREATE POLICY "Admin read" ON "public"."admin_users"
    FOR SELECT TO "authenticated" USING ("public"."is_admin"());

-- Note on recursion: that policy calls a function that reads this table.
-- `is_admin()` is SECURITY DEFINER and owned by postgres, and a table's owner
-- is exempt from its own RLS, so the inner read does not re-enter the policy.
-- This table must therefore never be given FORCE ROW LEVEL SECURITY, which
-- would remove that exemption and turn the check into infinite recursion.

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
