-- Keep membership changes atomic across devices and validate every saved name.
BEGIN;

CREATE OR REPLACE FUNCTION "public"."valid_watchlist_franchise_names"(p_names text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_names) AS candidate(name)
    WHERE candidate.name IS NULL
       OR candidate.name <> pg_catalog.btrim(candidate.name)
       OR pg_catalog.char_length(candidate.name) NOT BETWEEN 1 AND 80
  );
$$;

REVOKE ALL ON FUNCTION "public"."valid_watchlist_franchise_names"(text[]) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."valid_watchlist_franchise_names"(text[]) TO "authenticated", "service_role";

ALTER TABLE "public"."movies"
    ADD CONSTRAINT "movies_additional_franchise_names_check"
    CHECK ("public"."valid_watchlist_franchise_names"("additional_franchises"));

ALTER TABLE "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_additional_franchise_names_check"
    CHECK ("public"."valid_watchlist_franchise_names"("additional_franchises"));

CREATE OR REPLACE FUNCTION "public"."edit_watchlist_franchise_membership"(
  p_media_type text, p_id integer, p_name text, p_add boolean
)
RETURNS text[]
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_name text := pg_catalog.btrim(p_name);
  v_memberships text[];
BEGIN
  IF NOT COALESCE((SELECT public.is_admin()), false) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_id <= 0 OR p_add IS NULL
     OR v_name IS NULL OR pg_catalog.char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid franchise membership' USING ERRCODE = '22023';
  END IF;

  IF p_media_type = 'movie' THEN
    UPDATE public.movies
    SET additional_franchises = CASE
      WHEN p_add AND NOT (v_name = ANY (additional_franchises))
        THEN pg_catalog.array_append(additional_franchises, v_name)
      WHEN NOT p_add THEN pg_catalog.array_remove(additional_franchises, v_name)
      ELSE additional_franchises
    END
    WHERE id = p_id
    RETURNING additional_franchises INTO v_memberships;
  ELSIF p_media_type = 'tv' THEN
    UPDATE public.tv_shows
    SET additional_franchises = CASE
      WHEN p_add AND NOT (v_name = ANY (additional_franchises))
        THEN pg_catalog.array_append(additional_franchises, v_name)
      WHEN NOT p_add THEN pg_catalog.array_remove(additional_franchises, v_name)
      ELSE additional_franchises
    END
    WHERE id = p_id
    RETURNING additional_franchises INTO v_memberships;
  ELSE
    RAISE EXCEPTION 'Invalid media type' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_memberships;
END;
$$;

REVOKE ALL ON FUNCTION "public"."edit_watchlist_franchise_membership"(text, integer, text, boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."edit_watchlist_franchise_membership"(text, integer, text, boolean) TO "authenticated";

COMMIT;
