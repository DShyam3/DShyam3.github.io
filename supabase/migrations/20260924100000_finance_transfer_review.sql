-- Two changes to transfer review, both scoped to the confirmed-transfer
-- machinery introduced in 20260912110000_finance_transfer_links.sql.
--
-- 1. Forward-fixes a review finding against that migration: it granted
--    finance_transfer_links "ALL" to authenticated, which includes TRUNCATE.
--    RLS does not govern TRUNCATE, so the grant was the only thing standing
--    in front of it. Narrowed to the same four verbs every other finance_*
--    least-privilege table uses (see finance_student_loan_rates).
--
-- 2. Adds finance_transfer_dismissals: pairs a person has looked at and said
--    are NOT a transfer, so src/lib/finance/transfer-detection.ts stops
--    proposing them. It is the negative of finance_transfer_links -- a
--    rejection, not a link -- and follows the same composite-FK, profile-
--    scoped-unique-index shape.

BEGIN;

-- (1) Narrow the over-broad grant from 20260912110000.
REVOKE ALL ON TABLE "public"."finance_transfer_links" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_links" TO "authenticated";

-- (2) finance_transfer_dismissals.
CREATE TABLE IF NOT EXISTS "public"."finance_transfer_dismissals" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "outflow_transaction_id" "text" NOT NULL,
    "inflow_transaction_id" "text" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_transfer_dismissals" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_transfer_dismissals"
    ADD CONSTRAINT "finance_transfer_dismissals_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_transfer_dismissals"
    ADD CONSTRAINT "finance_transfer_dismissals_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Relies on the unique index idx_finance_transactions_profile_id_id, the
-- same one finance_transfer_links depends on.
ALTER TABLE ONLY "public"."finance_transfer_dismissals"
    ADD CONSTRAINT "finance_transfer_dismissals_profile_outflow_fkey"
    FOREIGN KEY ("profile_id", "outflow_transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_transfer_dismissals"
    ADD CONSTRAINT "finance_transfer_dismissals_profile_inflow_fkey"
    FOREIGN KEY ("profile_id", "inflow_transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

-- A transaction cannot be both legs of its own dismissed pair.
ALTER TABLE ONLY "public"."finance_transfer_dismissals"
    ADD CONSTRAINT "finance_transfer_dismissals_distinct_legs_check"
    CHECK ("outflow_transaction_id" <> "inflow_transaction_id");

-- Deliberately one index, not one-per-leg the way finance_transfer_links
-- has two: dismissing A->B must not stop A->C being proposed later, so the
-- uniqueness is on the pair, not on either leg alone. It leads with
-- profile_id, so it also serves as the profile-scoped lookup index --
-- no separate idx_finance_transfer_dismissals_profile_id is needed. The
-- client upserts with onConflict: 'profile_id,outflow_transaction_id,
-- inflow_transaction_id'; this column order must match that exactly, or
-- every write fails with Postgres 42P10 the way the payslip reconciliation
-- client did before it was corrected to a composite index.
CREATE UNIQUE INDEX "idx_finance_transfer_dismissals_profile_pair"
    ON "public"."finance_transfer_dismissals" ("profile_id", "outflow_transaction_id", "inflow_transaction_id");

ALTER TABLE "public"."finance_transfer_dismissals" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_transfer_dismissals";
CREATE POLICY "Admin Only" ON "public"."finance_transfer_dismissals"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- Least privilege, not the legacy anon-grant pattern used elsewhere in this
-- file: anon holds no grant of any kind -- this is a finance_* table, and
-- ALTER DEFAULT PRIVILEGES hands every new table ALL to anon on creation, so
-- both REVOKEs below are load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_transfer_dismissals" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_transfer_dismissals" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_dismissals" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_dismissals" IS
    'User-rejected candidate pairs from transfer detection: a person looked at this outflow/inflow pair and said it is not a transfer. Records a rejection only -- changes no figure, no balance, no total. A dismissed pair is simply never proposed again by src/lib/finance/transfer-detection.ts.';

COMMIT;
