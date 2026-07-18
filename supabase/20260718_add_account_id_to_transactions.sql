-- Migration to add account_id to finance_transactions table
ALTER TABLE public.finance_transactions
ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES public.finance_bank_accounts(id) ON DELETE SET NULL;
