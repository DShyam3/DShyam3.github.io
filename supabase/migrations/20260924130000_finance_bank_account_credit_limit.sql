-- Credit utilisation guidance (REHAUL_PLAN.md 7.L) needs each card's limit
-- to weigh balance against, and nothing stored it until now.
--
-- Nullable by design: not every credit card in the app is bank-synced, and
-- not every synced card reports a limit. NULL means "unknown", so the
-- utilisation calculation can skip a card rather than treat it as maxed out.
-- Meaningful only for type = 'credit'; left unused (and unenforced -- the
-- CHECK below allows it) on every other account type.

BEGIN;

ALTER TABLE "public"."finance_bank_accounts"
    ADD COLUMN IF NOT EXISTS "credit_limit" numeric;

ALTER TABLE ONLY "public"."finance_bank_accounts"
    DROP CONSTRAINT IF EXISTS "finance_bank_accounts_credit_limit_check";

ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_credit_limit_check"
    CHECK (("credit_limit" IS NULL) OR ("credit_limit" >= (0)::numeric));

COMMENT ON COLUMN "public"."finance_bank_accounts"."credit_limit" IS
    'The card''s credit limit in GBP. For bank-synced cards, truelayer-sync writes it from TrueLayer''s card balance `credit_limit` whenever the bank returns one; otherwise the owner enters it. NULL means the limit is unknown, not zero -- a card with no known limit is left out of credit utilisation rather than counted as fully used. Meaningful only for type ''credit''.';

COMMIT;
