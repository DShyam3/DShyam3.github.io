-- TrueLayer transaction IDs are not a global primary key. Scope the provider
-- identifier to its account so two accounts can never overwrite one another.
-- Existing row IDs stay unchanged because finance_profile_transfers can refer
-- to them; the sync function reuses them through this new source identity.

BEGIN;

ALTER TABLE "public"."finance_transactions"
    ADD COLUMN IF NOT EXISTS "provider_transaction_id" text;

-- Earlier syncs stored TrueLayer's raw ID in the app primary key. Recover it
-- for those rows before the new account-scoped uniqueness rule is added.
UPDATE "public"."finance_transactions"
SET "provider_transaction_id" = substring("id" FROM 7)
WHERE "provider_transaction_id" IS NULL
  AND "account_id" IS NOT NULL
  AND "id" LIKE 'tl_tx_%'
  AND length("id") > 6;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_transactions_provider_source"
    ON "public"."finance_transactions" ("profile_id", "account_id", "provider_transaction_id")
    WHERE "provider_transaction_id" IS NOT NULL;

COMMENT ON COLUMN "public"."finance_transactions"."provider_transaction_id" IS
    'The provider-issued transaction ID. It is unique only within account_id; the app row ID is an independent stable key.';

COMMIT;
