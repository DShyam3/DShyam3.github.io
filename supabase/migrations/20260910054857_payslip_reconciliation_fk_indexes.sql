-- The one-column unique indexes established the one-to-one relationship, but
-- PostgreSQL cascades and Supabase's advisor need an index whose leftmost
-- columns match each composite child key. The composite unique keys retain
-- the exact same one-to-one guarantee and make deletion scale predictably.

BEGIN;

DROP INDEX IF EXISTS "public"."idx_finance_payslip_reconciliation_payslip";
DROP INDEX IF EXISTS "public"."idx_finance_payslip_reconciliation_transaction";

CREATE UNIQUE INDEX "idx_finance_payslip_reconciliation_profile_payslip"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id", "payslip_id");

CREATE UNIQUE INDEX "idx_finance_payslip_reconciliation_profile_transaction"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id", "transaction_id");

COMMIT;
