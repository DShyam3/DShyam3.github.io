-- Record which scheduled due date a confirmed payment covers, so Paid can be
-- decided per period for monthly, quarterly and annual bills.
-- No backfill: existing rows stay null and the app works the period out from
-- last_paid_date. RLS, the "Admin Only" policy and the anon revoke from
-- 20261006220926 already cover the table, so none of them are repeated here.
ALTER TABLE "public"."finance_recurring_bills"
    ADD COLUMN "paid_for_due_date" date;

COMMENT ON COLUMN "public"."finance_recurring_bills"."paid_for_due_date" IS
    'Scheduled due date of the period the confirmed payment covers; decides Paid for monthly, quarterly and annual bills. Null for rows confirmed before this column existed.';
