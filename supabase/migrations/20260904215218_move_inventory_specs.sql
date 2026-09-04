-- The homelab build lists were written into `description` before there was a
-- specs column to hold them: bulleted "Label: [part](url) (£price)" lines, which
-- is exactly what specs is for. Move them across where nothing has been written
-- into specs yet, and only where the description really is such a list -- every
-- non-empty line bulleted -- so ordinary prose is left alone.
UPDATE public.inventory_items
SET specs = description,
    description = NULL
WHERE specs IS NULL
  AND description IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(string_to_array(description, E'\n')) AS line
    WHERE btrim(line) <> '' AND btrim(line) !~ '^[-*•]\s'
  );
