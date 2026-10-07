-- Keep reviewed bank-record suggestions with the existing recurring commitment.
-- Existing bills remain active; no last payment is inferred or confirmed here.
ALTER TABLE "public"."finance_recurring_bills"
    ADD COLUMN "status" "text" DEFAULT 'active'::"text" NOT NULL,
    ADD COLUMN "detection_key" "text",
    ADD COLUMN "last_paid_date" date,
    ADD CONSTRAINT "finance_recurring_bills_status_check" CHECK ("status" IN ('active', 'inactive', 'dismissed'));

COMMENT ON COLUMN "public"."finance_recurring_bills"."status" IS
    'User review outcome: active commitments, inactive commitments, or dismissed recurring-payment suggestions.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."detection_key" IS
    'Deterministic merchant and account key used to associate a reviewed recurring payment with future bank-record suggestions.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."last_paid_date" IS
    'Last payment date confirmed by the user; nullable when no payment has been confirmed.';

-- RLS does not filter TRUNCATE. Finance tables must grant anon no privileges.
REVOKE ALL ON TABLE "public"."finance_recurring_bills" FROM "anon";
