-- Split TECH + EDC:
-- 1. Add EDC columns to inventory_items so items across any category can be inherited into EDC.
-- 2. Update category default and existing rows from 'tech-edc' to 'tech'.
-- 3. Pre-seed initial EDC carry tags for existing carry items.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS is_edc boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS edc_slot text DEFAULT 'pockets',
  ADD COLUMN IF NOT EXISTS edc_order integer DEFAULT 0;

-- Update column default from 'tech-edc' to 'tech'
ALTER TABLE public.inventory_items
  ALTER COLUMN category SET DEFAULT 'tech';

-- Migrate existing rows
UPDATE public.inventory_items
SET category = 'tech'
WHERE category = 'tech-edc';

-- Pre-seed known EDC items
UPDATE public.inventory_items
SET is_edc = true, edc_slot = 'pockets', edc_order = 1
WHERE name ILIKE '%wallet%';

UPDATE public.inventory_items
SET is_edc = true, edc_slot = 'pockets', edc_order = 2
WHERE name ILIKE '%jotter%' OR name ILIKE '%fn pen%' OR name ILIKE '%knife%' OR name ILIKE '%infinity tool%';

UPDATE public.inventory_items
SET is_edc = true, edc_slot = 'keychain', edc_order = 1
WHERE name ILIKE '%mag-reel%' OR name ILIKE '%keychain organiser%' OR name ILIKE '%heroclip%' OR name ILIKE '%yubikey%' OR name ILIKE '%airtag%' OR name ILIKE '%keychain usb4%';

UPDATE public.inventory_items
SET is_edc = true, edc_slot = 'bag', edc_order = 1
WHERE name ILIKE '%go pack 2%' OR name ILIKE '%chute mag%' OR name ILIKE '%100w usb-c charger%' OR name ILIKE '%nano charger%' OR name ILIKE '%laptop power bank%' OR name ILIKE '%magsafe portable charger%';
