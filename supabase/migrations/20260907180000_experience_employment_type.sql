-- Experience rows gain an employment_type, so a contract or an internship no
-- longer reads as a permanent role. The column is the existing `metadata`
-- jsonb, so this is a data migration only -- no schema change.
--
-- Matched on the company name held in metadata, which is unique per row today.
-- Rows that already carry an employment_type are left alone.

UPDATE public.site_content
SET metadata = metadata || jsonb_build_object('employment_type', v.employment_type)
FROM (
  VALUES
    ('Ocean Infinity', 'Full-time'),
    ('Airbus Defence and Space', 'Contract'),
    ('Lodestar Space', 'Internship'),
    ('Keysight Technologies', 'Internship')
) AS v(company, employment_type)
WHERE site_content.section = 'experience'
  AND site_content.metadata->>'company' = v.company
  AND COALESCE(site_content.metadata->>'employment_type', '') = '';
