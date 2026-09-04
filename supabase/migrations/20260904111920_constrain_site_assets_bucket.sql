-- `photos` and `documents` both carry a 50 MB cap and a MIME allowlist;
-- `site-assets` had neither. Writes are admin-only as of
-- secure_storage_object_policies, so this is defence in depth rather than an
-- open hole -- it bounds the damage of a mistaken or compromised admin upload.
--
-- The allowlist covers everything currently in the bucket (application/json for
-- the generated dot-matrix/city map data, plus svg/png/webp/x-icon assets) and
-- the image types likely to be added next.
--
-- Note: image/svg+xml stays allowed because the bucket already serves 3 SVGs.
-- SVG is an XSS vector on a public origin; it is tolerable here only because
-- the bucket is admin-write and the site's CSP does not let a framed or
-- directly-opened asset reach application state.
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'application/json',
      'image/svg+xml',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'font/woff2',
      'font/woff'
    ]
WHERE id = 'site-assets';
