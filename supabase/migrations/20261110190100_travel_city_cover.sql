-- Follow-up to travel_journal. No live database was changed during authoring.
ALTER TABLE public.travel_memories DROP CONSTRAINT travel_memories_sort_order_check;
ALTER TABLE public.travel_memories ADD CONSTRAINT travel_memories_sort_order_check CHECK (sort_order BETWEEN 0 AND 1000000);

-- A pre-existing city with several chosen covers retains its latest selection.
WITH covers AS (
  SELECT id, row_number() OVER (PARTITION BY owner_id, city_key ORDER BY updated_at DESC, created_at DESC, id DESC) AS position
  FROM public.travel_memories WHERE is_cover
)
UPDATE public.travel_memories SET is_cover = false FROM covers
WHERE public.travel_memories.id = covers.id AND covers.position > 1;

-- All writers, including restore and direct table writes, switch a city's
-- cover atomically. Invoker rights preserve owner/admin RLS. The unique index
-- is the final guard if concurrent updates arrive with older MVCC snapshots.
CREATE FUNCTION public.travel_choose_city_cover() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF NEW.is_cover THEN
        PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.owner_id::text || ':' || NEW.city_key, 0));
        UPDATE public.travel_memories
        SET is_cover = false
        WHERE owner_id = NEW.owner_id AND city_key = NEW.city_key
          AND is_cover AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.travel_choose_city_cover() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER travel_memories_cover BEFORE INSERT OR UPDATE OF is_cover, city_key, owner_id
ON public.travel_memories FOR EACH ROW EXECUTE FUNCTION public.travel_choose_city_cover();
CREATE UNIQUE INDEX travel_memories_city_cover_key ON public.travel_memories(owner_id, city_key) WHERE is_cover;
