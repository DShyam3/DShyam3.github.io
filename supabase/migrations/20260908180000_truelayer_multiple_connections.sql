-- Add provider identity, consent expiry and last sync timestamp to TrueLayer connection table.
--
-- This enables connecting multiple distinct banking institutions per profile (REHAUL_PLAN.md 7.M Step B).
-- Connecting a new bank inserts rather than replaces, and sync loops through all active connections.

BEGIN;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "provider_id" text;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "provider_name" text DEFAULT 'Bank' NOT NULL;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "provider_logo_uri" text;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "consent_expires_at" timestamp with time zone;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;

-- Backfill any existing connection row so provider_id is not null
UPDATE "public"."finance_truelayer_connection"
SET "provider_id" = 'default',
    "provider_name" = 'Connected Bank'
WHERE "provider_id" IS NULL;

ALTER TABLE "public"."finance_truelayer_connection"
    ALTER COLUMN "provider_id" SET NOT NULL;

-- Enforce uniqueness per (profile_id, provider_id) so multiple distinct banks can be connected
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'finance_truelayer_connection_profile_provider_unique'
    ) THEN
        ALTER TABLE "public"."finance_truelayer_connection"
            ADD CONSTRAINT "finance_truelayer_connection_profile_provider_unique"
            UNIQUE ("profile_id", "provider_id");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_finance_truelayer_connection_profile_provider"
    ON "public"."finance_truelayer_connection" ("profile_id", "provider_id");

COMMENT ON COLUMN "public"."finance_truelayer_connection"."provider_id" IS
    'TrueLayer provider identifier (e.g. "mock-bank", "ob-monzo", "ob-barclays").';

COMMENT ON COLUMN "public"."finance_truelayer_connection"."provider_name" IS
    'Human-readable provider display name.';

COMMENT ON COLUMN "public"."finance_truelayer_connection"."consent_expires_at" IS
    'When the ~90-day Open Banking customer consent lapses and must be renewed.';

COMMENT ON COLUMN "public"."finance_truelayer_connection"."last_synced_at" IS
    'When transactions and balances were last synchronized from this provider.';

COMMIT;
