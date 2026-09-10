-- Covers the composite broker/exchange account foreign key. This keeps
-- account deletion and referential checks from scanning every holding.
CREATE INDEX "idx_finance_investment_holdings_account_profile"
    ON "public"."finance_investment_holdings" ("account_id", "profile_id");
