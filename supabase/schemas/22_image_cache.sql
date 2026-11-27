-- Cached card images: a public bucket, plus the index that says what is in it.
--
-- Inventory product shots and Links logos were hotlinked from retailer CDNs.
-- They break (404), and their white backgrounds clash with the dark theme.
-- So the owner's browser fetches each card image once, removes a uniform
-- light background deterministically (canvas, no model), trims it, encodes
-- WebP, and stores it here. The index maps a source URL to the stored copy and
-- records failed attempts so they are not retried on every visit.
--
-- Nothing user-specific is stored: object keys are a SHA-256 of the public
-- source URL. SVG is excluded from the bucket on purpose; see
-- 20261024170000_storage_buckets_no_svg.sql.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('item-images', 'item-images', true, 1048576, ARRAY['image/webp', 'image/png'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No public SELECT policy: a public bucket serves its objects by URL without
-- consulting one, and a SELECT policy for everyone would only let anyone
-- list the bucket (see 20261024140000_merchant_logo_index_admin_only.sql).
-- The owner needs SELECT for an upload with upsert. Write is admin-only: an
-- unguarded write policy on a public bucket is an open image host.
DROP POLICY IF EXISTS "Public reads item images" ON storage.objects;
DROP POLICY IF EXISTS "Admin reads item images" ON storage.objects;
CREATE POLICY "Admin reads item images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'item-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin writes item images" ON storage.objects;
CREATE POLICY "Admin writes item images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'item-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin updates item images" ON storage.objects;
CREATE POLICY "Admin updates item images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'item-images' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'item-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin deletes item images" ON storage.objects;
CREATE POLICY "Admin deletes item images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'item-images' AND (SELECT public.is_admin()));

-- The index. `source_hash` is the primary key because a source URL can be a
-- multi-kilobyte data: URI; the URL itself is kept for display and debugging.
-- A row with a NULL `storage_path` and a `failure` records an attempt that
-- did not work, so a card is not retried on every visit.
CREATE TABLE IF NOT EXISTS "public"."image_cache" (
    "source_hash" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "storage_path" "text",
    "transparent" boolean DEFAULT false NOT NULL,
    "tone" "text",
    "backdrop" "text",
    "width" integer,
    "height" integer,
    "keep_background" boolean DEFAULT false NOT NULL,
    "failure" "text",
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "image_cache_pkey" PRIMARY KEY ("source_hash"),
    CONSTRAINT "image_cache_source_hash_check" CHECK ("source_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "image_cache_source_url_check" CHECK (char_length("source_url") BETWEEN 1 AND 16384),
    CONSTRAINT "image_cache_storage_path_check" CHECK ("storage_path" ~ '^[0-9a-f]{64}-[a-z0-9-]{1,24}\.(webp|png)$'),
    CONSTRAINT "image_cache_tone_check" CHECK ("tone" IN ('dark', 'light', 'color')),
    CONSTRAINT "image_cache_backdrop_check" CHECK ("backdrop" ~ '^#[0-9a-f]{6}$'),
    CONSTRAINT "image_cache_width_check" CHECK ("width" IS NULL OR "width" > 0),
    CONSTRAINT "image_cache_height_check" CHECK ("height" IS NULL OR "height" > 0),
    CONSTRAINT "image_cache_failure_check" CHECK ("failure" IN ('unreachable', 'not_image', 'undecodable', 'too_large')),
    CONSTRAINT "image_cache_outcome" CHECK (("storage_path" IS NULL) <> ("failure" IS NULL))
);

ALTER TABLE "public"."image_cache" OWNER TO "postgres";

COMMENT ON TABLE "public"."image_cache" IS
  'Index of cleaned card images in the item-images bucket, keyed by the SHA-256 of the public source URL. A row with a NULL storage_path is a recorded failure, so a card is not retried on every visit.';
COMMENT ON COLUMN "public"."image_cache"."source_hash" IS
  'Lowercase hex SHA-256 of source_url. The key, because source_url can be a long data: URI.';
COMMENT ON COLUMN "public"."image_cache"."storage_path" IS
  'Object name inside the item-images bucket. NULL means a recorded failure.';
COMMENT ON COLUMN "public"."image_cache"."transparent" IS
  'The stored copy has a transparent background: removed, or the source already had one.';
COMMENT ON COLUMN "public"."image_cache"."tone" IS
  'Colour of the opaque pixels (dark, light or color), so a monochrome logo can be inverted to stay visible on the opposite theme.';

COMMENT ON COLUMN "public"."image_cache"."backdrop" IS
    'The studio background''s colour (#rrggbb), removed or not. A copy kept '
    'whole -- a white product on white, which no flood fill can separate -- is '
    'shown on a plate of this colour, so its background runs to the tile''s edge.';
COMMENT ON COLUMN "public"."image_cache"."keep_background" IS
  'Owner override: store the image without removing its background.';
COMMENT ON COLUMN "public"."image_cache"."failure" IS
  'Why no copy was stored: unreachable, not_image, undecodable or too_large. NULL when storage_path is set.';

ALTER TABLE "public"."image_cache" ENABLE ROW LEVEL SECURITY;

-- Read is public to match the bucket: the images it indexes are already
-- public on the site.
DROP POLICY IF EXISTS "Public reads image cache" ON "public"."image_cache";
CREATE POLICY "Public reads image cache" ON "public"."image_cache"
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admin inserts image cache" ON "public"."image_cache";
CREATE POLICY "Admin inserts image cache" ON "public"."image_cache"
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin updates image cache" ON "public"."image_cache";
CREATE POLICY "Admin updates image cache" ON "public"."image_cache"
    FOR UPDATE TO authenticated
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admin deletes image cache" ON "public"."image_cache";
CREATE POLICY "Admin deletes image cache" ON "public"."image_cache"
    FOR DELETE TO authenticated
    USING ((SELECT public.is_admin()));

-- Grants
REVOKE ALL ON TABLE "public"."image_cache" FROM "anon";
GRANT SELECT ON TABLE "public"."image_cache" TO "anon";
REVOKE ALL ON TABLE "public"."image_cache" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."image_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."image_cache" TO "service_role";
