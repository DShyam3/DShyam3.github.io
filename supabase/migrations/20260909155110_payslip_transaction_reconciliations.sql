-- A confirmed link between the take-home figure on a payslip and the incoming
-- bank transaction. Suggestions are computed in the browser; this table holds
-- only a person's explicit confirmation, never an uncertain automatic match.
--
-- The composite foreign keys make a cross-profile link impossible at the
-- database layer. One admin can currently view all profiles, but the profile
-- switcher is still a data boundary and the link must not bypass it.

BEGIN;

-- Both IDs are globally unique already. These composite unique indexes exist
-- solely to let the foreign keys below enforce that all three rows share one
-- profile, while also keeping parent delete cascades indexed.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_payslips_profile_id_id"
    ON "public"."finance_payslips" ("profile_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_transactions_profile_id_id"
    ON "public"."finance_transactions" ("profile_id", "id");

CREATE TABLE IF NOT EXISTS "public"."finance_payslip_transaction_reconciliations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "payslip_id" text NOT NULL,
    "transaction_id" text NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."finance_payslip_transaction_reconciliations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    DROP CONSTRAINT IF EXISTS "finance_payslip_transaction_reconciliations_pkey";
ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    DROP CONSTRAINT IF EXISTS "finance_payslip_transaction_reconciliations_profile_id_fkey";
ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    DROP CONSTRAINT IF EXISTS "finance_payslip_transaction_reconciliations_profile_payslip_fkey";
ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_payslip_fkey"
    FOREIGN KEY ("profile_id", "payslip_id")
    REFERENCES "public"."finance_payslips"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    DROP CONSTRAINT IF EXISTS "finance_payslip_transaction_reconciliations_profile_transaction_fkey";
ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_transaction_fkey"
    FOREIGN KEY ("profile_id", "transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

-- A payslip represents one payment and a bank transaction represents one
-- receipt. These unique indexes enforce that neither side can be confirmed
-- twice and cover the foreign-key lookups performed by a cascade.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_payslip_reconciliation_payslip"
    ON "public"."finance_payslip_transaction_reconciliations" ("payslip_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_payslip_reconciliation_transaction"
    ON "public"."finance_payslip_transaction_reconciliations" ("transaction_id");
CREATE INDEX IF NOT EXISTS "idx_finance_payslip_reconciliation_profile"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id");

ALTER TABLE "public"."finance_payslip_transaction_reconciliations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_payslip_transaction_reconciliations";
CREATE POLICY "Admin Only" ON "public"."finance_payslip_transaction_reconciliations"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" FROM "anon";
GRANT ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" TO "service_role";

COMMENT ON TABLE "public"."finance_payslip_transaction_reconciliations" IS
    'User-confirmed, one-to-one links between a payslip take-home figure and its incoming finance transaction.';

COMMIT;
