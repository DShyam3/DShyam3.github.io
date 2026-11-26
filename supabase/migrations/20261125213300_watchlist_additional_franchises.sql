-- A title can belong to several Library Franchises. Keep `franchise` as its
-- primary tag so existing TMDB/Wikidata franchise matching stays unchanged.
-- Both tables already have RLS, public read and admin-only write policies.

BEGIN;

ALTER TABLE "public"."movies"
    ADD COLUMN "additional_franchises" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."tv_shows"
    ADD COLUMN "additional_franchises" text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "public"."movies"
    ADD CONSTRAINT "movies_additional_franchises_check"
    CHECK (cardinality("additional_franchises") <= 20
        AND char_length(array_to_string("additional_franchises", '')) <= 1600
        AND array_position("additional_franchises", NULL) IS NULL);

ALTER TABLE "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_additional_franchises_check"
    CHECK (cardinality("additional_franchises") <= 20
        AND char_length(array_to_string("additional_franchises", '')) <= 1600
        AND array_position("additional_franchises", NULL) IS NULL);

COMMENT ON COLUMN "public"."movies"."additional_franchises" IS
    'Extra owner-chosen Library Franchise groups, alongside the primary franchise.';

COMMENT ON COLUMN "public"."tv_shows"."additional_franchises" IS
    'Extra owner-chosen Library Franchise groups, alongside the primary franchise.';

-- Keep the library publicly readable without granting anon writes or TRUNCATE.
REVOKE ALL ON TABLE "public"."movies" FROM PUBLIC, "anon";
REVOKE ALL ON TABLE "public"."tv_shows" FROM PUBLIC, "anon";
GRANT SELECT ON TABLE "public"."movies" TO "anon";
GRANT SELECT ON TABLE "public"."tv_shows" TO "anon";

COMMIT;
