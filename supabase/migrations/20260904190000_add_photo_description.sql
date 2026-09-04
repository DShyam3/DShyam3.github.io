-- A caption names the photo; a description is the paragraph behind it -- what
-- was happening, why it was worth taking. Only shown in the dialog, so it is
-- nullable and most rows will leave it empty.
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS description text;
