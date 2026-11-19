-- Store TMDB classification facts on library titles. Existing rows remain
-- unknown until a TMDB detail refresh supplies the facts.
ALTER TABLE "public"."movies"
    ADD COLUMN IF NOT EXISTS "original_language" "text",
    ADD COLUMN IF NOT EXISTS "origin_country" "text"[],
    ADD COLUMN IF NOT EXISTS "genre_ids" integer[];

ALTER TABLE "public"."tv_shows"
    ADD COLUMN IF NOT EXISTS "original_language" "text",
    ADD COLUMN IF NOT EXISTS "origin_country" "text"[],
    ADD COLUMN IF NOT EXISTS "genre_ids" integer[];
