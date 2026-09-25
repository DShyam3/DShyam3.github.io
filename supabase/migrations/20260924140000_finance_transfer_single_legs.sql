-- Adds finance_transfer_single_legs: a person's verdict on ONE transaction
-- that looks like a transfer but has no matching leg in the ledger -- money
-- sent to, or received from, an account that is not tracked here, or a
-- payment to another person that merely looks like a transfer.
--
-- This is distinct from finance_transfer_links (a confirmed pair) and
-- finance_transfer_dismissals (a rejected pair): both of those are about
-- two transactions. This table is about one transaction that never had a
-- second leg to pair against. Same composite-FK, profile-scoped shape as
-- both -- see finance_transfer_links in 20260912110000_finance_transfer_links.sql
-- for the cross-profile reasoning.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_transfer_single_legs" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "transaction_id" "text" NOT NULL,
    "verdict" "text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_transfer_single_legs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_transfer_single_legs"
    ADD CONSTRAINT "finance_transfer_single_legs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_transfer_single_legs"
    ADD CONSTRAINT "finance_transfer_single_legs_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Relies on the unique index idx_finance_transactions_profile_id_id, the
-- same one finance_transfer_links and finance_transfer_dismissals depend on.
ALTER TABLE ONLY "public"."finance_transfer_single_legs"
    ADD CONSTRAINT "finance_transfer_single_legs_profile_transaction_fkey"
    FOREIGN KEY ("profile_id", "transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_transfer_single_legs"
    ADD CONSTRAINT "finance_transfer_single_legs_verdict_check"
    CHECK ("verdict" IN ('internal', 'external'));

-- One verdict per transaction. Leads with profile_id, so it also serves as
-- the profile-scoped lookup index -- no separate
-- idx_finance_transfer_single_legs_profile_id is needed. The client upserts
-- with onConflict: 'profile_id,transaction_id'; this column order must
-- match that exactly, or every write fails with Postgres 42P10 the way the
-- payslip reconciliation client did before it was corrected to a composite
-- index.
CREATE UNIQUE INDEX "idx_finance_transfer_single_legs_profile_transaction"
    ON "public"."finance_transfer_single_legs" ("profile_id", "transaction_id");

ALTER TABLE "public"."finance_transfer_single_legs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_transfer_single_legs";
CREATE POLICY "Admin Only" ON "public"."finance_transfer_single_legs"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- Least privilege, not the legacy anon-grant pattern used elsewhere in this
-- file: anon holds no grant of any kind -- this is a finance_* table, and
-- ALTER DEFAULT PRIVILEGES hands every new table ALL to anon on creation, so
-- both REVOKEs below are load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_transfer_single_legs" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_transfer_single_legs" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_single_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_single_legs" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_single_legs" IS
    'A person''s verdict on one transaction that looks like a transfer but has no matching leg in the ledger. ''internal'' means the row moved money to or from an account of the owner''s that is not tracked here, and it is excluded from income and spending totals exactly as both legs of a confirmed finance_transfer_links pair are. ''external'' means the person said it is real spending or income -- it changes no figure and only stops the row being proposed again. Never inferred automatically.';

COMMENT ON COLUMN "public"."finance_transfer_single_legs"."verdict" IS
    'internal = excluded from income/spending totals like a confirmed transfer leg; external = real spending or income, changes no figure.';

COMMIT;
