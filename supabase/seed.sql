-- Local test fixture: an administrator account to sign in as.
--
-- Runs on `supabase db reset`, after migrations. Never on production -- see
-- the guard below, which is the reason this file can name a password in plain
-- text.
--
-- Deliberately small. The synthetic ledger already exists: migration
-- 20260907090000_demo_profile.sql creates the `Demo` profile and fills it with
-- invented accounts, budgets, bills, goals and a month of transactions. There
-- is no reason for a second fixture alongside it, so this file adds only what
-- was actually missing for an automated smoke test:
--
--   1. An account that can sign in, since every password on this site is one
--      person's and cannot be shared with a test run.
--   2. The administrator grant for it, without which it signs in and is denied
--      by every policy.
--   3. A tax configuration, because nothing else inserts one. With the table
--      empty the app falls back to EMPTY_TAX_CONFIG and reports take-home as
--      gross -- a wrong number rather than an error, which is the worst kind
--      to smoke-test against.

BEGIN;

-- ---------------------------------------------------------------------------
-- Guard
--
-- A seed that creates an administrator must never reach a database holding
-- real accounts. The test is whether any account exists at all: a fresh local
-- stack has none, and every other database this could be pointed at has at
-- least the owner's.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_users integer;
BEGIN
    SELECT count(*) INTO v_users FROM auth.users;
    IF v_users > 0 THEN
        RAISE EXCEPTION
            'Refusing to seed: auth.users already holds % account(s), so this is not a fresh local database. This file creates an administrator and must never run anywhere real.', v_users;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- The test account
--
-- Fixed uuid so a test can assert against it. The address is under `.test`,
-- which RFC 2606 reserves and which therefore cannot be registered or receive
-- mail.
--
-- Password: local-test-only-password
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000001',
    'authenticated',
    'authenticated',
    'agent@localhost.test',
    extensions.crypt('local-test-only-password', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    -- GoTrue reads these as strings rather than nulls; leaving them NULL makes
    -- the sign-in path fail with an error that does not mention the column.
    '',
    '',
    '',
    ''
);

INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    '{"sub":"00000000-0000-4000-a000-000000000001","email":"agent@localhost.test","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
);

-- The grant. Without this the account signs in and is denied by every policy,
-- which is the correct default and also exactly the situation this file exists
-- to resolve.
INSERT INTO public.admin_users (user_id, email, note)
VALUES (
    '00000000-0000-4000-a000-000000000001',
    'agent@localhost.test',
    'Local test fixture. Created by supabase/seed.sql; never present on a database with real accounts.'
);

-- ---------------------------------------------------------------------------
-- Tax configuration
--
-- The published 2026/27 England and Wales figures, so the seeded take-home is
-- checkable by hand. `is_default` marks it as the shipped rate set rather than
-- an override the user has edited.
-- ---------------------------------------------------------------------------
INSERT INTO public.finance_tax_configs (
    id, is_default, effective_from,
    student_loan_thresholds, student_loan_rates,
    income_tax_bands, national_insurance_bands
) VALUES (
    'seed_tax_2026_27',
    true,
    DATE '2026-04-06',
    '{"none":0,"plan1":26065,"plan2":28470,"plan4":32745,"plan5":25000,"postgrad":21000}'::jsonb,
    -- Fractions, not percentages. finance-calcs.ts multiplies this rate
    -- directly (`(gross - threshold) * rate`), unlike every band beside it,
    -- which carries a `...Percent` name and is divided by 100 at the point of
    -- use. Seeding 9 here deducts nine times the salary above the threshold
    -- and reports take-home as a large negative number.
    '{"none":0,"plan1":0.09,"plan2":0.09,"plan4":0.09,"plan5":0.09,"postgrad":0.06}'::jsonb,
    '{"basicRateLimit":50270,"higherRateLimit":125140,"basicRatePercent":20,"higherRatePercent":40,"additionalRatePercent":45}'::jsonb,
    '{"lowerThreshold":12570,"upperThreshold":50270,"mainRatePercent":8,"upperRatePercent":2}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Ownership
--
-- The Demo profile is what a test run should be looking at, so the test
-- account owns it. The `Dhyan` self profile that migration
-- 20260906120000_finance_profiles.sql creates is left unowned and empty here;
-- on a local stack it holds nothing, because the ledger it represents lives
-- only in production.
-- ---------------------------------------------------------------------------
UPDATE public.finance_profiles
SET owner_user_id = '00000000-0000-4000-a000-000000000001'
WHERE name = 'Demo';

COMMIT;
