-- Least privilege on public.finance_merchant_logos: grants only, no policy
-- change.
--
-- 20260907170100_merchant_logo_cache revoked only INSERT, UPDATE and DELETE
-- from anon, so the rest of the default-privilege GRANT ALL survived. Hosted
-- ACL read on 2026-10-24: anon=rDxt (SELECT, TRUNCATE, REFERENCES, TRIGGER),
-- authenticated=arwdDxt (all seven). Why TRUNCATE matters when RLS is on: see
-- 20260906120100_revoke_anon_writes_on_finance_tables.
--
--  * anon: SELECT only, kept at the owner's direction to match the public
--    merchant-logos bucket. It is not anonymous data: the resolver caches only
--    directory brands it finds in finance_transactions, so the rows say which
--    brands the owner pays, and since when. Nothing in the app reads it as
--    anon -- useMerchantLogos runs behind the admin-only finance page.
--  * authenticated: SELECT, INSERT, UPDATE, DELETE, like finance_transfer_links.
--    No code writes as authenticated (merchant-logo-cache uses service_role);
--    the DML grants keep the admin write policy usable for a manual repair.
--  * service_role: ALL, stated rather than left to the default.

BEGIN;

REVOKE ALL ON TABLE "public"."finance_merchant_logos" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_merchant_logos" FROM "authenticated";
GRANT SELECT ON TABLE "public"."finance_merchant_logos" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_merchant_logos" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_merchant_logos" TO "service_role";

-- Roll everything back unless each role ends up with exactly its set.
-- has_table_privilege reads effective privileges, PUBLIC and inherited roles
-- included, not only grants that name the role.
DO $$
DECLARE
  r    record;
  held text[];
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('anon',          ARRAY['SELECT']),
      ('authenticated', ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE']),
      ('service_role',  ARRAY['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'])
    ) AS t (role_name, expected)
  LOOP
    SELECT coalesce(array_agg(p ORDER BY p), '{}')
      INTO held
      FROM unnest(ARRAY['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) AS p
     WHERE has_table_privilege(r.role_name, 'public.finance_merchant_logos', p);

    IF held IS DISTINCT FROM r.expected THEN
      RAISE EXCEPTION 'finance_merchant_logos: % holds %, expected %', r.role_name, held, r.expected;
    END IF;
  END LOOP;
END
$$;

COMMIT;
