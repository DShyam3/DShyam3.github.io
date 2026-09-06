-- Phase 7.4 -- snapshots.
--
-- The finance model has only ever held current state, so "what changed this
-- month", anomaly detection and any trajectory are not merely unbuilt but
-- unbuildable: the history does not exist. Nothing here can be backfilled,
-- which is why it lands before the remaining refactors (REHAUL_PLAN.md 7.D).
--
-- Capture is a pg_cron job running plain SQL rather than an edge function,
-- because the arithmetic is a sum over two tables and needs no network. That
-- also means history accrues whether or not anyone opens the page.

BEGIN;

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

-- The job runs as postgres, so no role but the owner needs to call it.
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."capture_finance_snapshots"() FROM "authenticated";

SELECT cron.unschedule('finance-daily-snapshot')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finance-daily-snapshot');

-- 02:10 UTC: after midnight so captured_on is unambiguous, and off the hour so
-- it does not contend with the 06:00 watchlist sync.
SELECT cron.schedule(
  'finance-daily-snapshot',
  '10 2 * * *',
  $job$ SELECT public.capture_finance_snapshots(); $job$
);

-- Seed today, so the series starts now rather than tomorrow.
SELECT public.capture_finance_snapshots();

COMMIT;
