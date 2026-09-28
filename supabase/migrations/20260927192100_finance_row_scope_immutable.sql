-- finance_budget_categories, finance_budget_items, and finance_recurring_bills
-- share PRIMARY KEY (id) across every profile and the shared default rows
-- (is_default = true, profile_id IS NULL). The client saves with a PostgREST
-- upsert on onConflict: 'id'. If that id already belongs to another profile's
-- row -- or to a shared default -- ON CONFLICT DO UPDATE silently moves the
-- row to the saving profile and overwrites it; the existing
-- ..._profile_scope_check CHECK allows that transition, since it only
-- constrains is_default against profile_id, not the identity of the row
-- being changed. The client is being fixed to give non-owned rows fresh ids;
-- this trigger is the database-side guarantee that a row never changes
-- owner, so a collision fails loudly instead of moving someone else's row.
--
-- A composite key is not an option: default rows carry a NULL profile_id
-- (can't sit in a (profile_id, id) primary key), and
-- finance_budget_items.category_id references finance_budget_categories.id
-- alone, not a (profile_id, id) pair.
--
-- BEFORE UPDATE only -- this cannot reject anything already committed, so no
-- live row can already violate it; it only stops the next attempt.
--
-- A future migration that genuinely needs to re-home a row (a real ownership
-- transfer, not a collision) must
-- `ALTER TABLE ... DISABLE TRIGGER tr_<table>_keep_scope` around that one
-- statement, then re-enable it.

BEGIN;

-- SECURITY INVOKER (the default, stated for clarity) and search_path = '':
-- the function reads no table and calls no schema-qualified object beyond
-- RAISE's own built-ins, which resolve through pg_catalog regardless of
-- search_path.
CREATE OR REPLACE FUNCTION "public"."finance_keep_row_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.is_default IS DISTINCT FROM OLD.is_default THEN
    RAISE EXCEPTION '% % belongs to a different profile or the shared defaults; save it under a new id',
        TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Only finance_budget_categories and finance_budget_items carry
  -- is_template; finance_recurring_bills has no such column. Gating on
  -- TG_TABLE_NAME before touching NEW.is_template means that reference is
  -- never resolved when this fires on finance_recurring_bills -- the same
  -- pattern public.log_watchlist_event() uses to guard NEW.status, which
  -- movies also lacks (01_functions.sql).
  IF TG_TABLE_NAME IN ('finance_budget_categories', 'finance_budget_items') THEN
    IF NEW.is_template IS DISTINCT FROM OLD.is_template THEN
      RAISE EXCEPTION '% % belongs to a different profile or the shared defaults; save it under a new id',
          TG_TABLE_NAME, OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."finance_keep_row_scope"() OWNER TO "postgres";

-- Not revoked: this project's other BEFORE/AFTER trigger functions
-- (update_episodes_watched_status, update_season_watched_status,
-- set_watched_at, log_watchlist_event -- 01_functions.sql) all keep the
-- default EXECUTE grant to anon/authenticated/service_role rather than
-- revoking it, matched here for consistency. It carries no exploitable
-- surface either way: Postgres refuses to run a trigger function outside
-- trigger context ("trigger functions can only be called as triggers"),
-- before this body ever executes, for any caller.
GRANT ALL ON FUNCTION "public"."finance_keep_row_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."finance_keep_row_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_keep_row_scope"() TO "service_role";

-- Plain BEFORE UPDATE, not UPDATE OF <cols>: a PostgREST upsert sets every
-- supplied column on conflict, so UPDATE OF would still fire in the case
-- that matters, but plain BEFORE UPDATE also catches a future direct SQL
-- UPDATE that touches these columns without naming them via the client's
-- upsert shape.

DROP TRIGGER IF EXISTS "tr_finance_budget_categories_keep_scope" ON "public"."finance_budget_categories";
CREATE TRIGGER "tr_finance_budget_categories_keep_scope"
    BEFORE UPDATE ON "public"."finance_budget_categories"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_budget_items_keep_scope" ON "public"."finance_budget_items";
CREATE TRIGGER "tr_finance_budget_items_keep_scope"
    BEFORE UPDATE ON "public"."finance_budget_items"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

DROP TRIGGER IF EXISTS "tr_finance_recurring_bills_keep_scope" ON "public"."finance_recurring_bills";
CREATE TRIGGER "tr_finance_recurring_bills_keep_scope"
    BEFORE UPDATE ON "public"."finance_recurring_bills"
    FOR EACH ROW EXECUTE FUNCTION "public"."finance_keep_row_scope"();

COMMIT;
