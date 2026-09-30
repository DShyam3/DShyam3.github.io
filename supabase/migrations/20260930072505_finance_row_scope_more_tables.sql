-- Extend the finance_keep_row_scope() guard to finance_settings, finance_goals,
-- finance_goal_contributions, finance_memberships, finance_debts,
-- finance_credit_scores and finance_user_holidays.
--
-- 20260927192100_finance_row_scope_immutable.sql attached the trigger to
-- finance_budget_categories, finance_budget_items and finance_recurring_bills
-- so an upsert on `id` can never move a shared default row (is_default,
-- profile_id NULL) or another profile's row to the saving profile. This is
-- the database backstop for the same rule on the remaining profile tables.
--
-- The function is deliberately NOT replaced. Its only table-specific column is
-- is_template, and that reference sits behind `TG_TABLE_NAME IN
-- ('finance_budget_categories', 'finance_budget_items')`, so it is never
-- resolved on these tables. The columns it reads unconditionally (id,
-- profile_id, is_default) exist on all seven.
--
-- Safe to attach because nothing re-homes a row in these tables any more:
-- - No server-side path writes profile_id or is_default after insert (no edge
--   function, SQL function, cron job or seed; the demo profile migration only
--   DELETEs and INSERTs; the settings dedupe only DELETEs).
-- - finance_settings: the save UPDATEs the profile's own row by id with the
--   same scope, or INSERTs. It never sends a shared row's id.
-- - The other six: the client saves them row by row. A row shown from the
--   shared defaults gets an id of the profile's own on load (scopeToProfile in
--   src/features/finance/save-safety.ts), so its first save INSERTs a copy;
--   updates send only changed columns and never profile_id or is_default.
--   Earlier clients upserted shared rows whole under the saving profile --
--   exactly the takeover this trigger raises on. On 2026-09-30 every profile
--   owned its own rows in these tables, so no deployed client showed a shared
--   row there.
--
-- BEFORE UPDATE only, so this cannot reject anything already committed; it
-- only stops the next attempt. A future migration that genuinely needs to
-- re-home a row must DISABLE TRIGGER around that one statement, then
-- re-enable it.
--
-- Re-runnable: DROP TRIGGER IF EXISTS before CREATE TRIGGER.

BEGIN;

DROP TRIGGER IF EXISTS "tr_finance_settings_keep_scope" ON "public"."finance_settings";
CREATE TRIGGER "tr_finance_settings_keep_scope"
    BEFORE UPDATE ON "public"."finance_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_goals_keep_scope" ON "public"."finance_goals";
CREATE TRIGGER "tr_finance_goals_keep_scope"
    BEFORE UPDATE ON "public"."finance_goals"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_goal_contributions_keep_scope" ON "public"."finance_goal_contributions";
CREATE TRIGGER "tr_finance_goal_contributions_keep_scope"
    BEFORE UPDATE ON "public"."finance_goal_contributions"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_memberships_keep_scope" ON "public"."finance_memberships";
CREATE TRIGGER "tr_finance_memberships_keep_scope"
    BEFORE UPDATE ON "public"."finance_memberships"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_debts_keep_scope" ON "public"."finance_debts";
CREATE TRIGGER "tr_finance_debts_keep_scope"
    BEFORE UPDATE ON "public"."finance_debts"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_credit_scores_keep_scope" ON "public"."finance_credit_scores";
CREATE TRIGGER "tr_finance_credit_scores_keep_scope"
    BEFORE UPDATE ON "public"."finance_credit_scores"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_user_holidays_keep_scope" ON "public"."finance_user_holidays";
CREATE TRIGGER "tr_finance_user_holidays_keep_scope"
    BEFORE UPDATE ON "public"."finance_user_holidays"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

COMMIT;
