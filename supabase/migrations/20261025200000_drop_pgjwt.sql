-- Drop the pgjwt extension.
--
-- Why: it is unused, and Supabase deprecates it on Postgres 17, so it blocks
-- the 15 -> 17 upgrade. No function in public references sign, verify or
-- url_encode (verified on hosted), and nothing else in the repo does either.
-- Supabase issues its JWTs itself, in GoTrue, not in the database.
--
-- Deliberately no CASCADE: if anything did depend on the extension, DROP
-- EXTENSION refuses and names it, which rolls the migration back instead of
-- silently dropping the dependent object.
--
-- supabase/schemas/00_extensions.sql no longer declares it. The baseline
-- (20260904130000_baseline.sql) still creates it on Postgres 15, and this
-- migration removes it after. On 17 the image has no pgjwt at all, so the
-- baseline's CREATE is wrapped in an availability check, edited in after the
-- baseline was applied, or a from-empty replay would stop there.
BEGIN;

DROP EXTENSION IF EXISTS "pgjwt";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pgjwt') THEN
        RAISE EXCEPTION 'Post-check failed: pgjwt is still installed';
    END IF;
END
$$;

COMMIT;
