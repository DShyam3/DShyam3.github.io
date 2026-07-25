-- Helper used by every RLS policy below to check whether the caller is the
-- site admin, rather than merely a member of the `authenticated` role.
-- Previously, "Admin Write Access" policies only checked `TO authenticated`,
-- which any self-registered Supabase Auth user satisfies -- not just the admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'email' = 'd.shyam1256@gmail.com';
$$;
