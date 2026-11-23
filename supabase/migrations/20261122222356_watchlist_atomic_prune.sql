-- Atomic prune RPCs for watchlist-cron-sync (REHAUL_PLAN item 10(b)).
--
-- Deleting stale TMDB episodes and seasons with a separate SELECT-then-DELETE
-- (or a plain LANGUAGE sql DELETE under READ COMMITTED) leaves a race window
-- where a concurrent watch or rating added before the delete commits can be
-- wiped out (or cascade-deleted with its season). Both functions lock target
-- rows FOR UPDATE in deterministic id order first, then evaluate the DELETE
-- in a fresh post-lock snapshot and return only the ids actually deleted.
--
-- SECURITY INVOKER with an empty search_path; EXECUTE is revoked from PUBLIC,
-- anon, and authenticated and granted only to service_role.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."prune_unowned_tv_episodes"(p_ids integer[])
    RETURNS integer[]
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
DECLARE
  v_deleted integer[];
BEGIN
  PERFORM 1
  FROM public.tv_show_episodes e
  WHERE e.id = ANY (p_ids)
  ORDER BY e.id
  FOR UPDATE;

  WITH deleted AS (
    DELETE FROM public.tv_show_episodes e
    WHERE e.id = ANY (p_ids)
      AND COALESCE(e.watched, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.watchlist_ratings r
        WHERE r.episode_id = e.id
      )
    RETURNING e.id
  )
  SELECT COALESCE(array_agg(deleted.id), ARRAY[]::integer[])
  INTO v_deleted
  FROM deleted;

  RETURN v_deleted;
END;
$$;

ALTER FUNCTION "public"."prune_unowned_tv_episodes"(integer[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."prune_unowned_tv_episodes"(integer[]) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."prune_unowned_tv_episodes"(integer[]) TO "service_role";

CREATE OR REPLACE FUNCTION "public"."prune_unowned_tv_seasons"(p_ids integer[])
    RETURNS integer[]
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path = ''
    AS $$
DECLARE
  v_deleted integer[];
BEGIN
  -- Lock child episodes then parent seasons in id order, matching
  -- tr_update_season_watched's lock order to prevent deadlocks while
  -- serialising against concurrent watches and FK FOR KEY SHARE inserts.
  PERFORM 1
  FROM public.tv_show_episodes e
  WHERE e.season_id = ANY (p_ids)
  ORDER BY e.id
  FOR UPDATE;

  PERFORM 1
  FROM public.tv_show_seasons s
  WHERE s.id = ANY (p_ids)
  ORDER BY s.id
  FOR UPDATE;

  WITH deleted AS (
    DELETE FROM public.tv_show_seasons s
    WHERE s.id = ANY (p_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM public.tv_show_episodes e
        WHERE e.season_id = s.id
          AND e.watched IS TRUE
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.watchlist_ratings r
        WHERE r.season_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.tv_show_episodes e
        JOIN public.watchlist_ratings r ON r.episode_id = e.id
        WHERE e.season_id = s.id
      )
    RETURNING s.id
  )
  SELECT COALESCE(array_agg(deleted.id), ARRAY[]::integer[])
  INTO v_deleted
  FROM deleted;

  RETURN v_deleted;
END;
$$;

ALTER FUNCTION "public"."prune_unowned_tv_seasons"(integer[]) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."prune_unowned_tv_seasons"(integer[]) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."prune_unowned_tv_seasons"(integer[]) TO "service_role";

COMMIT;
