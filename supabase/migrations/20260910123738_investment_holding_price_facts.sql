-- An imported activity export may establish cost but not a current price; a
-- balances snapshot is the inverse. Keep those facts explicit so portfolio
-- totals never present a missing value as £0.00 or a made-up gain/loss.

BEGIN;

ALTER TABLE "public"."finance_investment_holdings"
    ADD COLUMN "cost_basis_known" boolean NOT NULL DEFAULT true,
    ADD COLUMN "current_price_known" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "public"."finance_investment_holdings"."cost_basis_known" IS
    'Whether avg_price is a known GBP cost basis. False means it must not contribute to gain/loss calculations.';

COMMENT ON COLUMN "public"."finance_investment_holdings"."current_price_known" IS
    'Whether current_price is a known GBP valuation. False means it must not contribute to value calculations.';

COMMIT;
