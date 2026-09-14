-- Administrator identity moves from a string literal inside is_admin() to a
-- table, so that a second account can exist without a migration.
--
-- This is the authorization boundary for all 25 finance policies and every
-- admin write on the site, so the transaction is written to fail rather than
-- to half-apply: if the existing owner cannot be carried across, it raises and
-- rolls back, leaving the previous is_admin() in place. A migration that
-- silently produced an empty admin_users table would lock the owner out of
-- their own site, and the symptom -- every write denied -- would not point
-- here.
BEGIN;

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    email text NOT NULL,
    note text,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_users OWNER TO postgres;

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);

-- Deleting the account removes the grant with it, rather than leaving a row
-- that would make a recycled uuid an administrator.
ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM anon;
REVOKE ALL ON TABLE public.admin_users FROM authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

-- Carry the existing owner across, by the literal the old function tested.
-- This is the only place that address remains, and after this migration it is
-- data rather than code.
INSERT INTO public.admin_users (user_id, email, note)
SELECT id, email, 'Bootstrapped from the email literal previously hardcoded in is_admin().'
FROM auth.users
WHERE email = 'd.shyam1256@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- The guard.
--
-- An empty admin_users is correct on a database with no accounts yet -- a
-- fresh local stack, where `supabase/seed.sql` creates the test account and
-- grants it immediately afterwards. It is a lockout anywhere else, so the two
-- cases are told apart by whether any account exists at all.
DO $$
DECLARE
    v_admins integer;
    v_users integer;
BEGIN
    SELECT count(*) INTO v_admins FROM public.admin_users;
    SELECT count(*) INTO v_users FROM auth.users;

    IF v_admins = 0 AND v_users > 0 THEN
        RAISE EXCEPTION
            'admin_users is empty but auth.users holds % account(s). The bootstrap address did not match any of them, so applying this migration would revoke every administrator. Insert the correct row into public.admin_users and re-run.', v_users;
    END IF;

    IF v_admins = 0 THEN
        RAISE NOTICE 'No accounts exist yet, so no administrator was bootstrapped. A seed or a manual insert must grant one.';
    END IF;
END $$;

-- Read-only to an administrator, unwritable through the API. Granting
-- administrator rights is not something an administrator session should be
-- able to do by sending a request; writes go through the service role.
CREATE POLICY "Admin read" ON public.admin_users
    FOR SELECT TO authenticated USING (public.is_admin());

-- Note on recursion: that policy calls a function that reads this table.
-- is_admin() is SECURITY DEFINER and owned by postgres, and a table's owner is
-- exempt from its own RLS, so the inner read does not re-enter the policy.
-- This table must never be given FORCE ROW LEVEL SECURITY.

-- Keyed on the subject claim rather than the email claim: a signed-in user can
-- change their own email, and identity should not rest on a claim the account
-- holder controls.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

COMMENT ON TABLE public.admin_users IS
    'Administrator grants, keyed on auth.users.id. Read by is_admin(), which is the authorization boundary for every admin policy in this database. Writes are service-role only.';

COMMENT ON COLUMN public.admin_users.email IS
    'For human identification when reading this table. Never read by a policy -- authorization is on user_id.';

COMMIT;
