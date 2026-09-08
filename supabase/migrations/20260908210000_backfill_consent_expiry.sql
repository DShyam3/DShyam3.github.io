-- Backfill consent_expires_at for any connection that had it null
-- Open Banking consent is valid for 90 days from connection.

UPDATE "public"."finance_truelayer_connection"
SET "consent_expires_at" = "created_at" + INTERVAL '90 days'
WHERE "consent_expires_at" IS NULL;
