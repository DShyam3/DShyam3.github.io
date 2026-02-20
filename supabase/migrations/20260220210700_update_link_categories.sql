-- Update any existing outdated link categories to the generic 'websites' category
UPDATE public.links 
SET category = 'websites' 
WHERE category NOT IN ('websites', 'iphone-apps', 'ipad-apps', 'mac-apps', 'dev-setup');
