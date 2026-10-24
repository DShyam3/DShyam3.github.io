-- Add covering indexes for the five foreign keys the hosted performance advisor
-- reports as unindexed (lint 0001_unindexed_foreign_keys, read 2026-10-24).
--
-- Why: when a referenced row is deleted, or its key updated, Postgres finds the
-- child rows through the foreign key's own columns. With no index leading on
-- those columns the lookup is a sequential scan of the whole child table, once
-- per deleted row. What each delete does to the child, per the schema:
--   - finance_debts -> finance_debt_observations.debt_id: ON DELETE CASCADE.
--     The existing idx_debt_observations_profile_debt leads with profile_id, so
--     it cannot serve a lookup by debt_id alone.
--   - finance_transactions -> finance_profile_transfers.from_transaction_id and
--     .to_transaction_id: ON DELETE SET NULL, one index each.
--   - auth.users -> finance_profiles.owner_user_id: ON DELETE SET NULL.
--   - finance_transactions(profile_id, id) ->
--     finance_transfer_dismissals(profile_id, inflow_transaction_id): ON DELETE
--     CASCADE, a composite key, so the index keeps the FK's own column order.
--
-- What stays: finance_transfer_dismissals_profile_outflow_fkey is already
-- covered. The unique pair index idx_finance_transfer_dismissals_profile_pair
-- leads with (profile_id, outflow_transaction_id), which is that FK's column
-- list, so no second outflow index is added.
--
-- Indexes only: no grant, policy or RLS change.
--
-- The build is a plain CREATE INDEX rather than CONCURRENTLY, because a
-- migration runs in a transaction and CONCURRENTLY cannot. These tables are
-- small. The build takes a SHARE lock (reads continue, writes wait) on each
-- table for its duration, and lock_timeout makes the migration fail rather
-- than queue behind a long-running transaction. Re-runnable: every statement is
-- IF NOT EXISTS.
--
-- supabase/schemas/40_finance.sql carries the same five indexes beside each
-- table's DDL.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- finance_debt_observations_debt_id_fkey
CREATE INDEX IF NOT EXISTS "idx_finance_debt_observations_debt_id"
    ON "public"."finance_debt_observations" ("debt_id");

-- finance_profile_transfers_from_transaction_id_fkey
CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_from_transaction_id"
    ON "public"."finance_profile_transfers" ("from_transaction_id");

-- finance_profile_transfers_to_transaction_id_fkey
CREATE INDEX IF NOT EXISTS "idx_finance_profile_transfers_to_transaction_id"
    ON "public"."finance_profile_transfers" ("to_transaction_id");

-- finance_profiles_owner_user_id_fkey
CREATE INDEX IF NOT EXISTS "idx_finance_profiles_owner_user_id"
    ON "public"."finance_profiles" ("owner_user_id");

-- finance_transfer_dismissals_profile_inflow_fkey (composite, FK column order)
CREATE INDEX IF NOT EXISTS "idx_finance_transfer_dismissals_profile_inflow"
    ON "public"."finance_transfer_dismissals" ("profile_id", "inflow_transaction_id");

COMMIT;
