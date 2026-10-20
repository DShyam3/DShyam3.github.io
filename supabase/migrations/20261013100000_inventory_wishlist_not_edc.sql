-- A row can never be both wishlist and EDC. A wishlist item is not owned, so it
-- cannot be carried. The EDC view already hides such rows; this makes the rule a
-- database guarantee rather than a UI convention.
-- One live row ("Laptop Power Bank") violates the rule today, so it is cleared
-- first or the constraint could not be added. Only is_edc is flipped; edc_slot
-- and edc_order stay as they are, matching the app's own Remove path.
-- RLS, the four policies and the anon grants are untouched: a CHECK constraint
-- adds no access, so none of them are repeated here.
UPDATE "public"."inventory_items"
SET "is_edc" = false
WHERE "is_wishlist" AND "is_edc";

ALTER TABLE "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_wishlist_not_edc"
    CHECK (NOT (COALESCE("is_wishlist", false) AND COALESCE("is_edc", false)));
