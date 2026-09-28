-- Free-text "who supplies it" for a budget item or recurring bill --
-- distinct from the item's own name: item "Phone", provider "O2".
--
-- text, nullable, no default. No CHECK: no finance free-text column has a
-- length CHECK, the client caps input instead. Grants on both tables are
-- table-level (see 40_finance.sql), so this column needs no grant changes.

BEGIN;

ALTER TABLE "public"."finance_budget_items"
    ADD COLUMN IF NOT EXISTS "provider" "text";

COMMENT ON COLUMN "public"."finance_budget_items"."provider" IS
    'Free-text name of who supplies this item (e.g. item "Phone", provider "O2"). Nullable; no length CHECK -- the client caps input.';

ALTER TABLE "public"."finance_recurring_bills"
    ADD COLUMN IF NOT EXISTS "provider" "text";

COMMENT ON COLUMN "public"."finance_recurring_bills"."provider" IS
    'Free-text name of who supplies this bill (e.g. item "Phone", provider "O2"). Nullable; no length CHECK -- the client caps input.';

COMMIT;
