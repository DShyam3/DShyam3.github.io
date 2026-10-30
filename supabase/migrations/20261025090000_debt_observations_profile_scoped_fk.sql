-- Make finance_debt_observations.debt_id unable to point at another profile's
-- debt. Owner decision, 2026-10-25.
--
-- Why: finance_debt_observations_debt_id_fkey references finance_debts(id)
-- alone. id is the primary key across every profile and the shared defaults, so
-- an observation carrying one profile's profile_id could name a debt that
-- belongs to another profile, or a shared default debt (profile_id NULL). The
-- rule for finance_* rows is that a key crossing profiles is made impossible by
-- a composite key, not left to the app writing the right profile_id.
--
-- What changes:
--   1. finance_debts gains UNIQUE (profile_id, id), finance_debts_profile_id_id_key.
--      id is already the primary key, so this adds no uniqueness. It exists
--      because a composite foreign key must reference a unique constraint over
--      exactly its columns -- the same device as
--      finance_bank_accounts_id_profile_id_key (20260910074712), but declared
--      with profile_id first so its index also does a second job. See "Index"
--      below.
--   2. finance_debt_observations_debt_id_fkey (debt_id -> finance_debts(id),
--      ON DELETE CASCADE) is replaced by finance_debt_observations_profile_debt_fkey:
--      FOREIGN KEY (profile_id, debt_id) REFERENCES finance_debts (profile_id, id)
--      ON DELETE CASCADE. Deleting a debt still deletes its readings. ON UPDATE
--      stays NO ACTION, as before.
--   3. idx_finance_debt_observations_debt_id (20261024160000) and
--      idx_finance_debts_profile_id are dropped. See "Index" below.
--
-- Accepted consequence: an observation against a shared default debt
-- (finance_debts.is_default, profile_id NULL) is now rejected. A NULL never
-- equals anything, so no (profile_id, debt_id) pair can match a default row.
-- Hosted had 0 default debts, 1 observation and 0 mismatches when read
-- (read-only, 2026-10-25). The app already saves a profile's own copy of a
-- default debt before recording a reading (addDebtObservation in
-- src/features/finance/FinanceDataContext.tsx), so its write path does not
-- depend on the old behaviour.
--
-- NULLs: finance_debt_observations.profile_id and .debt_id are both NOT NULL, so
-- the default MATCH SIMPLE cannot be bypassed by a NULL in the referencing
-- columns and MATCH FULL is not needed. finance_debts.profile_id is nullable
-- (the defaults); that side is the one described above.
--
-- Column order: the foreign key is (profile_id, debt_id), the order of
-- finance_payslip_transaction_reconciliations_profile_payslip_fke and
-- finance_transfer_dismissals_profile_*_fkey, not (debt_id, profile_id).
--
-- Index, observations side: the new key's columns are the leading two of the
-- existing idx_debt_observations_profile_debt (profile_id, debt_id, observed_on
-- DESC), so that index covers the lookup Postgres makes through the key when a
-- debt is deleted (both columns bound by equality, to find the readings to
-- cascade to). No new index is needed. The single-column
-- idx_finance_debt_observations_debt_id was added only to cover the old
-- one-column key, which this migration removes, and nothing queries
-- observations by debt_id without profile_id (the app reads with
-- profile_id = X and deletes by id), so it is now redundant and is dropped
-- rather than left to cost a write on every insert. The migration refuses to
-- run if the covering index is not there, so the key can never be left
-- unindexed.
--
-- Index, debts side: the unique constraint is (profile_id, id), not (id,
-- profile_id), so the index behind it leads with profile_id. That makes it
-- the covering index for finance_debts_profile_id_fkey and serves the scoped
-- reads (profile_id = X) the single-column idx_finance_debts_profile_id
-- served, which is then a strict prefix of it and is dropped. It was created
-- by the 'idx_' || t || '_profile_id' loop in 20260906120000_finance_profiles
-- and declared in supabase/schemas/40_finance.sql; nothing reads it by name.
-- Lookups by id alone are
-- still served by finance_debts_pkey. The post-check refuses to commit if no
-- index leading with finance_debts.profile_id remains.
--
-- Fails closed: every existing observation is checked against the new key before
-- anything changes, and the migration refuses, with the counts, if any would
-- violate it. It is one transaction, so ADD CONSTRAINT failing would roll
-- everything back as well; the check is there for a readable message, and it
-- runs under the same locks so no row can appear between it and the constraint.
--
-- Locks: both tables are taken ACCESS EXCLUSIVE up front (DROP CONSTRAINT,
-- ADD UNIQUE and DROP INDEX need it anyway). The two app paths take them in
-- opposite orders: an observation insert locks observations, then debts (its
-- foreign-key check), while a debt delete locks debts, then observations (the
-- cascade). So whichever order is chosen here can deadlock against one of them.
-- That is harmless: Postgres aborts one side, lock_timeout bounds the wait, and
-- the migration is re-runnable. Both tables are tiny. lock_timeout makes the
-- migration fail rather than queue behind a long-running transaction. The lock
-- is held to COMMIT, so no observation can be written in the moment between the
-- old key going and the new one arriving.
--
-- Re-runnable: the constraint adds are guarded by a catalog lookup, the old key
-- and the two indexes are dropped IF EXISTS, and the pre- and post-checks hold
-- on a second run. No grant, policy or RLS change: finance_debt_observations stays
-- admin-only with anon revoked.
--
-- supabase/schemas/40_finance.sql carries the same unique constraint (beside
-- finance_debts_pkey), the same key, and no longer declares the two dropped
-- indexes.

BEGIN;

SET LOCAL lock_timeout = '5s';
-- pg_get_constraintdef deparses against search_path; pinning it makes the
-- post-check compare a fixed form.
SET LOCAL search_path = '';

LOCK TABLE "public"."finance_debt_observations", "public"."finance_debts" IN ACCESS EXCLUSIVE MODE;

-- Guard: refuse to run if the data or the indexing would not support the key.
DO $$
DECLARE
    v_nullable text;
    v_bad      bigint;
    v_default  bigint;
    v_missing  bigint;
BEGIN
    -- A NULL in a referencing column would skip a MATCH SIMPLE key entirely.
    SELECT pg_catalog.string_agg(a.attname, ', ' ORDER BY a.attname)
    INTO v_nullable
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.finance_debt_observations'::pg_catalog.regclass
      AND a.attname IN ('profile_id', 'debt_id')
      AND NOT a.attnotnull
      AND NOT a.attisdropped;

    IF v_nullable IS NOT NULL THEN
        RAISE EXCEPTION 'Refusing to run: finance_debt_observations.% is nullable, so a MATCH SIMPLE key would not bind it', v_nullable;
    END IF;

    -- Observations whose (profile_id, debt_id) matches no debt's (profile_id, id).
    -- profile_id is NOT NULL, so a debt with a NULL profile_id (a shared default)
    -- counts as a mismatch, as does one with no debt row at all.
    SELECT pg_catalog.count(*) FILTER (WHERE d.profile_id IS DISTINCT FROM o.profile_id),
           pg_catalog.count(*) FILTER (WHERE d.id IS NOT NULL AND d.profile_id IS NULL),
           pg_catalog.count(*) FILTER (WHERE d.id IS NULL)
    INTO v_bad, v_default, v_missing
    FROM "public"."finance_debt_observations" o
    LEFT JOIN "public"."finance_debts" d ON d.id = o.debt_id;

    IF v_bad > 0 THEN
        RAISE EXCEPTION 'Refusing to run: % finance_debt_observations row(s) would violate the profile-scoped key (% name a shared default debt, % name no debt, % name another profile''s debt); repoint or delete them first',
            v_bad, v_default, v_missing, v_bad - v_default - v_missing;
    END IF;

    -- The single-column index is dropped below only because this one covers the key.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        WHERE i.indrelid = 'public.finance_debt_observations'::pg_catalog.regclass
          AND i.indisvalid
          AND i.indpred IS NULL
          AND i.indkey[0] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'profile_id')
          AND i.indkey[1] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'debt_id')
    ) THEN
        RAISE EXCEPTION 'Refusing to run: no valid index on finance_debt_observations leads with (profile_id, debt_id); dropping idx_finance_debt_observations_debt_id would leave the new key unindexed';
    END IF;
END
$$;

-- 1. The unique key the composite foreign key will reference, profile_id first
--    so its index also covers finance_debts_profile_id_fkey. Guarded rather than
--    dropped-and-re-added: a constraint that something else came to depend on
--    must not be dropped here.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.finance_debts'::pg_catalog.regclass
          AND c.conname = 'finance_debts_profile_id_id_key'
    ) THEN
        ALTER TABLE ONLY "public"."finance_debts"
            ADD CONSTRAINT "finance_debts_profile_id_id_key" UNIQUE ("profile_id", "id");
    END IF;
END
$$;

-- 2. Replace the one-column key with the composite one. The old key goes first;
--    the ACCESS EXCLUSIVE lock above means nothing can insert in between.
ALTER TABLE ONLY "public"."finance_debt_observations"
    DROP CONSTRAINT IF EXISTS "finance_debt_observations_debt_id_fkey";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.finance_debt_observations'::pg_catalog.regclass
          AND c.conname = 'finance_debt_observations_profile_debt_fkey'
    ) THEN
        ALTER TABLE ONLY "public"."finance_debt_observations"
            ADD CONSTRAINT "finance_debt_observations_profile_debt_fkey"
            FOREIGN KEY ("profile_id", "debt_id")
            REFERENCES "public"."finance_debts" ("profile_id", "id") ON DELETE CASCADE;
    END IF;
END
$$;

-- 3. The indexes made redundant (see "Index" in the header).
--    idx_finance_debt_observations_debt_id covered only the old key;
--    idx_debt_observations_profile_debt covers the new one.
--    idx_finance_debts_profile_id is now a strict prefix of the unique index
--    behind finance_debts_profile_id_id_key.
DROP INDEX IF EXISTS "public"."idx_finance_debt_observations_debt_id";
DROP INDEX IF EXISTS "public"."idx_finance_debts_profile_id";

-- Post-check: the one-column key is gone, the composite one exists and is
-- validated, the unique constraint it references exists, the key is covered by
-- an index on each side, finance_debts_profile_id_fkey is still covered, and the
-- two redundant indexes are gone.
DO $$
DECLARE
    v_def   text;
    v_valid boolean;
BEGIN
    -- No foreign key from finance_debt_observations to finance_debts on the
    -- debt_id column alone, under the old name or any other.
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.finance_debt_observations'::pg_catalog.regclass
          AND c.contype = 'f'
          AND c.confrelid = 'public.finance_debts'::pg_catalog.regclass
          AND pg_catalog.cardinality(c.conkey) = 1
    ) THEN
        RAISE EXCEPTION 'Post-check failed: finance_debt_observations still has a one-column foreign key to finance_debts';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.finance_debt_observations'::pg_catalog.regclass
          AND c.conname = 'finance_debt_observations_debt_id_fkey'
    ) THEN
        RAISE EXCEPTION 'Post-check failed: finance_debt_observations_debt_id_fkey still exists';
    END IF;

    SELECT pg_catalog.pg_get_constraintdef(c.oid), c.convalidated
    INTO v_def, v_valid
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.finance_debt_observations'::pg_catalog.regclass
      AND c.conname = 'finance_debt_observations_profile_debt_fkey'
      AND c.contype = 'f';

    IF v_def IS DISTINCT FROM 'FOREIGN KEY (profile_id, debt_id) REFERENCES public.finance_debts(profile_id, id) ON DELETE CASCADE' THEN
        RAISE EXCEPTION 'Post-check failed: finance_debt_observations_profile_debt_fkey reads [%]', v_def;
    END IF;

    IF NOT v_valid THEN
        RAISE EXCEPTION 'Post-check failed: finance_debt_observations_profile_debt_fkey is not validated';
    END IF;

    SELECT pg_catalog.pg_get_constraintdef(c.oid)
    INTO v_def
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.finance_debts'::pg_catalog.regclass
      AND c.conname = 'finance_debts_profile_id_id_key'
      AND c.contype = 'u';

    IF v_def IS DISTINCT FROM 'UNIQUE (profile_id, id)' THEN
        RAISE EXCEPTION 'Post-check failed: finance_debts_profile_id_id_key reads [%]', v_def;
    END IF;

    -- finance_debts_profile_id_fkey stays covered once idx_finance_debts_profile_id
    -- is gone: some valid, non-partial index must still lead with profile_id.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        WHERE i.indrelid = 'public.finance_debts'::pg_catalog.regclass
          AND i.indisvalid
          AND i.indpred IS NULL
          AND i.indkey[0] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'profile_id')
    ) THEN
        RAISE EXCEPTION 'Post-check failed: no index on finance_debts leads with profile_id';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        WHERE i.indrelid = 'public.finance_debt_observations'::pg_catalog.regclass
          AND i.indisvalid
          AND i.indpred IS NULL
          AND i.indkey[0] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'profile_id')
          AND i.indkey[1] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'debt_id')
    ) THEN
        RAISE EXCEPTION 'Post-check failed: no index on finance_debt_observations covers (profile_id, debt_id)';
    END IF;

    IF pg_catalog.to_regclass('public.idx_finance_debt_observations_debt_id') IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: idx_finance_debt_observations_debt_id still exists';
    END IF;

    IF pg_catalog.to_regclass('public.idx_finance_debts_profile_id') IS NOT NULL THEN
        RAISE EXCEPTION 'Post-check failed: idx_finance_debts_profile_id still exists';
    END IF;
END
$$;

COMMIT;
