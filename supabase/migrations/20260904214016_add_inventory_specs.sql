-- Homelab boxes are the one inventory category where the hardware inside
-- matters more than the picture of the outside: CPU, RAM, disks, OS. One free
-- text column of "Label: value" lines keeps that with the item instead of in
-- nobody's head. Nullable -- a t-shirt has no specs.
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS specs text;
