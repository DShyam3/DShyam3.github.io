CREATE TABLE IF NOT EXISTS "public"."finance_bank_accounts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "issuer" "text",
    "balance" numeric DEFAULT 0 NOT NULL,
    "annual_fee" numeric DEFAULT 0 NOT NULL,
    "use_case" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_bank_accounts" OWNER TO "postgres";

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_budget_items" OWNER TO "postgres";

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_recurring_bills" OWNER TO "postgres";

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_settings" OWNER TO "postgres";

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
    "provider_transaction_id" "text"
);

ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_user_holidays" OWNER TO "postgres";

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

CREATE POLICY "Admin All Access" ON "public"."finance_truelayer_connection" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_truelayer_oauth_states" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_bank_accounts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_budget_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_budget_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_budget_presets" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_credit_bureaus" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_credit_scores" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_data" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_debts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_defaults" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_goal_contributions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_goals" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_holiday_defaults" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_memberships" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_recurring_bills" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_recurring_templates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_tax_configs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_transactions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin Only" ON "public"."finance_user_holidays" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

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

ALTER TABLE "public"."finance_tax_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_connection" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_source_sync" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_truelayer_oauth_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."finance_user_holidays" ENABLE ROW LEVEL SECURITY;

-- Grants

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_bank_accounts" TO "anon";

GRANT ALL ON TABLE "public"."finance_bank_accounts" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_bank_accounts" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_categories" TO "anon";

GRANT ALL ON TABLE "public"."finance_budget_categories" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_categories" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_items" TO "anon";

GRANT ALL ON TABLE "public"."finance_budget_items" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_items" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_presets" TO "anon";

GRANT ALL ON TABLE "public"."finance_budget_presets" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_budget_presets" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_credit_bureaus" TO "anon";

GRANT ALL ON TABLE "public"."finance_credit_bureaus" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_credit_bureaus" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_credit_scores" TO "anon";

GRANT ALL ON TABLE "public"."finance_credit_scores" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_credit_scores" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_data" TO "anon";

GRANT ALL ON TABLE "public"."finance_data" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_data" TO "service_role";

GRANT ALL ON TABLE "public"."finance_debts" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_debts" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_defaults" TO "anon";

GRANT ALL ON TABLE "public"."finance_defaults" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_defaults" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_goal_contributions" TO "anon";

GRANT ALL ON TABLE "public"."finance_goal_contributions" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_goal_contributions" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_goals" TO "anon";

GRANT ALL ON TABLE "public"."finance_goals" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_goals" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_holiday_defaults" TO "anon";

GRANT ALL ON TABLE "public"."finance_holiday_defaults" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_holiday_defaults" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_memberships" TO "anon";

GRANT ALL ON TABLE "public"."finance_memberships" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_memberships" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_recurring_bills" TO "anon";

GRANT ALL ON TABLE "public"."finance_recurring_bills" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_recurring_bills" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_recurring_templates" TO "anon";

GRANT ALL ON TABLE "public"."finance_recurring_templates" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_recurring_templates" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_settings" TO "anon";

GRANT ALL ON TABLE "public"."finance_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_settings" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_tax_configs" TO "anon";

GRANT ALL ON TABLE "public"."finance_tax_configs" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_tax_configs" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_transactions" TO "anon";

GRANT ALL ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_transactions" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_truelayer_connection" TO "anon";

GRANT ALL ON TABLE "public"."finance_truelayer_connection" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_truelayer_connection" TO "service_role";

GRANT ALL ON TABLE "public"."finance_truelayer_source_sync" TO "service_role";

GRANT ALL ON TABLE "public"."finance_truelayer_oauth_states" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_truelayer_oauth_states" TO "service_role";

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_user_holidays" TO "anon";

GRANT ALL ON TABLE "public"."finance_user_holidays" TO "authenticated";

GRANT ALL ON TABLE "public"."finance_user_holidays" TO "service_role";

-- Revoked privileges
--
-- pg_dump emits GRANT but never REVOKE, so these have to be stated explicitly
-- or the differ will try to hand `anon` back its SELECT on every finance table
-- (including finance_truelayer_connection, which holds live bank tokens).
--
-- The inconsistency is real and preserved: finance_debts has every anon
-- privilege revoked, the rest only SELECT. See S-10 in REHAUL_PLAN.md.

REVOKE SELECT ON TABLE
  "public"."finance_bank_accounts",
  "public"."finance_budget_categories",
  "public"."finance_budget_items",
  "public"."finance_budget_presets",
  "public"."finance_credit_bureaus",
  "public"."finance_credit_scores",
  "public"."finance_data",
  "public"."finance_defaults",
  "public"."finance_goal_contributions",
  "public"."finance_goals",
  "public"."finance_holiday_defaults",
  "public"."finance_memberships",
  "public"."finance_recurring_bills",
  "public"."finance_recurring_templates",
  "public"."finance_settings",
  "public"."finance_tax_configs",
  "public"."finance_transactions",
  "public"."finance_truelayer_connection",
  "public"."finance_truelayer_source_sync",
  "public"."finance_user_holidays"
FROM "anon";

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

-- profile_id is NULL exactly when the row is a shared template (is_default).

ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
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
CREATE INDEX "idx_finance_debts_profile_id" ON "public"."finance_debts" ("profile_id");

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
CREATE INDEX "idx_finance_settings_profile_id" ON "public"."finance_settings" ("profile_id");

ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
CREATE INDEX "idx_finance_transactions_profile_id" ON "public"."finance_transactions" ("profile_id");

ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_profile_scope_check" CHECK (("is_default" AND "profile_id" IS NULL) OR (NOT "is_default" AND "profile_id" IS NOT NULL));
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

CREATE POLICY "Admin Only" ON "public"."finance_profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());
CREATE POLICY "Admin Only" ON "public"."finance_profile_transfers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- S-10: anon needs nothing on any finance table. Re-asserted here because
-- Supabase's ALTER DEFAULT PRIVILEGES re-grants on every newly created table.
REVOKE ALL ON "public"."finance_profiles" FROM "anon";
REVOKE ALL ON "public"."finance_profile_transfers" FROM "anon";

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
    USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());
CREATE POLICY "Admin Only" ON "public"."finance_account_balance_snapshots" TO "authenticated"
    USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

REVOKE ALL ON "public"."finance_net_worth_snapshots" FROM "anon";
REVOKE ALL ON "public"."finance_account_balance_snapshots" FROM "anon";

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
         COALESCE(acc.assets, 0),
         COALESCE(acc.overdrawn, 0) + COALESCE(d.debt, 0),
         COALESCE(acc.assets, 0) - (COALESCE(acc.overdrawn, 0) + COALESCE(d.debt, 0))
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
