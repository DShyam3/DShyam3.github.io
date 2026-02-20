-- Add is_wishlist to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN is_wishlist BOOLEAN DEFAULT false;
UPDATE public.inventory_items SET is_wishlist = true, category = 'tech-edc' WHERE category = 'wishlist';
