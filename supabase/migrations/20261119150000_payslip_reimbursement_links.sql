-- A reimbursement printed as a payslip payment may correspond to a card
-- expense. Store only user-confirmed, one-to-one links, scoped to one profile.
BEGIN;

CREATE TABLE "public"."finance_payslip_reimbursement_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "payslip_id" "text" NOT NULL,
    "line_index" integer NOT NULL,
    "line_label" "text" NOT NULL,
    "line_amount" numeric NOT NULL,
    "transaction_id" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_payslip_reimbursement_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_payslip_reimbursement_links_profile_check" CHECK ("profile_id" IS NOT NULL),
    CONSTRAINT "finance_payslip_reimbursement_links_line_check" CHECK ("line_index" >= 0 AND length(btrim("line_label")) > 0 AND "line_amount" > 0),
    CONSTRAINT "finance_payslip_reimbursement_links_profile_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "finance_payslip_reimbursement_links_payslip_fkey"
        FOREIGN KEY ("profile_id", "payslip_id") REFERENCES "public"."finance_payslips"("profile_id", "id") ON DELETE CASCADE,
    CONSTRAINT "finance_payslip_reimbursement_links_transaction_fkey"
        FOREIGN KEY ("profile_id", "transaction_id") REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE
);

ALTER TABLE "public"."finance_payslip_reimbursement_links" OWNER TO "postgres";

-- Each key also covers its corresponding composite foreign key's cascade
-- lookup; the profile prefix covers the direct profile foreign key.
CREATE UNIQUE INDEX "idx_finance_payslip_reimbursement_line"
    ON "public"."finance_payslip_reimbursement_links" ("profile_id", "payslip_id", "line_index");
CREATE UNIQUE INDEX "idx_finance_payslip_reimbursement_transaction"
    ON "public"."finance_payslip_reimbursement_links" ("profile_id", "transaction_id");

ALTER TABLE "public"."finance_payslip_reimbursement_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_payslip_reimbursement_links"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_payslip_reimbursement_links" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_payslip_reimbursement_links" FROM "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."finance_payslip_reimbursement_links" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payslip_reimbursement_links" TO "service_role";

COMMENT ON TABLE "public"."finance_payslip_reimbursement_links" IS
    'User-confirmed links between a positive payslip reimbursement line and one card expense. A copied line label and amount let the client detect confirmations made stale by payslip edits.';

COMMIT;
