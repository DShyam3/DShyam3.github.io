-- Phase 7.1 -- profiles.
--
-- One operator (the admin) configuring finances for several subjects: himself,
-- family, friends. This is a scoping column, not a tenancy model: RLS stays
-- is_admin(), because there is still exactly one reader. See REHAUL_PLAN.md 7.B.
--
-- profile_id is deliberately NULLABLE. Every finance table already carries
-- is_default, which marks a template row the app clones for new data, and a
-- template belongs to no one. The CHECK constraints below make that explicit:
--   is_default = true   ->  profile_id IS NULL      (a shared template)
--   is_default = false  ->  profile_id IS NOT NULL  (someone's real data)
--
-- Five tables get no profile_id at all -- budget_presets, credit_bureaus,
-- holiday_defaults, recurring_templates and tax_configs are reference data that
-- is the same for everyone. finance_data and finance_defaults are the legacy
-- blob tables slated for removal (REHAUL_PLAN.md H-2) and are left alone.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    -- Exactly one profile is the operator's own; see the unique index below.
    "is_self" boolean DEFAULT false NOT NULL,
    -- NULL until another person is given a login of their own. When that
    -- happens the RLS policies below gain an owner clause; nothing else moves.
    "owner_user_id" "uuid",
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    -- Drives tax banding: Scotland has its own income tax rates.
    "region" "text" DEFAULT 'england-and-wales'::"text" NOT NULL,
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."finance_profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_profiles"
    ADD CONSTRAINT "finance_profiles_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "idx_finance_profiles_self"
    ON "public"."finance_profiles" ("is_self") WHERE "is_self";

ALTER TABLE "public"."finance_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_profiles" TO "authenticated"
    USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- The operator's own profile. Every existing non-template row belongs to it,
-- because until now every row implicitly meant "Dhyan".
INSERT INTO "public"."finance_profiles" ("name", "is_self", "emoji")
VALUES ('Dhyan', true, '🧍')
ON CONFLICT DO NOTHING;

-- Add the column, backfill it, then constrain -- in that order, so the CHECK
-- is never evaluated against a half-populated table.
DO $$
DECLARE
  self_id uuid;
  t text;
  -- Tables carrying is_default, so a template row is profile-less.
  scoped text[] := ARRAY[
    'finance_bank_accounts',
    'finance_budget_categories',
    'finance_budget_items',
    'finance_credit_scores',
    'finance_debts',
    'finance_goal_contributions',
    'finance_goals',
    'finance_memberships',
    'finance_recurring_bills',
    'finance_settings',
    'finance_transactions',
    'finance_user_holidays'
  ];
BEGIN
  SELECT id INTO STRICT self_id FROM public.finance_profiles WHERE is_self;

  FOREACH t IN ARRAY scoped LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS profile_id uuid', t);

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_profile_id_fkey');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (profile_id) '
      'REFERENCES public.finance_profiles(id) ON DELETE CASCADE',
      t, t || '_profile_id_fkey');

    EXECUTE format(
      'UPDATE public.%I SET profile_id = $1 WHERE profile_id IS NULL AND NOT is_default', t)
      USING self_id;
    EXECUTE format(
      'UPDATE public.%I SET profile_id = NULL WHERE is_default', t);

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_profile_scope_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK '
      '((is_default AND profile_id IS NULL) OR (NOT is_default AND profile_id IS NOT NULL))',
      t, t || '_profile_scope_check');

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (profile_id)',
      'idx_' || t || '_profile_id', t);
  END LOOP;
END $$;

-- finance_truelayer_connection has no is_default column: a bank connection is
-- never a template, so the column is plainly NOT NULL.
ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "profile_id" "uuid";

UPDATE "public"."finance_truelayer_connection"
   SET "profile_id" = (SELECT "id" FROM "public"."finance_profiles" WHERE "is_self")
 WHERE "profile_id" IS NULL;

ALTER TABLE ONLY "public"."finance_truelayer_connection"
    DROP CONSTRAINT IF EXISTS "finance_truelayer_connection_profile_id_fkey";
ALTER TABLE ONLY "public"."finance_truelayer_connection"
    ADD CONSTRAINT "finance_truelayer_connection_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."finance_truelayer_connection"
    ALTER COLUMN "profile_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_finance_truelayer_connection_profile_id"
    ON "public"."finance_truelayer_connection" ("profile_id");

-- Money moving between profiles. "I sent Mum GBP 300" is an expense in one
-- ledger and income in another; without this link net worth double-counts
-- across profiles. See REHAUL_PLAN.md 7.B.
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
    CONSTRAINT "finance_profile_transfers_distinct_check"
        CHECK ("from_profile_id" <> "to_profile_id")
);

ALTER TABLE "public"."finance_profile_transfers" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_from_profile_id_fkey"
    FOREIGN KEY ("from_profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_to_profile_id_fkey"
    FOREIGN KEY ("to_profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

-- A transaction can only be one side of one transfer.
ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_from_transaction_id_fkey"
    FOREIGN KEY ("from_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."finance_profile_transfers"
    ADD CONSTRAINT "finance_profile_transfers_to_transaction_id_fkey"
    FOREIGN KEY ("to_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_from_profile_id"
    ON "public"."finance_profile_transfers" ("from_profile_id");
CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_to_profile_id"
    ON "public"."finance_profile_transfers" ("to_profile_id");

ALTER TABLE "public"."finance_profile_transfers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_profile_transfers" TO "authenticated"
    USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

COMMIT;
