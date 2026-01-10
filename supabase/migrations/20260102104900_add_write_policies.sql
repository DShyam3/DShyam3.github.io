-- Add INSERT, UPDATE, DELETE policies for beliefs (renamed from quotes)
CREATE POLICY "Anyone can insert beliefs" ON public.beliefs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update beliefs" ON public.beliefs
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete beliefs" ON public.beliefs
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for books
CREATE POLICY "Anyone can insert books" ON public.books
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update books" ON public.books
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete books" ON public.books
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for creators
CREATE POLICY "Anyone can insert creators" ON public.creators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update creators" ON public.creators
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete creators" ON public.creators
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for inspirations
CREATE POLICY "Anyone can insert inspirations" ON public.inspirations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update inspirations" ON public.inspirations
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete inspirations" ON public.inspirations
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for photos
CREATE POLICY "Anyone can insert photos" ON public.photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update photos" ON public.photos
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete photos" ON public.photos
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for articles
CREATE POLICY "Anyone can insert articles" ON public.articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update articles" ON public.articles
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete articles" ON public.articles
  FOR DELETE USING (true);

-- Add INSERT, UPDATE, DELETE policies for recipes
CREATE POLICY "Anyone can insert recipes" ON public.recipes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update recipes" ON public.recipes
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete recipes" ON public.recipes
  FOR DELETE USING (true);
