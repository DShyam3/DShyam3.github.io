-- Storage for confirmed transfers between the owner's own accounts.
--
-- src/lib/finance/transfer-detection.ts only proposes candidate pairs -- a
-- bank reference is not proof, so a person confirms every pair before it is
-- excluded from income and spending totals (the same stance as
-- finance_payslip_transaction_reconciliations for payslip matches).
--
-- The composite foreign keys make a cross-profile link impossible at the
-- database layer, the same reasoning as the payslip reconciliation table.
--
-- The unique indexes are profile-scoped from the start. A live bug was found
-- where a client upserted against `onConflict: 'payslip_id'` while the
-- database had moved to a composite `(profile_id, payslip_id)` unique index,
-- and every write failed with Postgres 42P10 behind a toast. The client for
-- this table upserts with `onConflict: 'profile_id,outflow_transaction_id'`
-- (and separately `'profile_id,inflow_transaction_id'`) -- the indexes below
-- must match that exactly, or the feature is dead on arrival the same way.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_transfer_links" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "outflow_transaction_id" "text" NOT NULL,
    "inflow_transaction_id" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_transfer_links" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_transfer_links"
    ADD CONSTRAINT "finance_transfer_links_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_transfer_links"
    ADD CONSTRAINT "finance_transfer_links_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Relies on the unique index idx_finance_transactions_profile_id_id created
-- alongside the payslip reconciliation table.
ALTER TABLE ONLY "public"."finance_transfer_links"
    ADD CONSTRAINT "finance_transfer_links_profile_outflow_fkey"
    FOREIGN KEY ("profile_id", "outflow_transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_transfer_links"
    ADD CONSTRAINT "finance_transfer_links_profile_inflow_fkey"
    FOREIGN KEY ("profile_id", "inflow_transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

-- A transaction cannot be both legs of its own transfer.
ALTER TABLE ONLY "public"."finance_transfer_links"
    ADD CONSTRAINT "finance_transfer_links_distinct_legs_check"
    CHECK ("outflow_transaction_id" <> "inflow_transaction_id");

-- One transaction belongs to at most one link, on each side, scoped to its
-- profile from the start -- never a single-column unique index. The client
-- upserts with onConflict: 'profile_id,outflow_transaction_id' and
-- onConflict: 'profile_id,inflow_transaction_id'; these index names and
-- column orders exist to match those upserts exactly. Get this wrong and
-- every write fails with Postgres 42P10, the same way the payslip
-- reconciliation client did before 20260910054857 corrected it.
CREATE UNIQUE INDEX "idx_finance_transfer_links_profile_outflow"
    ON "public"."finance_transfer_links" ("profile_id", "outflow_transaction_id");

CREATE UNIQUE INDEX "idx_finance_transfer_links_profile_inflow"
    ON "public"."finance_transfer_links" ("profile_id", "inflow_transaction_id");

-- Plain index for the cascade lookups, matching the payslip reconciliation
-- table's idx_finance_payslip_reconciliation_profile.
CREATE INDEX "idx_finance_transfer_links_profile_id"
    ON "public"."finance_transfer_links" ("profile_id");

ALTER TABLE "public"."finance_transfer_links" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Only" ON "public"."finance_transfer_links";
CREATE POLICY "Admin Only" ON "public"."finance_transfer_links"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_transfer_links" FROM "anon";
GRANT ALL ON TABLE "public"."finance_transfer_links" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_links" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_links" IS
    'User-confirmed, one-to-one links between an outflow and an inflow transaction that together are one leg of a transfer between the owner''s own accounts. Excluded from income and spending totals; never inferred automatically.';

-- Evidence for transfer detection, not a categorisation decision -- the
-- bank's own classification of the row (TrueLayer's transaction_category,
-- lowercased: transfer, purchase, direct_debit, standing_order, interest).
-- Kept apart from the free-text `category` column, which a person edits.
ALTER TABLE "public"."finance_transactions"
    ADD COLUMN IF NOT EXISTS "provider_category" "text";

COMMENT ON COLUMN "public"."finance_transactions"."provider_category" IS
  'The bank''s own classification of this row (TrueLayer''s '
  'transaction_category, lowercased), used only as evidence for transfer '
  'detection. Left null for every row synced before this column existed: '
  'null means the provider''s classification is unknown for this row, not '
  'that the row is not a transfer.';

COMMIT;
