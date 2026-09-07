-- Cached merchant logos: a public bucket, plus the index that says what is in
-- it (route C of the logo work).
--
-- The tempting version of this feature hotlinks a logo CDN from the browser:
-- `<img src="logo.example/tesco.com">`. That hands a third party a live feed
-- of where this user shops, with their IP and a referrer, one request per
-- rendered row. Spend history is exactly what the AI projection rules say
-- never leaves the allowlist, and a logo is not worth leaking it.
--
-- So the fetch happens once, server-side, in the merchant-logo-cache function,
-- against a domain allowlist that lives in that function and nowhere else.
-- The result is stored here and served from our own origin. A third party
-- learns "somebody once asked about Tesco" and nothing about anybody.
--
-- The bucket is public because a supermarket's logo is public, and a signed
-- URL per row would defeat the caching this exists for. Nothing user-specific
-- is stored in it: the object key is a merchant slug, never a profile or a
-- transaction id.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('merchant-logos', 'merchant-logos', true, 262144,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read is open, the same as every other public bucket here. Write is not:
-- an unguarded write policy on a public bucket is an open image host.
DROP POLICY IF EXISTS "Public reads merchant logos" ON storage.objects;
CREATE POLICY "Public reads merchant logos" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'merchant-logos');

DROP POLICY IF EXISTS "Admin writes merchant logos" ON storage.objects;
CREATE POLICY "Admin writes merchant logos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'merchant-logos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin updates merchant logos" ON storage.objects;
CREATE POLICY "Admin updates merchant logos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'merchant-logos' AND public.is_admin())
    WITH CHECK (bucket_id = 'merchant-logos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin deletes merchant logos" ON storage.objects;
CREATE POLICY "Admin deletes merchant logos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'merchant-logos' AND public.is_admin());

-- The index. Without it the client would have to guess an object path and
-- eat a 404 for every merchant that has no logo -- which is most of the long
-- tail, on every render. A row here means "this slug has a logo, at this
-- path"; no row means fall through to the monogram.
--
-- `resolved_at` with a NULL `storage_path` records a miss, so the function
-- does not retry a merchant that has no findable logo on every run.
CREATE TABLE IF NOT EXISTS "public"."finance_merchant_logos" (
    "slug" "text" NOT NULL,
    "storage_path" "text",
    "source_domain" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_merchant_logos_pkey" PRIMARY KEY ("slug")
);

ALTER TABLE "public"."finance_merchant_logos" OWNER TO "postgres";

COMMENT ON TABLE "public"."finance_merchant_logos" IS
  'Index of cached merchant logos in the merchant-logos bucket. A row with a '
  'NULL storage_path is a recorded miss, so the resolver stops re-fetching a '
  'merchant whose logo could not be found.';

ALTER TABLE "public"."finance_merchant_logos" ENABLE ROW LEVEL SECURITY;

-- Read is public to match the bucket: the table says nothing about anybody,
-- only which brands have a cached mark.
DROP POLICY IF EXISTS "Public reads merchant logo index" ON "public"."finance_merchant_logos";
CREATE POLICY "Public reads merchant logo index" ON "public"."finance_merchant_logos"
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admin writes merchant logo index" ON "public"."finance_merchant_logos";
CREATE POLICY "Admin writes merchant logo index" ON "public"."finance_merchant_logos"
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON "public"."finance_merchant_logos" FROM "anon";
GRANT SELECT ON "public"."finance_merchant_logos" TO "anon", "authenticated";

COMMIT;
