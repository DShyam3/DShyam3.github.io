-- Drop finance_seed_backup, the locked snapshot table.
--
-- 20260927192000_finance_shared_template_cleanup.sql created it and snapshotted
-- the shared budget categories, budget items and recurring templates before
-- making them generic; 20260927192200_finance_settings_one_per_profile.sql
-- added the duplicate finance_settings rows it deleted. 79 rows in all:
-- 5 budget categories, 32 budget items, 30 recurring templates, 12 settings.
-- The owner has confirmed both the cleanup and the settings dedupe look right
-- in production and asked for the drop -- the table's own comment says it is
-- "dropped by a later migration once the owner confirms a given cleanup is
-- correct". This is that migration.
--
-- Irreversible: once dropped, those 79 rows exist nowhere else. If an offline
-- copy is wanted, take it before applying (e.g. a COPY of the table from the
-- SQL editor, or `supabase db dump --data-only -t public.finance_seed_backup`).
--
-- The table has no policies, no client grants, no foreign keys in either
-- direction and no dependent views or functions, so a plain DROP (no CASCADE)
-- is enough -- if something did depend on it, failing loudly is the right
-- outcome. Its identity sequence (finance_seed_backup_id_seq) is owned by the
-- id column and goes with it.
--
-- The two older migrations are history and are not edited: on a fresh database
-- they still create and fill the table, and this migration, running after
-- them, removes it again. IF EXISTS makes a re-run a no-op.

BEGIN;

DROP TABLE IF EXISTS "public"."finance_seed_backup";

COMMIT;
