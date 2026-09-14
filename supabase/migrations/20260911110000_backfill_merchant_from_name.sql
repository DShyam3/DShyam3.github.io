-- Give the rows already in the table a merchant.
--
-- `merchant` was added late, and the sync only writes it on rows it re-fetches.
-- TrueLayer's window is weeks, the table holds years, so the great majority of
-- rows were never going to be revisited and would have stayed NULL forever --
-- no logo, no merchant-keyed lookup, nothing.
--
-- For a bank-synced row, `name` was written by the same sync from the same
-- field this column now takes, and is only different if a person has since
-- edited it. So copying it across is not a guess: it recovers the value the
-- column would hold if it had existed at the time.
--
-- Scoped to `provider_transaction_id IS NOT NULL`, which is what marks a row
-- as the bank's rather than hand-entered. A manually typed row has no merchant
-- and must keep NULL -- inventing one would put a brand identity on "rent".

BEGIN;

UPDATE "public"."finance_transactions"
SET "merchant" = "name"
WHERE "merchant" IS NULL
  AND "provider_transaction_id" IS NOT NULL
  AND "name" IS NOT NULL
  AND btrim("name") <> ''
  AND "name" <> 'TrueLayer Transaction';

COMMIT;
