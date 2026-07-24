-- Migration to add status and emoji to finance_goals table
ALTER TABLE public.finance_goals
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS emoji TEXT;
