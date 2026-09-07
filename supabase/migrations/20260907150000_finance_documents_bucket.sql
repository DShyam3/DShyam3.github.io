-- A private bucket for financial documents.
--
-- The existing `documents` bucket is public = true and holds one file, the CV,
-- which is meant to be downloadable. Payslips, bank statements and credit
-- reports must not go anywhere near it: a payslip carries salary, National
-- Insurance number and address, and a world-readable URL for one is a data
-- breach whether or not anybody guesses the path (REHAUL_PLAN.md 7.E).
--
-- So a second bucket rather than a change to the first. Private, admin-only on
-- read as well as write, reached through signed URLs.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('finance-documents', 'finance-documents', false, 52428800,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- SELECT is gated too. On a private bucket an unguarded read policy is the
-- same exposure as a public bucket, just less obvious.
DROP POLICY IF EXISTS "Admin reads finance documents" ON storage.objects;
CREATE POLICY "Admin reads finance documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'finance-documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admin writes finance documents" ON storage.objects;
CREATE POLICY "Admin writes finance documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'finance-documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admin updates finance documents" ON storage.objects;
CREATE POLICY "Admin updates finance documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'finance-documents' AND public.is_admin())
    WITH CHECK (bucket_id = 'finance-documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admin deletes finance documents" ON storage.objects;
CREATE POLICY "Admin deletes finance documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'finance-documents' AND public.is_admin());

COMMIT;
