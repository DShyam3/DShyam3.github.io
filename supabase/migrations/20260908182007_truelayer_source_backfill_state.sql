-- History availability belongs to an individual account or card, not to its
-- provider connection. A customer can add a new account to an existing
-- consent years after another account completed its backfill.
BEGIN;

CREATE TABLE "public"."finance_truelayer_source_sync" (
    "id" uuid DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" uuid NOT NULL,
    "source_kind" text NOT NULL,
    "provider_account_id" text NOT NULL,
    "backfilled_from" date,
    "backfill_complete" boolean DEFAULT false NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_truelayer_source_sync_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_truelayer_source_sync_kind_check"
      CHECK ("source_kind" IN ('accounts', 'cards')),
    CONSTRAINT "finance_truelayer_source_sync_connection_source_unique"
      UNIQUE ("connection_id", "source_kind", "provider_account_id"),
    CONSTRAINT "finance_truelayer_source_sync_connection_id_fkey"
      FOREIGN KEY ("connection_id")
      REFERENCES "public"."finance_truelayer_connection"("id")
      ON DELETE CASCADE
);

CREATE INDEX "idx_finance_truelayer_source_sync_connection"
  ON "public"."finance_truelayer_source_sync" ("connection_id");

ALTER TABLE "public"."finance_truelayer_source_sync" ENABLE ROW LEVEL SECURITY;

-- Synchronisation state contains provider account identifiers and is only
-- used by the service-role Edge Function. It is not part of the client API.
REVOKE ALL ON TABLE "public"."finance_truelayer_source_sync" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."finance_truelayer_source_sync" TO "service_role";

COMMENT ON TABLE "public"."finance_truelayer_source_sync" IS
  'Resumable TrueLayer history cursor per consented account or card.';

COMMIT;
