-- Make the merchant logo index and the merchant-logos bucket listing admin-only.
--
-- Why: anyone holding the publishable key could read public.finance_merchant_logos
-- and list the merchant-logos bucket in storage.objects. merchant-logo-cache
-- (service role) resolves only brands found in finance_transactions, so the
-- slugs and each resolved_at say which brands the owner pays and roughly when
-- each first appeared. The index is not free of user data, and neither is the
-- bucket listing, which names the same slugs.
--
-- What changes:
--   1. The "Public reads merchant logo index" policy on
--      public.finance_merchant_logos is dropped. The remaining policy,
--      "Admin writes merchant logo index", has no FOR clause and so covers
--      SELECT too: the admin can still read, nobody else can. Its name predates
--      that role and is left alone.
--   2. anon's four remaining privileges on the table (SELECT, REFERENCES,
--      TRIGGER, TRUNCATE) are revoked. RLS does not filter TRUNCATE, so the
--      grant is the only thing in front of it.
--   3. The storage.objects SELECT policy for the bucket, "Public reads merchant
--      logos" (anon and authenticated, bucket test only), is replaced by "Admin
--      reads merchant logos" (authenticated only, bucket test plus the admin
--      check). It is created and the old one dropped, rather than narrowed in
--      place and renamed, because supautils.policy_grants lets the migration
--      role create, alter and drop policies on storage.objects but not rename
--      them: RENAME needs ownership of the table, which belongs to
--      supabase_storage_admin. Both statements run in this one transaction, so
--      the bucket is never without its admin read.
--
-- What stays:
--   - Logo images keep loading for everyone. The app builds their URLs with
--     getPublicUrl, which points at the public-object route of a public
--     bucket; storage reads that route without consulting storage.objects
--     policies (checked on the local stack's storage-api and, after applying,
--     with one read of a hosted logo URL). Listing, authenticated download,
--     signed URLs, info, move, copy and upsert do go through the SELECT policy.
--   - Not closed here: object keys are `<slug>.<ext>` and the candidate slugs
--     ship in the client bundle, so the public route still answers "exists"
--     or "no such key" for a guessed brand. Closing that needs unguessable
--     keys or a private bucket; it is an open REHAUL_PLAN.md line.
--   - The only in-app reader of the index is src/features/finance/useMerchantLogos.ts,
--     which runs inside the admin-gated finance page.
--   - An admin SELECT policy stays on storage.objects rather than the read
--     being removed outright: Postgres applies SELECT policies to
--     UPDATE and DELETE ... RETURNING, which the storage API uses, so having
--     none could break admin update and delete through the API.
--   - authenticated and service_role keep their grants on the index table.
--     Narrowing authenticated's ALL is a separate plan item. service_role
--     bypasses RLS, so merchant-logo-cache is unaffected.
--   - The other three merchant-logos policies on storage.objects (writes,
--     updates, deletes) are not touched.
--
-- supabase/schemas/40_finance.sql carries the table side of this. Storage
-- policies are not in supabase/schemas/ (they are maintained by hand in
-- migrations/), so the storage side has no schema-file edit.

BEGIN;

SET LOCAL lock_timeout = '5s';
-- pg_policies deparses against search_path; pinning it makes the checks compare a fixed form.
SET LOCAL search_path = '';

-- Guard: refuse to run unless the live state is exactly what this was written
-- against. A policy or grant that has drifted is one whose intent we no longer
-- know, and rewriting it blind would overwrite that.
DO $$
DECLARE
    v_mismatch text;
    v_count    integer;
    v_privs    text;
BEGIN
    -- The index table: exactly these two policies, nothing else.
    SELECT pg_catalog.count(*)
    INTO v_count
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'finance_merchant_logos';

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Refusing to run: finance_merchant_logos has % policies, expected exactly 2', v_count;
    END IF;

    SELECT pg_catalog.string_agg(pg_catalog.format('%I', e.policyname), ', ')
    INTO v_mismatch
    FROM (VALUES
        ('Public reads merchant logo index', 'SELECT', ARRAY['anon', 'authenticated']::name[], 'true',                                NULL),
        ('Admin writes merchant logo index', 'ALL',    ARRAY['authenticated']::name[],         '( SELECT public.is_admin() AS is_admin)', '( SELECT public.is_admin() AS is_admin)')
    ) AS e(policyname, cmd, roles, qual, with_check)
    LEFT JOIN pg_catalog.pg_policies p
        ON p.schemaname = 'public' AND p.tablename = 'finance_merchant_logos' AND p.policyname = e.policyname
    WHERE p.policyname IS NULL
       OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
       OR p.cmd IS DISTINCT FROM e.cmd
       OR p.roles IS DISTINCT FROM e.roles
       OR p.qual IS DISTINCT FROM e.qual
       OR p.with_check IS DISTINCT FROM e.with_check;

    IF v_mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Refusing to run: these finance_merchant_logos policies do not read as expected: %', v_mismatch;
    END IF;

    IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.finance_merchant_logos'::pg_catalog.regclass) THEN
        RAISE EXCEPTION 'Refusing to run: row level security is not enabled on finance_merchant_logos';
    END IF;

    -- anon's privileges on the table: exactly the four the earlier INSERT/UPDATE/DELETE revoke left.
    SELECT pg_catalog.string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type)
    INTO v_privs
    FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
    WHERE c.oid = 'public.finance_merchant_logos'::pg_catalog.regclass
      AND a.grantee = 'anon'::pg_catalog.regrole;

    IF v_privs IS DISTINCT FROM 'REFERENCES, SELECT, TRIGGER, TRUNCATE' THEN
        RAISE EXCEPTION 'Refusing to run: anon holds [%] on finance_merchant_logos, expected [REFERENCES, SELECT, TRIGGER, TRUNCATE]', v_privs;
    END IF;

    -- The storage policy to narrow, and the name it is to take must be free.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies p
        WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
          AND p.policyname = 'Public reads merchant logos'
          AND p.permissive = 'PERMISSIVE'
          AND p.cmd = 'SELECT'
          AND p.roles = ARRAY['anon', 'authenticated']::name[]
          AND p.qual = '(bucket_id = ''merchant-logos''::text)'
          AND p.with_check IS NULL
    ) THEN
        RAISE EXCEPTION 'Refusing to run: storage.objects "Public reads merchant logos" does not read as expected';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies p
        WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
          AND p.policyname = 'Admin reads merchant logos'
    ) THEN
        RAISE EXCEPTION 'Refusing to run: storage.objects already has "Admin reads merchant logos"';
    END IF;
END
$$;

-- 1. The index: drop the public read. "Admin writes merchant logo index" (ALL)
--    already lets the admin read.
DROP POLICY "Public reads merchant logo index" ON public.finance_merchant_logos;

-- 2. The index: anon holds nothing. Granted separately from RLS, and TRUNCATE
--    in particular is not filtered by it.
REVOKE ALL ON TABLE public.finance_merchant_logos FROM anon;

-- 3. The bucket listing: admin only, and named for it. Created before the old
--    policy is dropped; RENAME is not available to this role (see the header).
CREATE POLICY "Admin reads merchant logos" ON storage.objects
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (bucket_id = 'merchant-logos' AND (SELECT public.is_admin()));

DROP POLICY "Public reads merchant logos" ON storage.objects;

-- Post-check: the index has exactly its one admin policy and anon holds nothing
-- on it; the storage SELECT policy is admin-only under its new name; and no
-- other storage read policy for anon, public or authenticated could still list
-- the bucket.
DO $$
DECLARE
    v_mismatch text;
    v_count    integer;
    v_priv     text;
    v_role     text;
    v_open     text;
BEGIN
    -- The index: one policy left, the admin one, unchanged.
    SELECT pg_catalog.count(*)
    INTO v_count
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'finance_merchant_logos';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Post-check failed: finance_merchant_logos has % policies, expected exactly 1', v_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = 'finance_merchant_logos'
          AND p.policyname = 'Admin writes merchant logo index'
          AND p.permissive = 'PERMISSIVE'
          AND p.cmd = 'ALL'
          AND p.roles = ARRAY['authenticated']::name[]
          AND p.qual = '( SELECT public.is_admin() AS is_admin)'
          AND p.with_check = '( SELECT public.is_admin() AS is_admin)'
    ) THEN
        RAISE EXCEPTION 'Post-check failed: the remaining finance_merchant_logos policy is not the admin one';
    END IF;

    IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = 'public.finance_merchant_logos'::pg_catalog.regclass) THEN
        RAISE EXCEPTION 'Post-check failed: row level security is not enabled on finance_merchant_logos';
    END IF;

    -- anon: no privilege of any kind, whether granted to it, to PUBLIC, or on a single column.
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF pg_catalog.has_table_privilege('anon', 'public.finance_merchant_logos', v_priv) THEN
            RAISE EXCEPTION 'Post-check failed: anon still holds % on finance_merchant_logos', v_priv;
        END IF;
    END LOOP;

    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        IF pg_catalog.has_any_column_privilege('anon', 'public.finance_merchant_logos', v_priv) THEN
            RAISE EXCEPTION 'Post-check failed: anon still holds % on a column of finance_merchant_logos', v_priv;
        END IF;
    END LOOP;

    -- authenticated and service_role keep everything they had.
    FOREACH v_role IN ARRAY ARRAY['authenticated', 'service_role'] LOOP
        FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
            IF NOT pg_catalog.has_table_privilege(v_role, 'public.finance_merchant_logos', v_priv) THEN
                RAISE EXCEPTION 'Post-check failed: % lost % on finance_merchant_logos', v_role, v_priv;
            END IF;
        END LOOP;
    END LOOP;

    -- The storage policy: admin-only, under its new name, and the old name gone.
    SELECT pg_catalog.string_agg(pg_catalog.format('%I', e.policyname), ', ')
    INTO v_mismatch
    FROM (VALUES ('Admin reads merchant logos')) AS e(policyname)
    LEFT JOIN pg_catalog.pg_policies p
        ON p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = e.policyname
    WHERE p.policyname IS NULL
       OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
       OR p.cmd IS DISTINCT FROM 'SELECT'
       OR p.roles IS DISTINCT FROM ARRAY['authenticated']::name[]
       OR p.qual IS DISTINCT FROM '((bucket_id = ''merchant-logos''::text) AND ( SELECT public.is_admin() AS is_admin))'
       OR p.with_check IS NOT NULL;

    IF v_mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: storage.objects policy does not read as intended: %', v_mismatch;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies p
        WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
          AND p.policyname = 'Public reads merchant logos'
    ) THEN
        RAISE EXCEPTION 'Post-check failed: storage.objects still has "Public reads merchant logos"';
    END IF;

    -- Signup is open on hosted, so "authenticated" includes strangers: any other
    -- read policy that names the bucket, or that has no bucket test at all,
    -- would keep the listing open.
    SELECT pg_catalog.string_agg(pg_catalog.format('%I', p.policyname), ', ')
    INTO v_open
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname <> 'Admin reads merchant logos'
      AND p.cmd IN ('SELECT', 'ALL')
      AND p.roles && ARRAY['anon', 'public', 'authenticated']::name[]
      AND (pg_catalog.concat_ws(' ', p.qual, p.with_check) LIKE '%merchant-logos%'
           OR COALESCE(p.qual, '') NOT LIKE '%bucket_id = %');

    IF v_open IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: storage read policies that could still list merchant-logos: %', v_open;
    END IF;
END
$$;

COMMIT;
