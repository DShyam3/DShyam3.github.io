-- Widen what `merchant` means, now that the bank has had its say.
--
-- The column was documented as holding TrueLayer's `merchant_name`. In
-- practice that field is part of TrueLayer's paid enrichment, and the raw Data
-- API returns it as null for most UK issuers -- so the column stayed empty and
-- every transaction row drew a category letter instead of an identity.
--
-- The sync now falls back to the bank's description. It is noisier, but
-- normaliseMerchant (src/lib/finance/merchant.ts) strips the parts that vary
-- between two visits to the same shop -- processor prefix, store number, till
-- reference -- and what is left is a stable key, which is the only property
-- this column needs to have.
--
-- Still never the display name: `name` is the person's to edit, this is the
-- bank's, and they have to be able to diverge.

BEGIN;

COMMENT ON COLUMN "public"."finance_transactions"."merchant" IS
  'Who the bank said was paid: TrueLayer''s merchant_name where the provider '
  'supplies one, otherwise the raw transaction description. Written by the '
  'sync only -- `name` is the editable display label and may diverge. NULL on '
  'manually entered rows.';

COMMIT;
