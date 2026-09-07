-- How far back the bank history has been walked.
--
-- Open Banking gives a limited window and consent lapses, so the local store
-- has to be the record (REHAUL_PLAN.md 7.M). Reaching the whole of that window
-- takes more requests than one edge function invocation can make before it is
-- killed, so the walk has to be resumable: each run pushes the frontier back a
-- few windows and records where it got to.
--
-- `backfill_complete` is set when the provider stops returning rows, which is
-- the only way to learn a limit it does not publish. Until then the frontier
-- is simply the oldest date asked for so far.

BEGIN;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "backfilled_from" date;

ALTER TABLE "public"."finance_truelayer_connection"
    ADD COLUMN IF NOT EXISTS "backfill_complete" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."finance_truelayer_connection"."backfilled_from" IS
  'Oldest date a transaction fetch has asked for. NULL means the walk has not '
  'started; the next sync seeds it from the oldest row already held.';

COMMENT ON COLUMN "public"."finance_truelayer_connection"."backfill_complete" IS
  'True once the provider returned nothing for consecutive older windows, '
  'which is how its retention limit is discovered rather than assumed.';

COMMIT;
