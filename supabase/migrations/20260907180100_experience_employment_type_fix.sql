-- Follow-up to 20260907180000. That migration matched the company name
-- case-sensitively in title case; the rows actually store it upper case
-- ('OCEAN INFINITY'), so every row missed and the update was a silent no-op.
--
-- Same intent, matched case-insensitively. Rows that already carry an
-- employment_type are still left alone, so this is safe to re-run.

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
  AND upper(site_content.metadata->>'company') = upper(v.company)
  AND COALESCE(site_content.metadata->>'employment_type', '') = '';
