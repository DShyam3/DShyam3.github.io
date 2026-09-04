-- Storage object policies were left gated on the `authenticated` role, the same
-- bug already fixed for the public tables in the 20260724_* migrations.
-- Email signup is enabled on this project, so any self-registered user could
-- upload to `site-assets`, and upload/update/delete objects in `photos` and
-- `documents`. All three buckets are public-read, so that meant defacement,
-- deletion of the CV and photos, and free file hosting on the project origin.
--
-- Only the site admin writes to storage; readers stay anonymous.

-- site-assets: upload restricted to admin (there is no update/delete policy).
DROP POLICY IF EXISTS "Authenticated Uploads" ON storage.objects;
CREATE POLICY "Admin uploads site-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

-- photos
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Admin uploads photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
CREATE POLICY "Admin updates photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
CREATE POLICY "Admin deletes photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin());

-- documents
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Admin uploads documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
CREATE POLICY "Admin updates documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
CREATE POLICY "Admin deletes documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());

-- Public read stays as-is: "Public Access", "Public photo access" and
-- "Public document access" keep serving these buckets to anonymous visitors.

-- Hardening from the Supabase security linter: pin the search_path on the two
-- watchlist trigger functions so they cannot resolve objects from a
-- caller-controlled schema.
ALTER FUNCTION public.update_episodes_watched_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_season_watched_status() SET search_path = public, pg_temp;
