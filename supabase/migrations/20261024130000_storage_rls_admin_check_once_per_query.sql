-- Evaluate is_admin() once per statement in the storage.objects policies.
--
-- public.is_admin() is LANGUAGE sql STABLE SECURITY DEFINER with a SET
-- search_path, so Postgres cannot inline it. Called bare in a policy it runs
-- once for every row the policy is tested against; wrapped as
-- `(SELECT public.is_admin())` it becomes an InitPlan and runs once per
-- statement.
--
-- 20261024120000_rls_admin_check_once_per_query.sql wrapped the public-schema
-- policies. This completes it for storage.objects, which that migration left
-- out because each of these 14 policies combines the call with a bucket test
-- and so has to be rewritten by hand rather than pattern-replaced. The four
-- public-read SELECT policies ("Public Access", "Public document access",
-- "Public photo access", "Public reads merchant logos") never call is_admin()
-- and are not touched.
--
-- ALTER POLICY keeps the role, the command and permissive/restrictive as they
-- are; only the clauses named below change, and each is given exactly the
-- clauses the policy has today (INSERT: WITH CHECK only; SELECT and DELETE:
-- USING only; UPDATE: both, each with its own bucket test). The bucket tests
-- are unchanged.
--
-- Small statements lose nothing: the InitPlan runs lazily, when the first row
-- reaches the policy, so a statement that touches no rows never calls
-- is_admin() and one that touches a single row calls it once per clause, as
-- the bare form did. The saving on a multi-row list or delete is the reason for
-- the change.
--
-- Storage policies are not in supabase/schemas/ (supabase/README.md: they are
-- maintained by hand in the baseline migration), so there is no schema-file
-- edit for this. The migration role postgres may alter these policies through
-- supautils.policy_grants, the same way the earlier migrations created them.

BEGIN;

SET LOCAL lock_timeout = '5s';
-- pg_policies deparses against search_path; pinning it makes the guards compare a fixed form.
SET LOCAL search_path = '';

-- Guard: refuse to run unless every targeted policy reads exactly as expected
-- today. A policy that has drifted since this was written is one whose intent
-- we no longer know, and rewriting it blind would overwrite that.
DO $$
DECLARE
    v_mismatch text;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.format('%I', e.policyname), ', ')
    INTO v_mismatch
    FROM (VALUES
        ('Admin deletes documents',        'DELETE', '((bucket_id = ''documents''::text) AND public.is_admin())',         NULL),
        ('Admin deletes finance documents','DELETE', '((bucket_id = ''finance-documents''::text) AND public.is_admin())', NULL),
        ('Admin deletes merchant logos',   'DELETE', '((bucket_id = ''merchant-logos''::text) AND public.is_admin())',    NULL),
        ('Admin deletes photos',           'DELETE', '((bucket_id = ''photos''::text) AND public.is_admin())',            NULL),
        ('Admin reads finance documents',  'SELECT', '((bucket_id = ''finance-documents''::text) AND public.is_admin())', NULL),
        ('Admin updates documents',        'UPDATE', '((bucket_id = ''documents''::text) AND public.is_admin())',         '((bucket_id = ''documents''::text) AND public.is_admin())'),
        ('Admin updates finance documents','UPDATE', '((bucket_id = ''finance-documents''::text) AND public.is_admin())', '((bucket_id = ''finance-documents''::text) AND public.is_admin())'),
        ('Admin updates merchant logos',   'UPDATE', '((bucket_id = ''merchant-logos''::text) AND public.is_admin())',    '((bucket_id = ''merchant-logos''::text) AND public.is_admin())'),
        ('Admin updates photos',           'UPDATE', '((bucket_id = ''photos''::text) AND public.is_admin())',            '((bucket_id = ''photos''::text) AND public.is_admin())'),
        ('Admin uploads documents',        'INSERT', NULL, '((bucket_id = ''documents''::text) AND public.is_admin())'),
        ('Admin uploads photos',           'INSERT', NULL, '((bucket_id = ''photos''::text) AND public.is_admin())'),
        ('Admin uploads site-assets',      'INSERT', NULL, '((bucket_id = ''site-assets''::text) AND public.is_admin())'),
        ('Admin writes finance documents', 'INSERT', NULL, '((bucket_id = ''finance-documents''::text) AND public.is_admin())'),
        ('Admin writes merchant logos',    'INSERT', NULL, '((bucket_id = ''merchant-logos''::text) AND public.is_admin())')
    ) AS e(policyname, cmd, qual, with_check)
    LEFT JOIN pg_catalog.pg_policies p
        ON p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = e.policyname
    WHERE p.policyname IS NULL
       OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
       OR p.cmd IS DISTINCT FROM e.cmd
       OR p.roles IS DISTINCT FROM ARRAY['authenticated']::name[]
       OR p.qual IS DISTINCT FROM e.qual
       OR p.with_check IS DISTINCT FROM e.with_check;

    IF v_mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Refusing to rewrite: these storage.objects policies do not read as expected: %', v_mismatch;
    END IF;
END
$$;

-- finance-documents (private bucket)
ALTER POLICY "Admin reads finance documents" ON storage.objects
    USING (bucket_id = 'finance-documents' AND (SELECT public.is_admin()));

ALTER POLICY "Admin writes finance documents" ON storage.objects
    WITH CHECK (bucket_id = 'finance-documents' AND (SELECT public.is_admin()));

ALTER POLICY "Admin updates finance documents" ON storage.objects
    USING (bucket_id = 'finance-documents' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'finance-documents' AND (SELECT public.is_admin()));

ALTER POLICY "Admin deletes finance documents" ON storage.objects
    USING (bucket_id = 'finance-documents' AND (SELECT public.is_admin()));

-- documents
ALTER POLICY "Admin uploads documents" ON storage.objects
    WITH CHECK (bucket_id = 'documents' AND (SELECT public.is_admin()));

ALTER POLICY "Admin updates documents" ON storage.objects
    USING (bucket_id = 'documents' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'documents' AND (SELECT public.is_admin()));

ALTER POLICY "Admin deletes documents" ON storage.objects
    USING (bucket_id = 'documents' AND (SELECT public.is_admin()));

-- photos
ALTER POLICY "Admin uploads photos" ON storage.objects
    WITH CHECK (bucket_id = 'photos' AND (SELECT public.is_admin()));

ALTER POLICY "Admin updates photos" ON storage.objects
    USING (bucket_id = 'photos' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'photos' AND (SELECT public.is_admin()));

ALTER POLICY "Admin deletes photos" ON storage.objects
    USING (bucket_id = 'photos' AND (SELECT public.is_admin()));

-- merchant-logos
ALTER POLICY "Admin writes merchant logos" ON storage.objects
    WITH CHECK (bucket_id = 'merchant-logos' AND (SELECT public.is_admin()));

ALTER POLICY "Admin updates merchant logos" ON storage.objects
    USING (bucket_id = 'merchant-logos' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'merchant-logos' AND (SELECT public.is_admin()));

ALTER POLICY "Admin deletes merchant logos" ON storage.objects
    USING (bucket_id = 'merchant-logos' AND (SELECT public.is_admin()));

-- site-assets
ALTER POLICY "Admin uploads site-assets" ON storage.objects
    WITH CHECK (bucket_id = 'site-assets' AND (SELECT public.is_admin()));

-- Post-check: each of the 14 now reads exactly
-- '((bucket_id = ''<bucket>''::text) AND ( SELECT public.is_admin() AS is_admin))'
-- in the same clauses as before (NULL stays NULL), with cmd and roles
-- unchanged, and no storage policy still calls is_admin() bare.
DO $$
DECLARE
    v_mismatch text;
    v_bare     text;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.format('%I', e.policyname), ', ')
    INTO v_mismatch
    FROM (VALUES
        ('Admin deletes documents',        'DELETE', 'documents',         true,  false),
        ('Admin deletes finance documents','DELETE', 'finance-documents', true,  false),
        ('Admin deletes merchant logos',   'DELETE', 'merchant-logos',    true,  false),
        ('Admin deletes photos',           'DELETE', 'photos',            true,  false),
        ('Admin reads finance documents',  'SELECT', 'finance-documents', true,  false),
        ('Admin updates documents',        'UPDATE', 'documents',         true,  true),
        ('Admin updates finance documents','UPDATE', 'finance-documents', true,  true),
        ('Admin updates merchant logos',   'UPDATE', 'merchant-logos',    true,  true),
        ('Admin updates photos',           'UPDATE', 'photos',            true,  true),
        ('Admin uploads documents',        'INSERT', 'documents',         false, true),
        ('Admin uploads photos',           'INSERT', 'photos',            false, true),
        ('Admin uploads site-assets',      'INSERT', 'site-assets',       false, true),
        ('Admin writes finance documents', 'INSERT', 'finance-documents', false, true),
        ('Admin writes merchant logos',    'INSERT', 'merchant-logos',    false, true)
    ) AS e(policyname, cmd, bucket, has_using, has_check)
    LEFT JOIN pg_catalog.pg_policies p
        ON p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = e.policyname
    WHERE p.policyname IS NULL
       OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
       OR p.cmd IS DISTINCT FROM e.cmd
       OR p.roles IS DISTINCT FROM ARRAY['authenticated']::name[]
       OR p.qual IS DISTINCT FROM CASE WHEN e.has_using THEN
            pg_catalog.format('((bucket_id = %L::text) AND ( SELECT public.is_admin() AS is_admin))', e.bucket) END
       OR p.with_check IS DISTINCT FROM CASE WHEN e.has_check THEN
            pg_catalog.format('((bucket_id = %L::text) AND ( SELECT public.is_admin() AS is_admin))', e.bucket) END;

    IF v_mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: these storage.objects policies do not read as intended: %', v_mismatch;
    END IF;

    SELECT pg_catalog.string_agg(pg_catalog.format('%I.%I', p.tablename, p.policyname), ', ')
    INTO v_bare
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'storage'
      AND pg_catalog.replace(
              pg_catalog.concat_ws(' ', p.qual, p.with_check),
              '( SELECT public.is_admin() AS is_admin)', ''
          ) LIKE '%is_admin%';

    IF v_bare IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: storage policies still call is_admin() bare: %', v_bare;
    END IF;
END
$$;

COMMIT;
