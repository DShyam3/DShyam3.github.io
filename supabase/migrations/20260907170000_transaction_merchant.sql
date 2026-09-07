-- The merchant behind a transaction, kept apart from its display name.
--
-- TrueLayer returns `merchant_name` and the sync collapsed it straight into
-- `name`, which is the column a person edits. Rename "TESCO STORES 2891" to
-- "weekly shop" and every merchant-keyed thing -- a logo, a "previous
-- transactions here" lookup, a future rule -- loses its key.
--
-- So the bank's word for who was paid is stored once, written only by the
-- sync, and never touched by the editor. Manual rows leave it NULL, which is
-- the honest answer: nobody told us who the merchant was.

BEGIN;

ALTER TABLE "public"."finance_transactions"
    ADD COLUMN IF NOT EXISTS "merchant" "text";

COMMENT ON COLUMN "public"."finance_transactions"."merchant" IS
  'Merchant as the bank reported it, from TrueLayer''s merchant_name. Written '
  'by the sync only -- `name` is the editable display label and may diverge. '
  'NULL on manually entered rows.';

COMMIT;
