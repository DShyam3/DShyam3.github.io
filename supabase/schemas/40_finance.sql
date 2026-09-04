CREATE TABLE IF NOT EXISTS "public"."finance_bank_accounts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
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
    "name" "text" NOT NULL,
    "target_amount" numeric DEFAULT 0 NOT NULL,
    "current_amount" numeric DEFAULT 0 NOT NULL,
    "target_date" "date",
    "start_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "emoji" "text"
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
    "account_id" "text"
);

ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_truelayer_connection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_truelayer_connection" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."finance_user_holidays" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "occasion" "text",
    "count" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_user_holidays" OWNER TO "postgres";

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

ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_finance_budget_items_category_id" ON "public"."finance_budget_items" USING "btree" ("category_id");

CREATE INDEX "idx_finance_goal_contributions_goal_id" ON "public"."finance_goal_contributions" USING "btree" ("goal_id");

CREATE INDEX "idx_finance_transactions_account_id" ON "public"."finance_transactions" USING "btree" ("account_id");

ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_budget_categories"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."finance_goals"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."finance_bank_accounts"("id") ON DELETE SET NULL;

CREATE POLICY "Admin All Access" ON "public"."finance_truelayer_connection" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

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
  "public"."finance_user_holidays"
FROM "anon";

REVOKE ALL ON TABLE "public"."finance_debts" FROM "anon";
