-- Durable, profile-scoped investment positions.
--
-- `finance_bank_accounts` already represents broker/exchange accounts when
-- type = 'investment'. Holdings are their individual positions. Linking the
-- two is optional because a user may want to record an asset before adding
-- its broker account, but a link can never point at another profile's account.

BEGIN;

ALTER TABLE "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_id_profile_id_key"
    UNIQUE ("id", "profile_id");

CREATE TABLE "public"."finance_investment_holdings" (
    "id" text NOT NULL,
    "profile_id" uuid NOT NULL,
    "account_id" text,
    "name" text NOT NULL,
    "ticker" text,
    "shares" numeric NOT NULL,
    "avg_price" numeric NOT NULL,
    "current_price" numeric NOT NULL,
    "category" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "finance_investment_holdings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_investment_holdings_name_check"
        CHECK (length(btrim("name")) > 0),
    CONSTRAINT "finance_investment_holdings_shares_check"
        CHECK ("shares" > 0),
    CONSTRAINT "finance_investment_holdings_avg_price_check"
        CHECK ("avg_price" >= 0),
    CONSTRAINT "finance_investment_holdings_current_price_check"
        CHECK ("current_price" >= 0),
    CONSTRAINT "finance_investment_holdings_category_check"
        CHECK ("category" IN ('Stock', 'ETF', 'Crypto', 'Mutual Fund', 'Real Estate', 'Cash', 'Other')),
    CONSTRAINT "finance_investment_holdings_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "finance_investment_holdings_account_profile_fkey"
        FOREIGN KEY ("account_id", "profile_id")
        REFERENCES "public"."finance_bank_accounts"("id", "profile_id")
        ON DELETE SET NULL ("account_id")
);

CREATE INDEX "idx_finance_investment_holdings_profile_id"
    ON "public"."finance_investment_holdings" ("profile_id");

ALTER TABLE "public"."finance_investment_holdings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only"
    ON "public"."finance_investment_holdings"
    TO authenticated
    USING ("public"."is_admin"())
    WITH CHECK ("public"."is_admin"());

REVOKE ALL ON TABLE "public"."finance_investment_holdings" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."finance_investment_holdings" TO authenticated;
GRANT ALL ON TABLE "public"."finance_investment_holdings" TO service_role;

COMMENT ON TABLE "public"."finance_investment_holdings" IS
    'Current investment positions, scoped to a finance profile. Prices and quantities are entered or imported; portfolio totals are computed in the app.';

COMMIT;
