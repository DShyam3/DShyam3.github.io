-- Photos gain a photographer credit. Most are the site owner's own, so this
-- is nullable and only shown when set.
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS photographer text;

-- `thoughts` is a small blog: longer-form writing that does not fit the
-- one-line shape of `beliefs`, sitting next to it in the nav.
--
-- Column layout follows the other content tables so it drops straight into
-- the collection system: a title, a body, an optional image, a category to
-- filter on, and created_at for ordering.
CREATE TABLE IF NOT EXISTS public.thoughts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text,
    image_url text,
    category text DEFAULT 'essay'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.thoughts OWNER TO postgres;

ALTER TABLE ONLY public.thoughts
    ADD CONSTRAINT thoughts_pkey PRIMARY KEY (id);

ALTER TABLE public.thoughts ENABLE ROW LEVEL SECURITY;

-- Same shape as every other content table: anonymous read, admin write, and
-- the write policies split by command so they do not overlap the read policy
-- (see 20260904111745).
CREATE POLICY "Public Read Access" ON public.thoughts FOR SELECT USING (true);

CREATE POLICY "Admin insert" ON public.thoughts
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admin update" ON public.thoughts
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete" ON public.thoughts
    FOR DELETE TO authenticated USING (public.is_admin());

-- Supabase's default grants for the public schema, matching the other tables.
GRANT ALL ON TABLE public.thoughts TO anon;
GRANT ALL ON TABLE public.thoughts TO authenticated;
GRANT ALL ON TABLE public.thoughts TO service_role;
