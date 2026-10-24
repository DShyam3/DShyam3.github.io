-- Stop the merchant-logos and site-assets buckets accepting SVG uploads.
--
-- Why: both buckets are public, so whatever sits in them is served from our
-- own storage origin to anyone holding the URL. An SVG is a document, not just
-- an image: it can carry <script>, event handlers and foreignObject, and a
-- browser that navigates straight to the URL runs them. Neither bucket needs
-- the type. merchant-logos has one writer, the merchant-logo-cache function,
-- which already refuses SVG by magic bytes (the logos it stores are PNG, JPEG
-- or WebP); site-assets has no in-app writer at all. Security audit
-- 2026-10-24, finding 14b.
--
-- What changes: 'image/svg+xml' is removed from storage.buckets.allowed_mime_types
-- for these two buckets, with array_remove, so every other entry is kept exactly
-- as it is. Read on hosted on 2026-10-24:
--   - merchant-logos: {image/png, image/jpeg, image/webp, image/svg+xml}, set
--     by 20260907170100_merchant_logo_cache.sql; 21 objects, none SVG.
--   - site-assets: {application/json, image/svg+xml, image/png, image/jpeg,
--     image/webp, image/gif, image/x-icon, image/vnd.microsoft.icon,
--     font/woff2, font/woff}, set by 20260904130000_baseline.sql; 11 objects,
--     3 of them SVG (github.svg, gmail.svg, linkedin.svg), referenced nowhere
--     in src/.
--
-- What stays:
--   - allowed_mime_types gates NEW uploads only. Existing objects are not
--     touched and keep serving, so the three site-assets SVGs still load. They
--     are inert as far as the app goes (nothing references them) but they are
--     still SVG on a public origin; deleting them is a separate, deliberate
--     step and is not done here.
--   - No policy, grant, file_size_limit or public flag changes. The storage
--     write policies still gate who may upload at all; this narrows what.
--
-- Re-runnable: array_remove of an entry that is absent changes nothing, and the
-- UPDATE only touches a row that still lists SVG, so a second run writes no
-- rows. The post-check holds on every run.
--
-- Fails closed: the post-check raises, rolling the transaction back, if either
-- bucket is missing or still admits SVG. "Admits" is read the way storage-api
-- reads it, so it also catches a NULL or empty list (no restriction at all) and
-- a wildcard entry such as 'image/*' or '*/*', none of which array_remove can
-- touch and all of which would let SVG through.
--
-- Buckets are not described under supabase/schemas/ (they live outside the
-- public schema and are created by migrations), so there is no schema-file edit.

BEGIN;

SET LOCAL lock_timeout = '5s';
-- Pinning the search_path makes every name below resolve to a fixed object.
SET LOCAL search_path = '';

UPDATE storage.buckets b
SET allowed_mime_types = pg_catalog.array_remove(b.allowed_mime_types, 'image/svg+xml')
WHERE b.id IN ('merchant-logos', 'site-assets')
  AND 'image/svg+xml' = ANY (b.allowed_mime_types);

-- Post-check: both buckets exist, each has a real allowlist, and nothing in it
-- matches image/svg+xml, whether by name or by wildcard.
DO $$
DECLARE
    v_bucket text;
    v_types  text[];
    v_match  text;
BEGIN
    FOREACH v_bucket IN ARRAY ARRAY['merchant-logos', 'site-assets'] LOOP
        SELECT b.allowed_mime_types
        INTO v_types
        FROM storage.buckets b
        WHERE b.id = v_bucket;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Post-check failed: bucket % does not exist', v_bucket;
        END IF;

        -- NULL or empty means "any type", which includes SVG.
        IF v_types IS NULL OR pg_catalog.cardinality(v_types) = 0 THEN
            RAISE EXCEPTION 'Post-check failed: bucket % has no MIME allowlist, so it accepts SVG', v_bucket;
        END IF;

        SELECT pg_catalog.string_agg(t.entry, ', ' ORDER BY t.entry)
        INTO v_match
        FROM pg_catalog.unnest(v_types) AS t(entry)
        WHERE pg_catalog.lower(t.entry) = 'image/svg+xml'
           OR t.entry IN ('*', '*/*')
           OR (t.entry LIKE '%/*'
               AND pg_catalog.starts_with('image/svg+xml', pg_catalog.left(t.entry, -1)));

        IF v_match IS NOT NULL THEN
            RAISE EXCEPTION 'Post-check failed: bucket % still allows SVG through: %', v_bucket, v_match;
        END IF;
    END LOOP;
END
$$;

COMMIT;
