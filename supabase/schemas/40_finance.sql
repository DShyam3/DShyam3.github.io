CREATE TABLE IF NOT EXISTS "public"."finance_bank_accounts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "issuer" "text",
    "balance" numeric DEFAULT 0 NOT NULL,
    "annual_fee" numeric DEFAULT 0 NOT NULL,
    "credit_limit" numeric,
    "use_case" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_bank_accounts" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_bank_accounts"."credit_limit" IS
    'The card''s credit limit in GBP. For bank-synced cards, truelayer-sync writes it from TrueLayer''s card balance `credit_limit` whenever the bank returns one; otherwise the owner enters it. NULL means the limit is unknown, not zero -- a card with no known limit is left out of credit utilisation rather than counted as fully used. Meaningful only for type ''credit''.';

CREATE TABLE IF NOT EXISTS "public"."finance_budget_categories" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "is_template" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "budgeted" numeric DEFAULT 0 NOT NULL,
    "group_type" "text",
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_budget_categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_budget_items" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "is_template" boolean DEFAULT false NOT NULL,
    "category_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "budgeted" numeric DEFAULT 0 NOT NULL,
    "spent" numeric DEFAULT 0 NOT NULL,
    "linked_account_id" "text",
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- Free-text name of who supplies this item, distinct from its own name:
    -- item "Phone", provider "O2".
    "provider" "text"
);

ALTER TABLE "public"."finance_budget_items" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_budget_items"."provider" IS
    'Free-text name of who supplies this item (e.g. item "Phone", provider "O2"). Nullable; no length CHECK -- the client caps input.';

CREATE TABLE IF NOT EXISTS "public"."finance_budget_presets" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "preset_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text",
    "group_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_budget_presets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_credit_bureaus" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "emoji" "text",
    "color" "text",
    "max_score" integer NOT NULL,
    "gradient" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_credit_bureaus" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_credit_scores" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "bureau" "text" NOT NULL,
    "date" "date" NOT NULL,
    "score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_credit_scores" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_data" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."finance_data" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_debts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "lender" "text",
    "original_amount" numeric DEFAULT 0 NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "interest_rate" numeric DEFAULT 0 NOT NULL,
    "min_payment" numeric DEFAULT 0 NOT NULL,
    "start_date" "date",
    "payoff_date" "date",
    "repayment_type" "text" DEFAULT 'amortising'::"text" NOT NULL,
    "student_loan_plan" "text",
    -- Last day of study; sets when a student loan is first due for repayment.
    "course_end_date" "date",
    "write_off_years" integer,
    "draws" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_debts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_defaults" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."finance_defaults" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_goal_contributions" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "goal_id" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "note" "text",
    "bank_account_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_goal_contributions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_goals" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "target_amount" numeric DEFAULT 0 NOT NULL,
    "current_amount" numeric DEFAULT 0 NOT NULL,
    "target_date" "date",
    "start_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "emoji" "text",
    -- The goal representing this profile's emergency reserve; scenario runs
    -- treat its target as the floor cash should not fall below.
    "is_emergency_fund" boolean DEFAULT false NOT NULL,
    -- What the goal is intended to receive monthly. 0 means unfunded.
    "monthly_contribution" numeric DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."finance_goals" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_holiday_defaults" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "month_index" integer NOT NULL,
    "count" numeric DEFAULT 0 NOT NULL,
    "dates" "text",
    "occasion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_holiday_defaults" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_memberships" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text",
    "annual_fee" numeric DEFAULT 0 NOT NULL,
    "use_case" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_memberships" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_recurring_bills" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "due_date" integer NOT NULL,
    "is_paid" boolean DEFAULT false NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "due_month" integer,
    "emoji" "text",
    "category" "text",
    "tag" "text",
    "linked_budget_item_id" "text",
    "linked_account_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    -- Free-text name of who supplies this bill, distinct from its own name:
    -- item "Phone", provider "O2".
    "provider" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "detection_key" "text",
    "last_paid_date" date,
    "paid_for_due_date" date,
    CONSTRAINT "finance_recurring_bills_status_check" CHECK ("status" IN ('active', 'inactive', 'dismissed'))
);

ALTER TABLE "public"."finance_recurring_bills" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_recurring_bills"."provider" IS
    'Free-text name of who supplies this bill (e.g. item "Phone", provider "O2"). Nullable; no length CHECK -- the client caps input.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."status" IS
    'User review outcome: active commitments, inactive commitments, or dismissed recurring-payment suggestions.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."detection_key" IS
    'Deterministic merchant and account key used to associate a reviewed recurring payment with future bank-record suggestions.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."last_paid_date" IS
    'Last payment date confirmed by the user; nullable when no payment has been confirmed.';

COMMENT ON COLUMN "public"."finance_recurring_bills"."paid_for_due_date" IS
    'Scheduled due date of the period the confirmed payment covers; decides Paid for monthly, quarterly and annual bills. Null for rows confirmed before this column existed.';

CREATE TABLE IF NOT EXISTS "public"."finance_recurring_templates" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "emoji" "text",
    "tag" "text",
    "default_amount" numeric DEFAULT 0 NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "linked_budget_item_id" "text",
    "budget_category_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_recurring_templates" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "gross_salary" numeric DEFAULT 0 NOT NULL,
    "pension_type" "text" DEFAULT 'net_pay'::"text" NOT NULL,
    "personal_pension_percent" numeric DEFAULT 0 NOT NULL,
    "employer_pension_percent" numeric DEFAULT 0 NOT NULL,
    "student_loan_plan" "text" DEFAULT 'none'::"text" NOT NULL,
    "tax_code" "text" DEFAULT '1257L'::"text" NOT NULL,
    "personal_allowance" numeric DEFAULT 12570 NOT NULL,
    "weekends" integer DEFAULT 104 NOT NULL,
    "bank_holidays" integer DEFAULT 8 NOT NULL,
    "work_holidays" integer DEFAULT 25 NOT NULL,
    "working_hours_per_day" numeric DEFAULT 7.5 NOT NULL,
    "tax_year" integer DEFAULT 2026 NOT NULL,
    "uk_region" "text" DEFAULT 'england-and-wales'::"text" NOT NULL,
    "pay_day_of_month" integer DEFAULT 25,
    "payday_schedule" "text" DEFAULT 'monthly_date'::"text",
    "payday_weekday" integer DEFAULT 5,
    "payday_biweekly_anchor" "text" DEFAULT '2026-01-02'::"text",
    "active_savings_types" "text"[] DEFAULT '{}'::"text"[],
    "birthday_leave_enabled" boolean DEFAULT false NOT NULL,
    "birthday_leave_rule" "text" DEFAULT 'within_week'::"text" NOT NULL,
    "birthday_month" integer,
    "birthday_day" integer,
    "package_benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_settings" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_settings"."birthday_leave_enabled" IS
    'Whether the profile receives an extra paid Birthday Day Off benefit on top of standard work_holidays.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_leave_rule" IS
    'Employer rule governing when the paid Birthday Day Off may be taken: exact_or_nearest, within_week, birthday_month, within_month, or anytime.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_month" IS
    'Calendar month of birth (1..12) used only to compute the Birthday Day Off eligibility window; never a full date of birth.';

COMMENT ON COLUMN "public"."finance_settings"."birthday_day" IS
    'Day of month of birth (1..31) used only to compute the Birthday Day Off eligibility window; never a full date of birth.';

COMMENT ON COLUMN "public"."finance_settings"."package_benefits" IS
    'Contractual employer package benefits (JSON array of benefit items) tracked for total package valuation and comparison.';

-- Global reference data, versioned by the date it takes effect -- same idea
-- as finance_tax_configs. Not scoped to a profile: the Student Loans
-- Company publishes one set of parameters a year, not one per person.
CREATE TABLE IF NOT EXISTS "public"."finance_student_loan_rates" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "effective_from" "date" NOT NULL,
    "rpi_percent" numeric NOT NULL,
    "cap_percent" numeric,
    "plan2_upper_threshold" numeric,
    "bank_rate_percent" numeric,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan2_lower_threshold" numeric
);

ALTER TABLE "public"."finance_student_loan_rates" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_student_loan_rates"."plan2_lower_threshold" IS
    'Plan 2 income at or below which interest is RPI only (the Plan 2 repayment threshold for that tax year).';

CREATE TABLE IF NOT EXISTS "public"."finance_tax_configs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "student_loan_thresholds" "jsonb" NOT NULL,
    "student_loan_rates" "jsonb" NOT NULL,
    "income_tax_bands" "jsonb" NOT NULL,
    "national_insurance_bands" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_tax_configs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text",
    "amount" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "is_reviewed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bank_account_id" "text",
    "goal_id" "text",
    "notes" "text",
    "tags" "text"[],
    "is_recurring" boolean DEFAULT false,
    "account_id" "text",
    "provider_transaction_id" "text",
    -- The bank's own classification of this row (TrueLayer's
    -- transaction_category, lowercased), used only as evidence for transfer
    -- detection -- kept apart from the free-text `category` column, which a
    -- person edits. Null for every row synced before this column existed:
    -- null means the provider's classification is unknown, not that the row
    -- is not a transfer.
    "provider_category" "text"
);

ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_transactions"."provider_category" IS
    'The bank''s own classification of this row (TrueLayer''s transaction_category, lowercased), used only as evidence for transfer detection. Left null for every row synced before this column existed: null means the provider''s classification is unknown for this row, not that the row is not a transfer.';

CREATE TABLE IF NOT EXISTS "public"."finance_truelayer_connection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "provider_id" "text" NOT NULL,
    "provider_name" "text" DEFAULT 'Bank'::"text" NOT NULL,
    "provider_logo_uri" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "consent_expires_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "backfilled_from" date,
    "backfill_complete" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_truelayer_connection" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_truelayer_source_sync" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "source_kind" "text" NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "backfilled_from" "date",
    "backfill_complete" boolean DEFAULT false NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_truelayer_source_sync" OWNER TO "postgres";

-- Durable log of each TrueLayer bank sync run, nightly (pg_cron) or manual
-- (an admin action), so the finance UI can show sync history and a missed
-- nightly run is visible rather than silent. Written only by the
-- truelayer-sync edge function under the service role, which bypasses RLS --
-- never by the browser, which only reads it as the admin. Grows about 1-3
-- rows a day; no retention policy is needed at that rate.
CREATE TABLE IF NOT EXISTS "public"."finance_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trigger" "text" NOT NULL,
    "status" "text" NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "connections_synced" integer DEFAULT 0 NOT NULL,
    "accounts_synced" integer DEFAULT 0 NOT NULL,
    "transactions_synced" integer DEFAULT 0 NOT NULL,
    "transactions_new" integer DEFAULT 0 NOT NULL,
    "banks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error_message" "text"
);

ALTER TABLE "public"."finance_sync_log" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_trigger_check"
    CHECK (("trigger" = ANY (ARRAY['scheduled'::"text", 'manual'::"text"])));

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_status_check"
    CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'error'::"text"])));

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_duration_ms_check"
    CHECK ("duration_ms" >= 0);

-- Leads with profile_id, so it also serves as the profile-scoped lookup
-- index -- what the sync-history UI queries (a profile's runs, most recent
-- first) and what a missed-nightly-run check scans.
CREATE INDEX "idx_finance_sync_log_profile_synced_at"
    ON "public"."finance_sync_log" ("profile_id", "synced_at" DESC);

ALTER TABLE "public"."finance_sync_log" ENABLE ROW LEVEL SECURITY;

-- Read-only from the API, deliberately: only the truelayer-sync edge
-- function writes this table, over the service role, which bypasses RLS.
-- No INSERT/UPDATE/DELETE policy exists for authenticated or anon, so those
-- verbs are denied by RLS's default-deny the same way admin_users denies
-- writes to its own "Admin read" policy (01_functions.sql) -- copied here:
-- is_admin() only, no further profile scoping, because this is a
-- single-admin site and is_admin() already is the whole boundary.
CREATE POLICY "Admin read" ON "public"."finance_sync_log"
    FOR SELECT TO "authenticated"
    USING ((SELECT "public"."is_admin"()));

-- Least privilege: anon holds no grant of any kind -- this is a finance_* table,
-- and a fresh build starts from the image's default of ALL, so both REVOKEs
-- below are load-bearing, not decorative. authenticated gets
-- SELECT only, matching the policy above: no write grant exists because no
-- write policy exists to authorise it.
REVOKE ALL ON TABLE "public"."finance_sync_log" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_sync_log" FROM "authenticated";
GRANT SELECT ON TABLE "public"."finance_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_sync_log" TO "service_role";

COMMENT ON TABLE "public"."finance_sync_log" IS
    'Durable log of TrueLayer bank sync runs (trigger = ''scheduled'' for the nightly pg_cron job, ''manual'' for an admin-initiated sync), so the finance UI can show sync history and a missed nightly run is visible rather than silent. A run that times out or crashes writes no row and shows as missed. Written only by the truelayer-sync edge function under the service role, which bypasses RLS; the browser reads it as the admin.';

COMMENT ON COLUMN "public"."finance_sync_log"."transactions_synced" IS
    'Total transaction rows written this run, including rows already stored that were re-fetched inside the overlap window. See transactions_new for rows that were actually new.';

COMMENT ON COLUMN "public"."finance_sync_log"."transactions_new" IS
    'Rows this run inserted that were not already stored. Always <= transactions_synced.';

COMMENT ON COLUMN "public"."finance_sync_log"."banks" IS
    'Per-bank outcome for this run: array of {name text, status ''synced''|''failed'', transactions int, error text optional}. transactions counts rows fetched from that bank before de-duplication, including the re-fetched overlap window, so it is not a count of new rows. error is present only when status is ''failed''.';

COMMENT ON COLUMN "public"."finance_sync_log"."error_message" IS
    'A generic, user-safe summary of what went wrong for the run as a whole. Never the raw provider or SQL error -- see Error Handling in AGENTS.md.';

CREATE TABLE IF NOT EXISTS "public"."finance_truelayer_oauth_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "state_hash" "text" NOT NULL,
    "redirect_uri" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_truelayer_oauth_states" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_user_holidays" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "occasion" "text",
    "count" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'holiday'::"text" NOT NULL,
    "half_day" "text"
);

ALTER TABLE "public"."finance_user_holidays" OWNER TO "postgres";

COMMENT ON COLUMN "public"."finance_user_holidays"."type" IS
    'Leave type: "holiday" (counts against annual holiday allowance), "sick" (tracked separately as sick leave taken), or "birthday" (paid birthday day off benefit, does not consume standard holiday allowance).';

COMMENT ON COLUMN "public"."finance_user_holidays"."half_day" IS
    'Which half of a single-day booking is taken: "am" (morning) or "pm" (afternoon). NULL for a full day or a range. A half day costs 0.5 days.';

CREATE TABLE IF NOT EXISTS "public"."finance_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_self" boolean DEFAULT false NOT NULL,
    -- Marks a profile as safe to show publicly. Carries no privilege on its
    -- own: no policy reads it, and anon holds no SELECT on any finance table.
    "is_public" boolean DEFAULT false NOT NULL,
    "owner_user_id" "uuid",
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "region" "text" DEFAULT 'england-and-wales'::"text" NOT NULL,
    -- Retirement planning inputs the ledger cannot infer. A year of birth is
    -- all the projection needs, and profiles may hold family members.
    "birth_year" integer,
    "retirement_age" integer DEFAULT 68 NOT NULL,
    -- Growth AFTER inflation, so projections are in today's money.
    "pension_growth_percent" numeric DEFAULT 4.5 NOT NULL,
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_profile_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_profile_id" "uuid" NOT NULL,
    "to_profile_id" "uuid" NOT NULL,
    "from_transaction_id" "text",
    "to_transaction_id" "text",
    "amount" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_profile_transfers_distinct_check" CHECK ("from_profile_id" <> "to_profile_id")
);

ALTER TABLE "public"."finance_profile_transfers" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_budget_categories"
    ADD CONSTRAINT "finance_budget_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_budget_presets"
    ADD CONSTRAINT "finance_budget_presets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_credit_bureaus"
    ADD CONSTRAINT "finance_credit_bureaus_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_credit_scores"
    ADD CONSTRAINT "finance_credit_scores_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_data"
    ADD CONSTRAINT "finance_data_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_pkey" PRIMARY KEY ("id");

-- The target of finance_debt_observations_profile_debt_fkey. id is already the
-- primary key, so this adds no uniqueness; a composite foreign key needs a
-- unique constraint over exactly its columns. Declared here, ahead of the
-- foreign key in the finance_debt_observations block below, so a build
-- finds it in place (20261025090000_debt_observations_profile_scoped_fk.sql).
-- profile_id leads, so the index behind it also covers finance_debts_profile_id_fkey
-- and the scoped reads; that is why there is no separate index on profile_id
-- alone for this table.
ALTER TABLE ONLY "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_profile_id_id_key" UNIQUE ("profile_id", "id");

ALTER TABLE ONLY "public"."finance_defaults"
    ADD CONSTRAINT "finance_defaults_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_goals"
    ADD CONSTRAINT "finance_goals_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_holiday_defaults"
    ADD CONSTRAINT "finance_holiday_defaults_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_memberships"
    ADD CONSTRAINT "finance_memberships_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_recurring_bills"
    ADD CONSTRAINT "finance_recurring_bills_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_recurring_templates"
    ADD CONSTRAINT "finance_recurring_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_pkey" PRIMARY KEY ("id");

-- Defaults and any future per-profile override are separate timelines, one
-- row per scope and effective date -- same shape as finance_tax_configs.
ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_scope_effective_from_key" UNIQUE ("is_default", "effective_from");

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_rpi_percent_check"
    CHECK (("rpi_percent" >= ('-10'::integer)::numeric) AND ("rpi_percent" <= (50)::numeric));

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_cap_percent_check"
    CHECK (("cap_percent" IS NULL) OR (("cap_percent" >= (0)::numeric) AND ("cap_percent" <= (50)::numeric)));

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_plan2_upper_threshold_check"
    CHECK (("plan2_upper_threshold" IS NULL) OR ("plan2_upper_threshold" > (0)::numeric));

ALTER TABLE ONLY "public"."finance_student_loan_rates"
    ADD CONSTRAINT "finance_student_loan_rates_plan2_lower_threshold_check"
    CHECK (("plan2_lower_threshold" IS NULL) OR ("plan2_lower_threshold" > (0)::numeric));

ALTER TABLE ONLY "public"."finance_tax_configs"
    ADD CONSTRAINT "finance_tax_configs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_truelayer_connection"
    ADD CONSTRAINT "finance_truelayer_connection_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_truelayer_connection"
    ADD CONSTRAINT "finance_truelayer_connection_profile_provider_unique" UNIQUE ("profile_id", "provider_id");

ALTER TABLE ONLY "public"."finance_truelayer_source_sync"
    ADD CONSTRAINT "finance_truelayer_source_sync_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_truelayer_source_sync"
    ADD CONSTRAINT "finance_truelayer_source_sync_connection_source_unique"
    UNIQUE ("connection_id", "source_kind", "provider_account_id");

ALTER TABLE ONLY "public"."finance_truelayer_source_sync"
    ADD CONSTRAINT "finance_truelayer_source_sync_kind_check"
    CHECK (("source_kind" = ANY (ARRAY['accounts'::"text", 'cards'::"text"])));

ALTER TABLE ONLY "public"."finance_truelayer_oauth_states"
    ADD CONSTRAINT "finance_truelayer_oauth_states_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_truelayer_oauth_states"
    ADD CONSTRAINT "finance_truelayer_oauth_states_state_hash_key" UNIQUE ("state_hash");

ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_finance_budget_items_category_id" ON "public"."finance_budget_items" USING "btree" ("category_id");

CREATE INDEX "idx_finance_goal_contributions_goal_id" ON "public"."finance_goal_contributions" USING "btree" ("goal_id");

CREATE INDEX "idx_finance_transactions_account_id" ON "public"."finance_transactions" USING "btree" ("account_id");

CREATE UNIQUE INDEX "idx_finance_transactions_provider_source" ON "public"."finance_transactions" USING "btree" ("profile_id", "account_id", "provider_transaction_id") WHERE ("provider_transaction_id" IS NOT NULL);

ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_budget_categories"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."finance_goals"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."finance_bank_accounts"("id") ON DELETE SET NULL;

CREATE POLICY "Admin All Access" ON "public"."finance_truelayer_connection" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_truelayer_oauth_states" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_bank_accounts" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_budget_categories" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_budget_items" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_budget_presets" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_credit_bureaus" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_credit_scores" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_data" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_debts" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_defaults" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_goal_contributions" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_goals" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_holiday_defaults" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_memberships" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_recurring_bills" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_recurring_templates" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_settings" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_student_loan_rates" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_tax_configs" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_transactions" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin Only" ON "public"."finance_user_holidays" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

ALTER TABLE "public"."finance_bank_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_budget_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_budget_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_budget_presets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_credit_bureaus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_credit_scores" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_data" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_debts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_defaults" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_goal_contributions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_holiday_defaults" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_recurring_bills" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_recurring_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_student_loan_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_tax_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_connection" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_source_sync" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_oauth_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_user_holidays" ENABLE ROW LEVEL SECURITY;

-- Grants

REVOKE ALL ON TABLE "public"."finance_bank_accounts" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_bank_accounts" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_bank_accounts" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_bank_accounts" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_budget_categories" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_budget_categories" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_budget_categories" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_categories" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_budget_items" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_budget_items" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_budget_items" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_items" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_budget_presets" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_budget_presets" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_budget_presets" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_presets" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_credit_bureaus" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_credit_bureaus" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_credit_bureaus" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_credit_bureaus" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_credit_scores" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_credit_scores" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_credit_scores" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_credit_scores" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_data" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_data" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_data" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_data" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_debts" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_debts" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_debts" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_defaults" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_defaults" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_defaults" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_defaults" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_goal_contributions" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_goal_contributions" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_goal_contributions" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_goal_contributions" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_goals" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_goals" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_goals" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_goals" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_holiday_defaults" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_holiday_defaults" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_holiday_defaults" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_holiday_defaults" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_memberships" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_memberships" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_memberships" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_memberships" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_recurring_bills" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_recurring_bills" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_recurring_bills" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_recurring_bills" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_recurring_templates" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_recurring_templates" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_recurring_templates" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_recurring_templates" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_settings" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_settings" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_settings" TO "service_role";

-- finance_student_loan_rates: least privilege. anon holds no grant of any kind:
-- this is a finance_* table, and a fresh build starts from the image's default
-- of ALL, so both REVOKEs below are load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_student_loan_rates" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_student_loan_rates" FROM "authenticated";

GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "public"."finance_student_loan_rates" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_student_loan_rates" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_tax_configs" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_tax_configs" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_tax_configs" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_tax_configs" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_transactions" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_transactions" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_transactions" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_truelayer_connection" FROM "anon";

-- Holds TrueLayer access and refresh tokens: service_role only, no grant to
-- authenticated (see 20261024150000_authenticated_grants_least_privilege.sql).
REVOKE ALL ON TABLE "public"."finance_truelayer_connection" FROM "authenticated";

GRANT ALL ON TABLE "public"."finance_truelayer_connection" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_truelayer_source_sync" FROM "anon";

GRANT ALL ON TABLE "public"."finance_truelayer_source_sync" TO "service_role";

-- OAuth state for the TrueLayer connect flow: service_role only, no grant to
-- authenticated (see 20261024150000_authenticated_grants_least_privilege.sql).
REVOKE ALL ON TABLE "public"."finance_truelayer_oauth_states" FROM "authenticated";

GRANT ALL ON TABLE "public"."finance_truelayer_oauth_states" TO "service_role";

REVOKE ALL ON TABLE "public"."finance_user_holidays" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_user_holidays" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_user_holidays" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_user_holidays" TO "service_role";

-- Revoked privileges
--
-- Every finance_* table carries an explicit REVOKE ALL ... FROM "anon", because
-- a fresh build starts from the image's default of ALL and anon holds nothing on
-- finance_* live. The standalone revokes below are the ones not placed beside
-- their table's other grants.

REVOKE ALL ON TABLE "public"."finance_truelayer_source_sync" FROM "authenticated";

REVOKE ALL ON TABLE "public"."finance_debts" FROM "anon";

REVOKE ALL ON TABLE "public"."finance_truelayer_oauth_states" FROM "anon";

-- Phase 7.1 -- profiles. See REHAUL_PLAN.md 7.B.

ALTER TABLE ONLY "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Exactly one profile may be the operator's own.
-- One emergency fund per profile. Template rows carry a null profile_id, and
-- several nulls are distinct to a unique index, so they are unaffected.
CREATE UNIQUE INDEX "idx_finance_goals_one_emergency_fund" ON "public"."finance_goals" ("profile_id") WHERE "is_emergency_fund";

CREATE UNIQUE INDEX "idx_finance_profiles_self" ON "public"."finance_profiles" ("is_self") WHERE "is_self";

-- Covers finance_profiles_owner_user_id_fkey (ON DELETE SET NULL): deleting an
-- auth user would otherwise scan every profile to find the owner_user_id to null.
CREATE INDEX IF NOT EXISTS "idx_finance_profiles_owner_user_id"
    ON "public"."finance_profiles" ("owner_user_id");

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_from_profile_id_fkey" FOREIGN KEY ("from_profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_to_profile_id_fkey" FOREIGN KEY ("to_profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_from_transaction_id_fkey" FOREIGN KEY ("from_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_to_transaction_id_fkey" FOREIGN KEY ("to_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE SET NULL;

CREATE INDEX "idx_finance_profile_transfers_from_profile_id" ON "public"."finance_profile_transfers" ("from_profile_id");
CREATE INDEX "idx_finance_profile_transfers_to_profile_id" ON "public"."finance_profile_transfers" ("to_profile_id");

-- Cover finance_profile_transfers_from_transaction_id_fkey and
-- finance_profile_transfers_to_transaction_id_fkey (both ON DELETE SET NULL):
-- deleting a transaction would otherwise scan every transfer to find the legs to null.
CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_from_transaction_id"
    ON "public"."finance_profile_transfers" ("from_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_to_transaction_id"
    ON "public"."finance_profile_transfers" ("to_transaction_id");

-- profile_id is NULL exactly when the row is a shared template (is_default).

ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_credit_limit_check"
    CHECK (("credit_limit" IS NULL) OR ("credit_limit" >= (0)::numeric));
CREATE INDEX "idx_finance_bank_accounts_profile_id" ON "public"."finance_bank_accounts" ("profile_id");

ALTER TABLE ONLY "public"."finance_budget_categories"
    ADD CONSTRAINT "finance_budget_categories_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_budget_categories"
    ADD CONSTRAINT "finance_budget_categories_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_budget_categories_profile_id" ON "public"."finance_budget_categories" ("profile_id");

ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_budget_items_profile_id" ON "public"."finance_budget_items" ("profile_id");

ALTER TABLE ONLY "public"."finance_credit_scores"
    ADD CONSTRAINT "finance_credit_scores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_credit_scores"
    ADD CONSTRAINT "finance_credit_scores_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_credit_scores_profile_id" ON "public"."finance_credit_scores" ("profile_id");

ALTER TABLE ONLY "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
-- No index on profile_id alone: finance_debts_profile_id_id_key (profile_id, id),
-- declared with the primary key above, leads with it.

ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_goal_contributions_profile_id" ON "public"."finance_goal_contributions" ("profile_id");

ALTER TABLE ONLY "public"."finance_goals"
    ADD CONSTRAINT "finance_goals_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_goals"
    ADD CONSTRAINT "finance_goals_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_goals_profile_id" ON "public"."finance_goals" ("profile_id");

ALTER TABLE ONLY "public"."finance_memberships"
    ADD CONSTRAINT "finance_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_memberships"
    ADD CONSTRAINT "finance_memberships_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_memberships_profile_id" ON "public"."finance_memberships" ("profile_id");

ALTER TABLE ONLY "public"."finance_recurring_bills"
    ADD CONSTRAINT "finance_recurring_bills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_recurring_bills"
    ADD CONSTRAINT "finance_recurring_bills_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_recurring_bills_profile_id" ON "public"."finance_recurring_bills" ("profile_id");

ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_leave_rule_check"
    CHECK ("birthday_leave_rule" IN ('exact_or_nearest', 'within_week', 'birthday_month', 'within_month', 'anytime'));
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_month_check"
    CHECK ("birthday_month" IS NULL OR ("birthday_month" >= 1 AND "birthday_month" <= 12));
-- Month and day are a pair: both set or both NULL.
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_pair_check"
    CHECK (("birthday_month" IS NULL) = ("birthday_day" IS NULL));
-- Day 1..29 for February (29 February is a real birthday; the app clamps it in
-- other years), 1..30 for April, June, September and November, else 1..31. A
-- NULL month falls through to 31, harmless because the pair check rejects a
-- day without a month.
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_birthday_day_check"
    CHECK (
        "birthday_day" IS NULL
        OR (
            "birthday_day" >= 1
            AND "birthday_day" <= CASE
                WHEN "birthday_month" = 2 THEN 29
                WHEN "birthday_month" IN (4, 6, 9, 11) THEN 30
                ELSE 31
            END
        )
    );
-- Kept to "is an array": a CHECK enumerating today's benefit shapes would
-- reject tomorrow's. NOT NULL DEFAULT '[]' leaves no NULL case to allow for.
ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_package_benefits_is_array"
    CHECK (jsonb_typeof("package_benefits") = 'array');
CREATE INDEX "idx_finance_settings_profile_id" ON "public"."finance_settings" ("profile_id");

-- One non-default settings row per profile. Shared default rows
-- (is_default, profile_id IS NULL) sit outside the predicate; nothing here
-- limits how many of those exist.
CREATE UNIQUE INDEX "finance_settings_one_per_profile" ON "public"."finance_settings" ("profile_id") WHERE NOT "is_default";

ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_transactions_profile_id" ON "public"."finance_transactions" ("profile_id");

ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_type_check" CHECK ("type" IN ('holiday', 'sick', 'birthday'));
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_half_day_check"
    CHECK ("half_day" IS NULL OR ("half_day" IN ('am', 'pm') AND "start_date" = "end_date" AND "count" = 0.5));
-- A birthday day off is one day: a full day (count 1, no half) or a half day
-- (count 0.5, half named). Other leave types are untouched.
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_birthday_single_day"
    CHECK (
        "type" <> 'birthday'
        OR (
            "start_date" = "end_date"
            AND (
                ("count" = 1 AND "half_day" IS NULL)
                OR ("count" = 0.5 AND "half_day" IS NOT NULL)
            )
        )
    );
CREATE INDEX "idx_finance_user_holidays_profile_id" ON "public"."finance_user_holidays" ("profile_id");

ALTER TABLE ONLY "public"."finance_truelayer_connection"
    ADD CONSTRAINT "finance_truelayer_connection_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
CREATE INDEX "idx_finance_truelayer_connection_profile_id" ON "public"."finance_truelayer_connection" ("profile_id");
CREATE INDEX "idx_finance_truelayer_connection_profile_provider" ON "public"."finance_truelayer_connection" ("profile_id", "provider_id");

ALTER TABLE ONLY "public"."finance_truelayer_source_sync"
    ADD CONSTRAINT "finance_truelayer_source_sync_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "public"."finance_truelayer_connection"("id") ON DELETE CASCADE;
CREATE INDEX "idx_finance_truelayer_source_sync_connection" ON "public"."finance_truelayer_source_sync" ("connection_id");

ALTER TABLE ONLY "public"."finance_truelayer_oauth_states"
    ADD CONSTRAINT "finance_truelayer_oauth_states_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
CREATE INDEX "idx_finance_truelayer_oauth_states_profile_expires_at" ON "public"."finance_truelayer_oauth_states" ("profile_id", "expires_at");

ALTER TABLE "public"."finance_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."finance_profile_transfers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_profiles" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));
CREATE POLICY "Admin Only" ON "public"."finance_profile_transfers" TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

-- S-10: anon needs nothing on any finance table. Re-asserted here because a
-- fresh build starts from the image's default of ALL.
REVOKE ALL ON "public"."finance_profiles" FROM "anon";
REVOKE ALL ON "public"."finance_profile_transfers" FROM "anon";

-- authenticated: least privilege. A fresh database inherits ALL (including
-- TRUNCATE, which RLS does not filter) from the image's default privileges, so
-- the REVOKE is load-bearing. See 20261024150000_authenticated_grants_least_privilege.sql.
REVOKE ALL ON TABLE "public"."finance_profiles" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."finance_profile_transfers" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_profile_transfers" TO "authenticated";

-- Phase 7.4 -- snapshots. See REHAUL_PLAN.md 7.D.
--
-- The pg_cron schedule that calls capture_finance_snapshots() lives in the
-- migration, not here: cron jobs do not round-trip through the schema differ
-- (supabase/README.md).

CREATE TABLE IF NOT EXISTS "public"."finance_net_worth_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "captured_on" "date" NOT NULL,
    "assets" numeric DEFAULT 0 NOT NULL,
    "liabilities" numeric DEFAULT 0 NOT NULL,
    "net_worth" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_net_worth_snapshots" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_net_worth_snapshots"
    ADD CONSTRAINT "finance_net_worth_snapshots_pkey" PRIMARY KEY ("id");

-- One point per profile per day; re-running the job updates rather than
-- duplicating, so a manual capture and the nightly one cannot disagree.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_net_worth_snapshots_day"
    ON "public"."finance_net_worth_snapshots" ("profile_id", "captured_on");

ALTER TABLE ONLY "public"."finance_net_worth_snapshots"
    ADD CONSTRAINT "finance_net_worth_snapshots_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."finance_account_balance_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    -- Deliberately not a foreign key to finance_bank_accounts. History should
    -- outlive the account it describes: closing an account is a fact worth
    -- keeping, not a reason to erase the balances it used to hold. The name is
    -- denormalised for the same reason.
    "account_id" "text" NOT NULL,
    "account_name" "text" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "captured_on" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_account_balance_snapshots" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_account_balance_snapshots"
    ADD CONSTRAINT "finance_account_balance_snapshots_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_account_balance_snapshots_day"
    ON "public"."finance_account_balance_snapshots" ("account_id", "captured_on");

CREATE INDEX IF NOT EXISTS "idx_finance_account_balance_snapshots_profile"
    ON "public"."finance_account_balance_snapshots" ("profile_id", "captured_on");

-- Deleting a profile still removes its history, which the third-party-data
-- note in 7.E depends on.
ALTER TABLE ONLY "public"."finance_account_balance_snapshots"
    ADD CONSTRAINT "finance_account_balance_snapshots_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."finance_net_worth_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."finance_account_balance_snapshots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_net_worth_snapshots" TO "authenticated"
    USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));
CREATE POLICY "Admin Only" ON "public"."finance_account_balance_snapshots" TO "authenticated"
    USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON "public"."finance_net_worth_snapshots" FROM "anon";
REVOKE ALL ON "public"."finance_account_balance_snapshots" FROM "anon";

-- authenticated: least privilege, same reasoning as finance_profiles above.
REVOKE ALL ON TABLE "public"."finance_net_worth_snapshots" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_net_worth_snapshots" TO "authenticated";

REVOKE ALL ON TABLE "public"."finance_account_balance_snapshots" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_account_balance_snapshots" TO "authenticated";

/**
 * Records today's position for every profile.
 *
 * Mirrors what the app derives on screen: assets are the positive bank
 * balances, liabilities are the overdrawn ones plus the outstanding debt
 * balances. Template rows (profile_id IS NULL) are excluded -- they are
 * seed data, not anyone's money.
 */
CREATE OR REPLACE FUNCTION "public"."capture_finance_snapshots"()
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO finance_account_balance_snapshots
      (profile_id, account_id, account_name, balance, captured_on)
  SELECT a.profile_id, a.id, a.name, a.balance, CURRENT_DATE
    FROM finance_bank_accounts a
   WHERE a.profile_id IS NOT NULL
  ON CONFLICT (account_id, captured_on) DO UPDATE
    SET balance = EXCLUDED.balance,
        account_name = EXCLUDED.account_name;

  INSERT INTO finance_net_worth_snapshots
      (profile_id, captured_on, assets, liabilities, net_worth)
  SELECT p.id,
         CURRENT_DATE,
         COALESCE(acc.assets, 0) + COALESCE(h.assets, 0),
         COALESCE(acc.overdrawn, 0) + COALESCE(d.debt, 0),
         COALESCE(acc.assets, 0) + COALESCE(h.assets, 0) - (COALESCE(acc.overdrawn, 0) + COALESCE(d.debt, 0))
    FROM finance_profiles p
    LEFT JOIN (
      SELECT profile_id,
             SUM(balance) FILTER (WHERE balance > 0) AS assets,
             ABS(COALESCE(SUM(balance) FILTER (WHERE balance < 0), 0)) AS overdrawn
        FROM finance_bank_accounts
       WHERE profile_id IS NOT NULL
       GROUP BY profile_id
    ) acc ON acc.profile_id = p.id
    LEFT JOIN (
      SELECT profile_id, SUM(balance) AS debt
        FROM finance_debts
       WHERE profile_id IS NOT NULL
       GROUP BY profile_id
    ) d ON d.profile_id = p.id
    LEFT JOIN (
      SELECT profile_id, SUM(shares * current_price) AS assets
        FROM finance_investment_holdings
       WHERE current_price_known
       GROUP BY profile_id
    ) h ON h.profile_id = p.id
  ON CONFLICT (profile_id, captured_on) DO UPDATE
    SET assets = EXCLUDED.assets,
        liabilities = EXCLUDED.liabilities,
        net_worth = EXCLUDED.net_worth;
END;
$$;

ALTER FUNCTION "public"."capture_finance_snapshots"() OWNER TO "postgres";

-- SECURITY DEFINER routines otherwise grant EXECUTE to PUBLIC by default.
-- The Edge Function invokes this through the service role; the cron job runs
-- as postgres, the owner.
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."capture_finance_snapshots"() TO "service_role";

-- Confirmed transfers between the owner's own accounts. Candidates come from
-- src/lib/finance/transfer-detection.ts, which only proposes pairs; a person
-- confirms every one before it is excluded from income and spending totals
-- (the same stance as finance_payslip_transaction_reconciliations).
--
-- The composite foreign keys make a cross-profile link impossible at the
-- database layer. Relies on the unique index
-- idx_finance_transactions_profile_id_id created alongside the payslip
-- reconciliation table.

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
-- reconciliation client did before it was corrected to a composite index.
CREATE UNIQUE INDEX "idx_finance_transfer_links_profile_outflow"
    ON "public"."finance_transfer_links" ("profile_id", "outflow_transaction_id");

CREATE UNIQUE INDEX "idx_finance_transfer_links_profile_inflow"
    ON "public"."finance_transfer_links" ("profile_id", "inflow_transaction_id");

CREATE INDEX "idx_finance_transfer_links_profile_id"
    ON "public"."finance_transfer_links" ("profile_id");

ALTER TABLE "public"."finance_transfer_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_transfer_links"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- Least privilege: anon holds no grant of any kind -- this is a finance_* table,
-- and a fresh build starts from the image's default of ALL, so the REVOKE below
-- is load-bearing, not decorative. "ALL" to authenticated
-- was reviewed and narrowed: it included TRUNCATE, which RLS does not
-- govern, so the grant was the only thing standing in front of it.
REVOKE ALL ON TABLE "public"."finance_transfer_links" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_transfer_links" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_links" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_links" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_links" IS
    'User-confirmed, one-to-one links between an outflow and an inflow transaction that together are one leg of a transfer between the owner''s own accounts. Excluded from income and spending totals; never inferred automatically.';

-- Pairs a person has looked at and said are NOT a transfer: the negative of
-- finance_transfer_links above. src/lib/finance/transfer-detection.ts only
-- proposes candidates; once a pair is dismissed here, detection stops
-- proposing it again. Same composite-FK, profile-scoped shape as the table
-- above -- see its header comment for the cross-profile reasoning.

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
-- profile_id, so it also serves as the profile-scoped lookup index -- no
-- separate idx_finance_transfer_dismissals_profile_id is needed. The client
-- upserts with onConflict: 'profile_id,outflow_transaction_id,
-- inflow_transaction_id'; this column order must match that exactly, or
-- every write fails with Postgres 42P10 the way the payslip reconciliation
-- client did before it was corrected to a composite index.
CREATE UNIQUE INDEX "idx_finance_transfer_dismissals_profile_pair"
    ON "public"."finance_transfer_dismissals" ("profile_id", "outflow_transaction_id", "inflow_transaction_id");

-- The pair index above leads with (profile_id, outflow_transaction_id), so it
-- already covers finance_transfer_dismissals_profile_outflow_fkey. This one
-- covers finance_transfer_dismissals_profile_inflow_fkey, in the FK's own
-- column order.
CREATE INDEX IF NOT EXISTS "idx_finance_transfer_dismissals_profile_inflow"
    ON "public"."finance_transfer_dismissals" ("profile_id", "inflow_transaction_id");

ALTER TABLE "public"."finance_transfer_dismissals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_transfer_dismissals"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- Least privilege: anon holds no grant of any kind -- this is a finance_* table,
-- and a fresh build starts from the image's default of ALL, so both REVOKEs
-- below are load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_transfer_dismissals" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_transfer_dismissals" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_dismissals" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_dismissals" IS
    'User-rejected candidate pairs from transfer detection: a person looked at this outflow/inflow pair and said it is not a transfer. Records a rejection only -- changes no figure, no balance, no total. A dismissed pair is simply never proposed again by src/lib/finance/transfer-detection.ts.';

-- A person's verdict on ONE transaction that looks like a transfer but has
-- no matching leg in the ledger -- money sent to, or received from, an
-- account that is not tracked here, or a payment to another person that
-- merely looks like a transfer. Distinct from finance_transfer_links (a
-- confirmed pair) and finance_transfer_dismissals (a rejected pair) above:
-- both of those are about two transactions. This table is about one
-- transaction that never had a second leg to pair against. Same
-- composite-FK, profile-scoped shape as both -- see finance_transfer_links
-- above for the cross-profile reasoning.

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

CREATE POLICY "Admin Only" ON "public"."finance_transfer_single_legs"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- Least privilege: anon holds no grant of any kind -- this is a finance_* table,
-- and a fresh build starts from the image's default of ALL, so both REVOKEs
-- below are load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_transfer_single_legs" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_transfer_single_legs" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_transfer_single_legs" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transfer_single_legs" TO "service_role";

COMMENT ON TABLE "public"."finance_transfer_single_legs" IS
    'A person''s verdict on one transaction that looks like a transfer but has no matching leg in the ledger. ''internal'' means the row moved money to or from an account of the owner''s that is not tracked here, and it is excluded from income and spending totals exactly as both legs of a confirmed finance_transfer_links pair are. ''external'' means the person said it is real spending or income -- it changes no figure and only stops the row being proposed again. Never inferred automatically.';

COMMENT ON COLUMN "public"."finance_transfer_single_legs"."verdict" IS
    'internal = excluded from income/spending totals like a confirmed transfer leg; external = real spending or income, changes no figure.';

-- Tables created by migrations and carried here since 2026-10-24
--
-- Six tables that existed in the database, created by the migration named
-- above each block, before this file described them. Each block is the live
-- definition, not a new one, apart from authenticated's grant, which is the
-- narrowed one described below.
--
-- Position matters: the foreign keys reference finance_profiles,
-- finance_debts (profile_id, id), finance_bank_accounts (id, profile_id) and
-- finance_transactions (profile_id, id), so this section follows all of them.
-- finance_debts_profile_id_id_key is declared beside finance_debts_pkey above.
-- The other two composite keys, finance_bank_accounts_id_profile_id_key and
-- idx_finance_transactions_profile_id_id, are still created only by migrations
-- (20260910074712_finance_investment_holdings.sql and
-- 20260909155110_payslip_transaction_reconciliations.sql) and are not yet
-- declared in this file.
--
-- authenticated holds SELECT, INSERT, UPDATE, DELETE on all six, as in the
-- finance_transfer_* blocks above. The live grant was ALL (TRUNCATE included,
-- which RLS does not govern); 20261024150000_authenticated_grants_least_privilege.sql
-- narrows it. For finance_merchant_logos, anon's revoke and the policy are
-- 20261024140000_merchant_logo_index_admin_only.sql.
--
-- Known gap, an open line in REHAUL_PLAN.md rather than fixed here (fixing it
-- changes the database, which this section does not): the two composite keys
-- above that migrations create and this file does not yet declare.
-- finance_debt_observations.debt_id is no longer a gap: its foreign key is
-- composite (20261025090000_debt_observations_profile_scoped_fk.sql).

-- Debt balance observations (20260907230000_finance_debt_observations.sql).
-- Anchors a loan balance to a known date -- a statement date or a portal
-- check -- so a projection steps forward from evidence rather than from a
-- mutable floating number. statement_date matters for Student Loans Company
-- balances, whose annual statements reflect a March/April balance and lag
-- portal checks by up to 18 months; the app reads NULL as observed_on.

CREATE TABLE IF NOT EXISTS "public"."finance_debt_observations" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "debt_id" "text" NOT NULL,
    "observed_on" "date" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "statement_date" "date",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_debt_observations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Composite so a reading can never name another profile's debt, or a shared
-- default (profile_id NULL, which never matches). profile_id and debt_id are both
-- NOT NULL, so MATCH SIMPLE binds them. Column order matches
-- idx_debt_observations_profile_debt below, which covers the cascade lookup.
ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_profile_debt_fkey"
    FOREIGN KEY ("profile_id", "debt_id")
    REFERENCES "public"."finance_debts"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_balance_check" CHECK ("balance" >= 0);

ALTER TABLE ONLY "public"."finance_debt_observations"
    ADD CONSTRAINT "finance_debt_observations_source_check"
    CHECK ("source" IN ('manual', 'statement', 'provider'));

-- Also covers finance_debt_observations_profile_debt_fkey (ON DELETE CASCADE):
-- its leading columns are the key's, so deleting a debt finds the readings to
-- cascade to through it. The single-column idx_finance_debt_observations_debt_id
-- that covered the old one-column key is dropped as redundant.
CREATE INDEX "idx_debt_observations_profile_debt"
    ON "public"."finance_debt_observations" ("profile_id", "debt_id", "observed_on" DESC);

ALTER TABLE "public"."finance_debt_observations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_debt_observations"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- A fresh build starts from the image's default of ALL, so the REVOKE below is
-- load-bearing, not decorative.
REVOKE ALL ON TABLE "public"."finance_debt_observations" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_debt_observations" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_debt_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_debt_observations" TO "service_role";

-- Current investment positions (20260910074712_finance_investment_holdings.sql,
-- 20260910122724_investment_holding_account_index.sql,
-- 20260910123738_investment_holding_price_facts.sql). finance_bank_accounts
-- already represents a broker or exchange account when type = 'investment';
-- these are the individual positions in it. The link to an account is
-- optional, because an asset can be recorded before its broker account is
-- added, but the composite foreign key means it can never point at another
-- profile's account. Deleting the account clears account_id only, never
-- profile_id.

CREATE TABLE IF NOT EXISTS "public"."finance_investment_holdings" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "account_id" "text",
    "name" "text" NOT NULL,
    "ticker" "text",
    "shares" numeric NOT NULL,
    "avg_price" numeric NOT NULL,
    "current_price" numeric NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cost_basis_known" boolean DEFAULT true NOT NULL,
    "current_price_known" boolean DEFAULT true NOT NULL
);

ALTER TABLE "public"."finance_investment_holdings" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Relies on the unique constraint finance_bank_accounts_id_profile_id_key.
ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_account_profile_fkey"
    FOREIGN KEY ("account_id", "profile_id")
    REFERENCES "public"."finance_bank_accounts"("id", "profile_id") ON DELETE SET NULL ("account_id");

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_shares_check" CHECK ("shares" > 0);

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_avg_price_check" CHECK ("avg_price" >= 0);

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_current_price_check" CHECK ("current_price" >= 0);

ALTER TABLE ONLY "public"."finance_investment_holdings"
    ADD CONSTRAINT "finance_investment_holdings_category_check"
    CHECK ("category" IN ('Stock', 'ETF', 'Crypto', 'Mutual Fund', 'Real Estate', 'Cash', 'Other'));

CREATE INDEX "idx_finance_investment_holdings_profile_id"
    ON "public"."finance_investment_holdings" ("profile_id");

-- Covers the composite account foreign key, so deleting an account does not
-- scan every holding.
CREATE INDEX "idx_finance_investment_holdings_account_profile"
    ON "public"."finance_investment_holdings" ("account_id", "profile_id");

ALTER TABLE "public"."finance_investment_holdings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_investment_holdings"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_investment_holdings" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_investment_holdings" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_investment_holdings" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_investment_holdings" TO "service_role";

COMMENT ON TABLE "public"."finance_investment_holdings" IS
    'Current investment positions, scoped to a finance profile. Prices and quantities are entered or imported; portfolio totals are computed in the app.';

COMMENT ON COLUMN "public"."finance_investment_holdings"."cost_basis_known" IS
    'Whether avg_price is a known GBP cost basis. False means it must not contribute to gain/loss calculations.';

COMMENT ON COLUMN "public"."finance_investment_holdings"."current_price_known" IS
    'Whether current_price is a known GBP valuation. False means it must not contribute to value calculations.';

-- Confirmed broker and exchange activity (20260910124547_investment_activity_history.sql).
-- The original CSV stays in the browser; this ledger keeps only the facts a
-- personal finance timeline and re-import identity need. The unique key on
-- (profile_id, account_id, provider, source_reference) is that identity: a
-- re-imported row matches the one already stored.

CREATE TABLE IF NOT EXISTS "public"."finance_investment_activities" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "account_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "activity_type" "text" NOT NULL,
    "occurred_on" "date" NOT NULL,
    "name" "text" NOT NULL,
    "ticker" "text",
    "quantity" numeric NOT NULL,
    "unit_price_gbp" numeric,
    "source_reference" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_investment_activities" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Relies on the unique constraint finance_bank_accounts_id_profile_id_key.
ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_account_profile_fkey"
    FOREIGN KEY ("account_id", "profile_id")
    REFERENCES "public"."finance_bank_accounts"("id", "profile_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_provider_check"
    CHECK ("provider" IN ('trading212', 'kraken'));

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_activity_type_check"
    CHECK ("activity_type" IN ('buy', 'sell'));

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_name_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_unit_price_gbp_check"
    CHECK ("unit_price_gbp" IS NULL OR "unit_price_gbp" >= 0);

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_source_reference_check"
    CHECK (length(btrim("source_reference")) > 0);

ALTER TABLE ONLY "public"."finance_investment_activities"
    ADD CONSTRAINT "finance_investment_activities_source_unique"
    UNIQUE ("profile_id", "account_id", "provider", "source_reference");

-- Leads with account_id to cover the composite account foreign key; the
-- unique key above leads with profile_id and serves the profile-scoped lookup.
CREATE INDEX "idx_finance_investment_activities_account_profile_occurred_on"
    ON "public"."finance_investment_activities" ("account_id", "profile_id", "occurred_on" DESC);

ALTER TABLE "public"."finance_investment_activities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_investment_activities"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_investment_activities" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_investment_activities" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_investment_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_investment_activities" TO "service_role";

COMMENT ON TABLE "public"."finance_investment_activities" IS
    'Confirmed buy and sell activity imported locally from supported broker/exchange CSV files; original exports are not stored.';

-- Index of cached merchant logos (20260907170100_merchant_logo_cache.sql).
-- A row says this slug has a logo at this path in the public merchant-logos
-- bucket; no row means fall through to the monogram. A NULL storage_path is a
-- recorded miss, so the resolver does not retry a merchant it could not find.
-- There is no profile_id, but it is not free of user data: merchant-logo-cache
-- only resolves brands found in finance_transactions, so the set of slugs, and
-- each resolved_at, says which directory brands the owner has paid and roughly
-- when they first appeared. Read and write are therefore admin-only (below).
-- The images themselves stay publicly fetchable by URL, which needs no policy.

CREATE TABLE IF NOT EXISTS "public"."finance_merchant_logos" (
    "slug" "text" NOT NULL,
    "storage_path" "text",
    "source_domain" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_merchant_logos" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_merchant_logos"
    ADD CONSTRAINT "finance_merchant_logos_pkey" PRIMARY KEY ("slug");

ALTER TABLE "public"."finance_merchant_logos" ENABLE ROW LEVEL SECURITY;

-- The only policy, so read is admin-only: the slugs say which brands the owner
-- pays (see the table comment above), and the only reader in the app is
-- admin-gated. No FOR clause, so it covers every command, and the is_admin()
-- condition gates all of them. The name predates it being the only read path.
CREATE POLICY "Admin writes merchant logo index" ON "public"."finance_merchant_logos"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

-- anon holds nothing: a grant is a layer of its own beside RLS, and TRUNCATE is
-- not filtered by RLS at all.
REVOKE ALL ON TABLE "public"."finance_merchant_logos" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_merchant_logos" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_merchant_logos" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_merchant_logos" TO "service_role";

COMMENT ON TABLE "public"."finance_merchant_logos" IS
    'Index of cached merchant logos in the merchant-logos bucket. A row with a NULL storage_path is a recorded miss, so the resolver stops re-fetching a merchant whose logo could not be found.';

-- Payslips, captured as figures rather than sent anywhere
-- (20260907160000_finance_payslips.sql and the payslip_* migrations after it).
-- The PDF is an archive in the private finance-documents bucket, pointed at by
-- storage_path and nullable because a payslip typed in by hand is a complete
-- record on its own; the app renders its own view from the columns. The
-- pension is split because only the employee's share is a deduction from
-- gross, and adding the two together is the classic way to make net not
-- reconcile.

CREATE TABLE IF NOT EXISTS "public"."finance_payslips" (
    "id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "pay_date" "date" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "employer" "text" DEFAULT ''::"text" NOT NULL,
    "gross" numeric DEFAULT 0 NOT NULL,
    "income_tax" numeric DEFAULT 0 NOT NULL,
    "national_insurance" numeric DEFAULT 0 NOT NULL,
    "pension_employee" numeric DEFAULT 0 NOT NULL,
    "pension_employer" numeric DEFAULT 0 NOT NULL,
    "student_loan" numeric DEFAULT 0 NOT NULL,
    "other_deductions" numeric DEFAULT 0 NOT NULL,
    "net" numeric DEFAULT 0 NOT NULL,
    "storage_path" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lines" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);

ALTER TABLE "public"."finance_payslips" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- Only what genuinely cannot be negative is constrained; see the comment on
-- the constraint itself.
ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_non_negative_check"
    CHECK (("gross" >= 0) AND ("pension_employee" >= 0) AND ("pension_employer" >= 0));

ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_period_check"
    CHECK (("period_start" IS NULL) OR ("period_end" IS NULL) OR ("period_start" <= "period_end"));

-- Kept deliberately loose: a payslip may list anything, and a CHECK
-- enumerating today's labels would reject tomorrow's.
ALTER TABLE ONLY "public"."finance_payslips"
    ADD CONSTRAINT "finance_payslips_lines_is_array" CHECK (jsonb_typeof("lines") = 'array');

-- A pay date alone does not identify a payslip: overlapping employment gives
-- two on the same day, and the second write would replace the first. employer
-- is NOT NULL DEFAULT '' rather than nullable so the client's lookup by
-- profile_id, employer and pay_date matches exactly (employer '' included), and
-- this plain unique index blocks a second row for the same three.
CREATE UNIQUE INDEX "idx_finance_payslips_profile_employer_pay_date"
    ON "public"."finance_payslips" ("profile_id", "employer", "pay_date");

-- Exists so the reconciliation table below can reference (profile_id, id)
-- and keep a payslip and its linked transaction in one profile.
CREATE UNIQUE INDEX "idx_finance_payslips_profile_id_id"
    ON "public"."finance_payslips" ("profile_id", "id");

ALTER TABLE "public"."finance_payslips" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_payslips"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_payslips" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_payslips" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_payslips" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payslips" TO "service_role";

COMMENT ON COLUMN "public"."finance_payslips"."lines" IS
    'Line items as the payslip states them: [{ label, amount, kind }], where kind is payment | deduction | benefit. A benefit is a sacrifice taken from the pay column -- pension, a gym membership -- which reduces pay without appearing under deductions. Empty when a payslip was captured by hand.';

COMMENT ON CONSTRAINT "finance_payslips_non_negative_check" ON "public"."finance_payslips" IS
    'Income tax, National Insurance, student loan, other deductions and net are deliberately unconstrained: each can legitimately be negative when a refund or an adjustment runs through payroll.';

-- A confirmed link between a payslip's take-home figure and the incoming bank
-- transaction (20260909155110_payslip_transaction_reconciliations.sql,
-- 20260910054857_payslip_reconciliation_fk_indexes.sql). Suggestions are
-- computed in the browser; this table holds only a person's explicit
-- confirmation, never an uncertain automatic match.
--
-- The composite foreign keys make a cross-profile link impossible at the
-- database layer. They rely on idx_finance_payslips_profile_id_id above and on
-- idx_finance_transactions_profile_id_id. The two foreign key names below are
-- the 63-byte truncations Postgres stored, written out in full so they match.

CREATE TABLE IF NOT EXISTS "public"."finance_payslip_transaction_reconciliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "payslip_id" "text" NOT NULL,
    "transaction_id" "text" NOT NULL,
    "confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_payslip_transaction_reconciliations" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_payslip_fke"
    FOREIGN KEY ("profile_id", "payslip_id")
    REFERENCES "public"."finance_payslips"("profile_id", "id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_payslip_transaction_reconciliations"
    ADD CONSTRAINT "finance_payslip_transaction_reconciliations_profile_transaction"
    FOREIGN KEY ("profile_id", "transaction_id")
    REFERENCES "public"."finance_transactions"("profile_id", "id") ON DELETE CASCADE;

-- A payslip is one payment and a transaction is one receipt, so neither side
-- can be confirmed twice. Each leads with profile_id so it also covers the
-- matching composite foreign key's cascade lookup.
CREATE UNIQUE INDEX "idx_finance_payslip_reconciliation_profile_payslip"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id", "payslip_id");

CREATE UNIQUE INDEX "idx_finance_payslip_reconciliation_profile_transaction"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id", "transaction_id");

CREATE INDEX "idx_finance_payslip_reconciliation_profile"
    ON "public"."finance_payslip_transaction_reconciliations" ("profile_id");

ALTER TABLE "public"."finance_payslip_transaction_reconciliations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_payslip_transaction_reconciliations"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_payslip_transaction_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_payslip_transaction_reconciliations" TO "service_role";

COMMENT ON TABLE "public"."finance_payslip_transaction_reconciliations" IS
    'User-confirmed, one-to-one links between a payslip take-home figure and its incoming finance transaction.';

-- Merchant pattern matching rules for transaction categorisation and renaming
-- (20261029230000_finance_category_rules.sql).
CREATE TABLE IF NOT EXISTS "public"."finance_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "merchant_pattern" "text" NOT NULL,
    "category" "text" NOT NULL,
    "rename_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_category_rules" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_pattern_not_empty"
    CHECK (length(trim("merchant_pattern")) > 0);

ALTER TABLE ONLY "public"."finance_category_rules"
    ADD CONSTRAINT "finance_category_rules_category_not_empty"
    CHECK (length(trim("category")) > 0);

CREATE INDEX IF NOT EXISTS "idx_finance_category_rules_profile_id"
    ON "public"."finance_category_rules" ("profile_id");

ALTER TABLE "public"."finance_category_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_category_rules"
    TO "authenticated"
    USING ((SELECT "public"."is_admin"()))
    WITH CHECK ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."finance_category_rules" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_category_rules" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_category_rules" TO "service_role";

COMMENT ON TABLE "public"."finance_category_rules" IS
    'User-defined merchant pattern matching rules for automated transaction categorisation and merchant renaming, scoped to a finance profile.';


-- Triggers live here rather than with the function in 01_functions.sql:
-- schema files run in filename order, so the tables must exist first.
--
-- Stops rows of the profile tables below from silently changing owner through
-- the shared PRIMARY KEY (id) those tables use across every profile and the
-- shared default rows. See finance_keep_row_scope() (01_functions.sql),
-- 20260927192100_finance_row_scope_immutable.sql and
-- 20260930072505_finance_row_scope_more_tables.sql for the full reasoning,
-- including why a composite key is not an option here and how a genuine
-- future re-home must disable this trigger around that one statement.
--
-- Plain BEFORE UPDATE, not UPDATE OF <cols>: a PostgREST upsert sets every
-- supplied column on conflict, so UPDATE OF would still fire in the case
-- that matters, but plain BEFORE UPDATE also catches a future direct SQL
-- UPDATE that touches these columns without going through the client's
-- upsert shape.

DROP TRIGGER IF EXISTS "tr_finance_budget_categories_keep_scope" ON "public"."finance_budget_categories";
CREATE TRIGGER "tr_finance_budget_categories_keep_scope"
    BEFORE UPDATE ON "public"."finance_budget_categories"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_budget_items_keep_scope" ON "public"."finance_budget_items";
CREATE TRIGGER "tr_finance_budget_items_keep_scope"
    BEFORE UPDATE ON "public"."finance_budget_items"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_recurring_bills_keep_scope" ON "public"."finance_recurring_bills";
CREATE TRIGGER "tr_finance_recurring_bills_keep_scope"
    BEFORE UPDATE ON "public"."finance_recurring_bills"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_settings_keep_scope" ON "public"."finance_settings";
CREATE TRIGGER "tr_finance_settings_keep_scope"
    BEFORE UPDATE ON "public"."finance_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_goals_keep_scope" ON "public"."finance_goals";
CREATE TRIGGER "tr_finance_goals_keep_scope"
    BEFORE UPDATE ON "public"."finance_goals"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_goal_contributions_keep_scope" ON "public"."finance_goal_contributions";
CREATE TRIGGER "tr_finance_goal_contributions_keep_scope"
    BEFORE UPDATE ON "public"."finance_goal_contributions"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_memberships_keep_scope" ON "public"."finance_memberships";
CREATE TRIGGER "tr_finance_memberships_keep_scope"
    BEFORE UPDATE ON "public"."finance_memberships"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_debts_keep_scope" ON "public"."finance_debts";
CREATE TRIGGER "tr_finance_debts_keep_scope"
    BEFORE UPDATE ON "public"."finance_debts"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_credit_scores_keep_scope" ON "public"."finance_credit_scores";
CREATE TRIGGER "tr_finance_credit_scores_keep_scope"
    BEFORE UPDATE ON "public"."finance_credit_scores"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_user_holidays_keep_scope" ON "public"."finance_user_holidays";
CREATE TRIGGER "tr_finance_user_holidays_keep_scope"
    BEFORE UPDATE ON "public"."finance_user_holidays"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();
