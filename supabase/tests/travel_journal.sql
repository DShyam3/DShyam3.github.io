-- Run against an isolated/local migrated database with psql -v ON_ERROR_STOP=1.
-- All fixtures and changes are rolled back. No credentials or real user rows used.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, description text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', description; END IF;
END $$;

INSERT INTO auth.users (id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
INSERT INTO public.admin_users(user_id,email,note) VALUES
 ('10000000-0000-4000-8000-000000000001','travel-owner@example.invalid','transactional test'),
 ('10000000-0000-4000-8000-000000000002','travel-other@example.invalid','transactional test');

INSERT INTO public.travel_trips(id,owner_id,title,is_public) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Private trip',false),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Published trip',true),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Other owner',false);
INSERT INTO public.travel_visits(id,owner_id,trip_id,country_code,city_key,city_name,is_public) VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','PT','PT:38.72,-9.14','Lisbon',true),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','PT','PT:38.72,-9.14','Lisbon',true);
INSERT INTO public.travel_memories(id,owner_id,visit_id,country_code,city_key,city_name,kind,title,is_public) VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','PT','PT:38.72,-9.14','Lisbon','note','Private ancestry',true),
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','PT','PT:38.72,-9.14','Lisbon','note','Published memory',true);

INSERT INTO public.travel_memories(owner_id,trip_id,country_code,city_key,city_name,kind,title,photo_path,is_public) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','PT','PT:38.72,-9.14','Lisbon','photo','Private photo','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001.jpg',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','PT','PT:38.72,-9.14','Lisbon','photo','Published photo','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000002.jpg',true);
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('travel-photos','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001.jpg'),
 ('travel-photos','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000002.jpg');

SET LOCAL ROLE anon;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='travel-photos' AND name LIKE '10000000-%'), 'anonymous sees only published photo with published ancestry');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_trips WHERE id::text LIKE '20000000-%'), 'anonymous trip visibility');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_visits WHERE id::text LIKE '30000000-%'), 'private trip hides published child visit');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_memories WHERE id::text LIKE '40000000-%'), 'private grandparent hides published memory');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.travel_trips','TRUNCATE'), 'anon cannot truncate');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.travel_restore(jsonb)','EXECUTE'), 'anon cannot restore');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_trips WHERE id::text LIKE '20000000-%'), 'nonadmin only sees published trips');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.travel_trips(title) VALUES ('Nonadmin write');
    RAISE EXCEPTION 'Nonadmin write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.travel_trips WHERE id::text LIKE '20000000-%'), 'owner sees own private, not other owner private');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM storage.objects WHERE bucket_id='travel-photos' AND name LIKE '10000000-%'), 'owner reads own private photos');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.travel_memories WHERE id::text LIKE '40000000-%'), 'owner sees own private memories');
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name) VALUES ('travel-photos','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000003.jpg');
    RAISE EXCEPTION 'Browser direct upload unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.travel_visits(trip_id,country_code,city_key,city_name)
    VALUES ('20000000-0000-4000-8000-000000000003','PT','PT:38.72,-9.14','Lisbon');
    RAISE EXCEPTION 'Cross-owner trip unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.travel_memories(trip_id,visit_id,country_code,city_key,city_name,kind,title)
    VALUES ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','PT','PT:38.72,-9.14','Lisbon','note','Wrong trip');
    RAISE EXCEPTION 'Mismatched trip unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.travel_trips(title,start_date,end_date) VALUES ('Bad dates','2026-11-10','2026-11-09');
    RAISE EXCEPTION 'Reversed dates unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.travel_itinerary(kind,title,is_public) VALUES ('flight','Private flight',true);
    RAISE EXCEPTION 'Public flight unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.travel_memories(country_code,city_key,city_name,kind,title,link_url)
    VALUES ('PT','PT:38.72,-9.14','Lisbon','favourite','Unsafe URL','javascript:alert(1)');
    RAISE EXCEPTION 'Unsafe URL unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.travel_trips SET owner_id='10000000-0000-4000-8000-000000000002' WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Owner reassignment unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.travel_trips WHERE id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Dependent trip deletion unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;

-- Local arrival can be the previous calendar day across the date line.
INSERT INTO public.travel_itinerary(kind,title,start_date,end_date,time_zone,arrival_time_zone) VALUES ('flight','Date-line crossing','2026-11-10','2026-11-09','Pacific/Auckland','Pacific/Honolulu');

INSERT INTO public.travel_itinerary(kind,title,source_key) VALUES ('flight','LHR to LIS','test:flight:1');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.travel_itinerary(kind,title,source_key) VALUES ('flight','Duplicate','test:flight:1');
    RAISE EXCEPTION 'Duplicate import unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

SELECT public.travel_restore('{"version":1,"trips":[{"id":"20000000-0000-4000-8000-000000000004","owner_id":"10000000-0000-4000-8000-000000000002","title":"Restored","status":"completed","notes":"","is_public":false}],"visits":[],"memories":[],"itinerary":[]}'::jsonb);
SELECT pg_temp.assert_true((SELECT owner_id='10000000-0000-4000-8000-000000000001' FROM public.travel_trips WHERE id='20000000-0000-4000-8000-000000000004'), 'restore binds current owner');
DO $$ BEGIN
  BEGIN
    PERFORM public.travel_restore('{"version":1,"trips":[{"id":"20000000-0000-4000-8000-000000000004","title":"Collision","status":"completed","notes":"","is_public":false}],"visits":[],"memories":[],"itinerary":[]}'::jsonb);
    RAISE EXCEPTION 'Existing ID restore unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.travel_restore('{"version":1,"trips":[{"id":"20000000-0000-4000-8000-000000000005","title":"Rolled back","status":"completed","notes":"","is_public":false}],"visits":[{"id":"30000000-0000-4000-8000-000000000005","country_code":"INVALID","city_key":"test","city_name":"Test","status":"confirmed","notes":"","is_public":false}],"memories":[],"itinerary":[]}'::jsonb);
    RAISE EXCEPTION 'Malformed restore unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.travel_trips WHERE id='20000000-0000-4000-8000-000000000005'), 'restore rolls back all sections on failure');

-- City covers are exclusive on insert, update and move, including direct writes.
INSERT INTO public.travel_memories(id,country_code,city_key,city_name,kind,title,photo_path,is_cover,sort_order) VALUES
 ('40000000-0000-4000-8000-000000000011','JP','JP:test-cover','Tokyo','photo','First cover','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000011.jpg',true,0),
 ('40000000-0000-4000-8000-000000000012','JP','JP:test-cover','Tokyo','photo','Second cover','10000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000012.jpg',true,1000000);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_memories WHERE city_key='JP:test-cover' AND is_cover), 'insert chooses one city cover');
SELECT pg_temp.assert_true((SELECT is_cover FROM public.travel_memories WHERE id='40000000-0000-4000-8000-000000000012'), 'new cover replaces old cover');
UPDATE public.travel_memories SET is_cover=true WHERE id='40000000-0000-4000-8000-000000000011';
SELECT pg_temp.assert_true((SELECT NOT is_cover FROM public.travel_memories WHERE id='40000000-0000-4000-8000-000000000012'), 'updating cover clears previous selection');
UPDATE public.travel_memories SET city_key='JP:other-cover' WHERE id='40000000-0000-4000-8000-000000000011';
UPDATE public.travel_memories SET is_cover=true WHERE id='40000000-0000-4000-8000-000000000012';
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.travel_memories WHERE city_key IN ('JP:test-cover','JP:other-cover') AND is_cover), 'different cities retain independent covers');
UPDATE public.travel_memories SET city_key='JP:test-cover' WHERE id='40000000-0000-4000-8000-000000000011';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.travel_memories WHERE city_key='JP:test-cover' AND is_cover), 'moving cover clears destination cover');
DO $$ BEGIN
  BEGIN
    UPDATE public.travel_memories SET sort_order=-1 WHERE id='40000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'Negative order unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.travel_memories SET sort_order=1000001 WHERE id='40000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'Excessive order unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- Unpublishing a trip immediately hides its linked journal metadata.
UPDATE public.travel_trips SET is_public=false WHERE id='20000000-0000-4000-8000-000000000002';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.travel_memories WHERE id='40000000-0000-4000-8000-000000000002'), 'unpublishing parent hides memory');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='travel-photos' AND name LIKE '10000000-%'), 'unpublishing parent hides photo objects');
RESET ROLE;
SELECT pg_temp.assert_true(NOT has_column_privilege('anon', 'public.travel_itinerary', 'source_key', 'SELECT') AND NOT has_column_privilege('anon', 'public.travel_itinerary', 'source_name', 'SELECT') AND has_column_privilege('anon', 'public.travel_itinerary', 'title', 'SELECT'), 'anon cannot read itinerary source columns but can read title');
ROLLBACK;
