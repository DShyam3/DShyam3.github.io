-- Additive travel journal migration, copied from the declarative source.
-- CLI declarative sync --no-apply failed on pre-existing 40_finance.sql ordering
-- (finance_sync_log references finance_profiles before creation). No finance
-- objects are changed here. Keep this file and 31_travel_journal.sql in sync.

-- Private-by-default travel journal. Legacy visited-place flags remain independent.
-- UUID identity and same-owner foreign keys make exported relationships portable.
CREATE TABLE public.travel_trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    start_date date CHECK (start_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    end_date date CHECK (end_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
    notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id),
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX travel_trips_owner_idx ON public.travel_trips(owner_id);

CREATE TABLE public.travel_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
    trip_id uuid,
    country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    city_key text NOT NULL CHECK (char_length(btrim(city_key)) BETWEEN 1 AND 200),
    city_name text NOT NULL CHECK (char_length(btrim(city_name)) BETWEEN 1 AND 200),
    start_date date CHECK (start_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    end_date date CHECK (end_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'planned', 'transit')),
    notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id),
    UNIQUE (id, owner_id, trip_id),
    UNIQUE (id, owner_id, country_code, city_key),
    FOREIGN KEY (trip_id, owner_id) REFERENCES public.travel_trips(id, owner_id) ON DELETE RESTRICT,
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX travel_visits_owner_city_idx ON public.travel_visits(owner_id, city_key);
CREATE INDEX travel_visits_trip_idx ON public.travel_visits(trip_id, owner_id);

CREATE TABLE public.travel_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
    trip_id uuid,
    visit_id uuid,
    country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    city_key text NOT NULL CHECK (char_length(btrim(city_key)) BETWEEN 1 AND 200),
    city_name text NOT NULL CHECK (char_length(btrim(city_name)) BETWEEN 1 AND 200),
    kind text NOT NULL CHECK (kind IN ('note', 'favourite', 'photo')),
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
    category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 100),
    link_url text CHECK (char_length(link_url) <= 2048 AND (link_url ~ '^https://[^/[:space:]]+' OR link_url ~ '^/[^/\\[:space:]]') AND link_url !~ '[[:cntrl:]]'),
    photo_path text,
    is_cover boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN -100000 AND 100000),
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id),
    FOREIGN KEY (trip_id, owner_id) REFERENCES public.travel_trips(id, owner_id) ON DELETE RESTRICT,
    FOREIGN KEY (visit_id, owner_id) REFERENCES public.travel_visits(id, owner_id) ON DELETE RESTRICT,
    FOREIGN KEY (visit_id, owner_id, trip_id) REFERENCES public.travel_visits(id, owner_id, trip_id) ON DELETE RESTRICT,
    FOREIGN KEY (visit_id, owner_id, country_code, city_key) REFERENCES public.travel_visits(id, owner_id, country_code, city_key) ON DELETE RESTRICT,
    CHECK ((kind = 'photo') = (photo_path IS NOT NULL)),
    CHECK (photo_path IS NULL OR photo_path ~ ('^' || owner_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')),
    CHECK (NOT is_cover OR kind = 'photo')
);
CREATE INDEX travel_memories_owner_city_idx ON public.travel_memories(owner_id, city_key);
CREATE INDEX travel_memories_trip_idx ON public.travel_memories(trip_id, owner_id);
CREATE INDEX travel_memories_visit_idx ON public.travel_memories(visit_id, owner_id, trip_id, country_code, city_key);
CREATE INDEX travel_memories_visit_city_idx ON public.travel_memories(visit_id, owner_id, country_code, city_key);
CREATE INDEX travel_memories_photo_idx ON public.travel_memories(photo_path) WHERE photo_path IS NOT NULL;

CREATE TABLE public.travel_itinerary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
    trip_id uuid,
    kind text NOT NULL CHECK (kind IN ('flight', 'train', 'stay', 'activity')),
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    start_date date CHECK (start_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    end_date date CHECK (end_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
    start_time text CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    end_time text CHECK (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    time_zone text CHECK (char_length(time_zone) BETWEEN 1 AND 100),
    arrival_time_zone text CHECK (char_length(arrival_time_zone) BETWEEN 1 AND 100),
    origin text CHECK (char_length(origin) <= 200),
    destination text CHECK (char_length(destination) <= 200),
    notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
    source_key text CHECK (char_length(source_key) BETWEEN 1 AND 500),
    source_name text CHECK (char_length(source_name) <= 200),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, owner_id),
    UNIQUE (owner_id, source_key),
    FOREIGN KEY (trip_id, owner_id) REFERENCES public.travel_trips(id, owner_id) ON DELETE RESTRICT,
    CHECK (kind <> 'flight' OR NOT is_public),
    CHECK (kind = 'flight' OR start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX travel_itinerary_trip_idx ON public.travel_itinerary(trip_id, owner_id);

CREATE FUNCTION public.travel_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.travel_touch_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.travel_trips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.travel_trips FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.travel_trips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.travel_trips TO authenticated;
GRANT ALL ON TABLE public.travel_trips TO service_role;
CREATE POLICY "Published trips" ON public.travel_trips FOR SELECT TO anon, authenticated USING (is_public);
CREATE POLICY "Owner reads trips" ON public.travel_trips FOR SELECT TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts trips" ON public.travel_trips FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates trips" ON public.travel_trips FOR UPDATE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid())) WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner deletes trips" ON public.travel_trips FOR DELETE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE TRIGGER travel_trips_updated BEFORE UPDATE ON public.travel_trips FOR EACH ROW EXECUTE FUNCTION public.travel_touch_updated_at();

ALTER TABLE public.travel_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.travel_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.travel_visits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.travel_visits TO authenticated;
GRANT ALL ON TABLE public.travel_visits TO service_role;
CREATE POLICY "Published visits" ON public.travel_visits FOR SELECT TO anon, authenticated USING (is_public AND (trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = travel_visits.trip_id AND t.owner_id = travel_visits.owner_id AND t.is_public)));
CREATE POLICY "Owner reads visits" ON public.travel_visits FOR SELECT TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts visits" ON public.travel_visits FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates visits" ON public.travel_visits FOR UPDATE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid())) WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner deletes visits" ON public.travel_visits FOR DELETE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE TRIGGER travel_visits_updated BEFORE UPDATE ON public.travel_visits FOR EACH ROW EXECUTE FUNCTION public.travel_touch_updated_at();

ALTER TABLE public.travel_memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.travel_memories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.travel_memories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.travel_memories TO authenticated;
GRANT ALL ON TABLE public.travel_memories TO service_role;
CREATE POLICY "Published memories" ON public.travel_memories FOR SELECT TO anon, authenticated USING (is_public AND (trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = travel_memories.trip_id AND t.owner_id = travel_memories.owner_id AND t.is_public)) AND (visit_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_visits v WHERE v.id = travel_memories.visit_id AND v.owner_id = travel_memories.owner_id AND v.is_public AND (v.trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = v.trip_id AND t.owner_id = v.owner_id AND t.is_public)))));
CREATE POLICY "Owner reads memories" ON public.travel_memories FOR SELECT TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts memories" ON public.travel_memories FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates memories" ON public.travel_memories FOR UPDATE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid())) WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner deletes memories" ON public.travel_memories FOR DELETE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE TRIGGER travel_memories_updated BEFORE UPDATE ON public.travel_memories FOR EACH ROW EXECUTE FUNCTION public.travel_touch_updated_at();

ALTER TABLE public.travel_itinerary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.travel_itinerary FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, owner_id, trip_id, kind, title, start_date, end_date, start_time, end_time, time_zone, arrival_time_zone, origin, destination, notes, status, is_public, created_at, updated_at) ON TABLE public.travel_itinerary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.travel_itinerary TO authenticated;
GRANT ALL ON TABLE public.travel_itinerary TO service_role;
CREATE POLICY "Published itinerary" ON public.travel_itinerary FOR SELECT TO anon, authenticated USING (is_public AND (trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = travel_itinerary.trip_id AND t.owner_id = travel_itinerary.owner_id AND t.is_public)));
CREATE POLICY "Owner reads itinerary" ON public.travel_itinerary FOR SELECT TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner inserts itinerary" ON public.travel_itinerary FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner updates itinerary" ON public.travel_itinerary FOR UPDATE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid())) WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE POLICY "Owner deletes itinerary" ON public.travel_itinerary FOR DELETE TO authenticated USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));
CREATE TRIGGER travel_itinerary_updated BEFORE UPDATE ON public.travel_itinerary FOR EACH ROW EXECUTE FUNCTION public.travel_touch_updated_at();

-- Keep originals private; the validation edge function is the only upload path.
-- This data statement is repeated in the migration because schema-diff engines
-- do not capture bucket data.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('travel-photos', 'travel-photos', false, 8388608, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg'];

CREATE POLICY "Travel photo readers" ON storage.objects FOR SELECT TO anon, authenticated USING (
    bucket_id = 'travel-photos' AND (
      ((SELECT public.is_admin()) AND split_part(name, '/', 1) = (SELECT auth.uid())::text)
      OR EXISTS (SELECT 1 FROM public.travel_memories m WHERE m.photo_path = storage.objects.name AND m.kind = 'photo' AND m.is_public
        AND (m.trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = m.trip_id AND t.owner_id = m.owner_id AND t.is_public))
        AND (m.visit_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_visits v WHERE v.id = m.visit_id AND v.owner_id = m.owner_id AND v.is_public
          AND (v.trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = v.trip_id AND t.owner_id = v.owner_id AND t.is_public)))))
    )
);
-- Guard against permissive policies elsewhere accidentally granting broad access.
CREATE POLICY "Travel photo read boundary" ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (
    bucket_id <> 'travel-photos' OR (
      ((SELECT public.is_admin()) AND split_part(name, '/', 1) = (SELECT auth.uid())::text)
      OR EXISTS (SELECT 1 FROM public.travel_memories m WHERE m.photo_path = storage.objects.name AND m.kind = 'photo' AND m.is_public
        AND (m.trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = m.trip_id AND t.owner_id = m.owner_id AND t.is_public))
        AND (m.visit_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_visits v WHERE v.id = m.visit_id AND v.owner_id = m.owner_id AND v.is_public
          AND (v.trip_id IS NULL OR EXISTS (SELECT 1 FROM public.travel_trips t WHERE t.id = v.trip_id AND t.owner_id = v.owner_id AND t.is_public)))))
    )
);
CREATE POLICY "Travel photos server insert only" ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'travel-photos');
CREATE POLICY "Travel photos server update only" ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'travel-photos') WITH CHECK (bucket_id <> 'travel-photos');
CREATE POLICY "Travel photos server delete only" ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'travel-photos');

-- Atomic, insert-only restore. Owner IDs from the file are never trusted.
CREATE FUNCTION public.travel_restore(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    actor uuid := auth.uid();
    section text;
    total integer := 0;
BEGIN
    IF actor IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
    END IF;
    IF payload IS NULL OR jsonb_typeof(payload) <> 'object' OR payload->>'version' IS DISTINCT FROM '1' OR octet_length(payload::text) > 8388608 THEN
        RAISE EXCEPTION 'Invalid travel backup' USING ERRCODE = '22023';
    END IF;
    FOREACH section IN ARRAY ARRAY['trips','visits','memories','itinerary'] LOOP
        IF jsonb_typeof(payload->section) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Invalid travel backup' USING ERRCODE = '22023';
        END IF;
        total := total + jsonb_array_length(payload->section);
    END LOOP;
    IF total > 10000 THEN
        RAISE EXCEPTION 'Travel backup too large' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.travel_trips (id, title, start_date, end_date, status, notes, is_public, owner_id, created_at, updated_at)
    SELECT r.id, r.title, r.start_date, r.end_date, r.status, r.notes, r.is_public, actor, coalesce(r.created_at, now()), coalesce(r.updated_at, now())
    FROM jsonb_populate_recordset(NULL::public.travel_trips, payload->'trips') r;
    INSERT INTO public.travel_visits (id, trip_id, country_code, city_key, city_name, start_date, end_date, status, notes, is_public, owner_id, created_at, updated_at)
    SELECT r.id, r.trip_id, r.country_code, r.city_key, r.city_name, r.start_date, r.end_date, r.status, r.notes, r.is_public, actor, coalesce(r.created_at, now()), coalesce(r.updated_at, now())
    FROM jsonb_populate_recordset(NULL::public.travel_visits, payload->'visits') r;
    INSERT INTO public.travel_memories (id, trip_id, visit_id, country_code, city_key, city_name, kind, title, body, category, link_url, photo_path, is_cover, sort_order, is_public, owner_id, created_at, updated_at)
    SELECT r.id, r.trip_id, r.visit_id, r.country_code, r.city_key, r.city_name, r.kind, r.title, r.body, r.category, r.link_url, r.photo_path, r.is_cover, r.sort_order, r.is_public, actor, coalesce(r.created_at, now()), coalesce(r.updated_at, now())
    FROM jsonb_populate_recordset(NULL::public.travel_memories, payload->'memories') r;
    INSERT INTO public.travel_itinerary (id, trip_id, kind, title, start_date, end_date, start_time, end_time, time_zone, arrival_time_zone, origin, destination, notes, source_key, source_name, status, is_public, owner_id, created_at, updated_at)
    SELECT r.id, r.trip_id, r.kind, r.title, r.start_date, r.end_date, r.start_time, r.end_time, r.time_zone, r.arrival_time_zone, r.origin, r.destination, r.notes, r.source_key, r.source_name, r.status, r.is_public, actor, coalesce(r.created_at, now()), coalesce(r.updated_at, now())
    FROM jsonb_populate_recordset(NULL::public.travel_itinerary, payload->'itinerary') r;
    RETURN jsonb_build_object('trips', jsonb_array_length(payload->'trips'), 'visits', jsonb_array_length(payload->'visits'), 'memories', jsonb_array_length(payload->'memories'), 'itinerary', jsonb_array_length(payload->'itinerary'));
END;
$$;
REVOKE ALL ON FUNCTION public.travel_restore(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.travel_restore(jsonb) TO authenticated;
