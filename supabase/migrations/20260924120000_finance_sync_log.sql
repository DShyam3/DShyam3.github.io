-- Durable log of each TrueLayer bank sync run, nightly (pg_cron) or manual
-- (an admin action), so the finance UI can show sync history and a missed
-- nightly run is visible rather than silent. Written only by the
-- truelayer-sync edge function under the service role, which bypasses RLS --
-- never by the browser, which only reads it as the admin. Grows about 1-3
-- rows a day; no retention policy is needed at that rate.
--
-- Read-only from the API by design: one SELECT policy, is_admin() gated,
-- copied from admin_users's "Admin read" (01_functions.sql) rather than
-- from finance_truelayer_connection's "Admin All Access" -- this table has
-- no write policy for authenticated at all, the same shape as admin_users.
-- No further profile scoping beyond is_admin(): this is a single-admin site,
-- so is_admin() already is the whole boundary, matching how every other
-- finance TrueLayer table scopes its reads.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."finance_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trigger" "text" NOT NULL,
    "status" "text" NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "connections_synced" integer DEFAULT 0 NOT NULL,
    "accounts_synced" integer DEFAULT 0 NOT NULL,
    "transactions_synced" integer DEFAULT 0 NOT NULL,
    "transactions_new" integer DEFAULT 0 NOT NULL,
    "banks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "error_message" "text"
);

ALTER TABLE "public"."finance_sync_log" OWNER TO "postgres";

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_trigger_check"
    CHECK (("trigger" = ANY (ARRAY['scheduled'::"text", 'manual'::"text"])));

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_status_check"
    CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'error'::"text"])));

ALTER TABLE ONLY "public"."finance_sync_log"
    ADD CONSTRAINT "finance_sync_log_duration_ms_check"
    CHECK ("duration_ms" >= 0);

-- Leads with profile_id, so it also serves as the profile-scoped lookup
-- index -- what the sync-history UI queries (a profile's runs, most recent
-- first) and what a missed-nightly-run check scans.
CREATE INDEX "idx_finance_sync_log_profile_synced_at"
    ON "public"."finance_sync_log" ("profile_id", "synced_at" DESC);

ALTER TABLE "public"."finance_sync_log" ENABLE ROW LEVEL SECURITY;

-- Read-only from the API, deliberately: only the truelayer-sync edge
-- function writes this table, over the service role, which bypasses RLS.
-- No INSERT/UPDATE/DELETE policy exists for authenticated or anon, so those
-- verbs are denied by RLS's default-deny the same way admin_users denies
-- writes to its own "Admin read" policy (01_functions.sql) -- copied here:
-- is_admin() only, no further profile scoping, because this is a
-- single-admin site and is_admin() already is the whole boundary.
DROP POLICY IF EXISTS "Admin read" ON "public"."finance_sync_log";
CREATE POLICY "Admin read" ON "public"."finance_sync_log"
    FOR SELECT TO "authenticated"
    USING ((SELECT "public"."is_admin"()));

-- Least privilege, not the legacy anon-grant pattern used elsewhere in this
-- file: anon holds no grant of any kind -- this is a finance_* table, and
-- ALTER DEFAULT PRIVILEGES hands every new table ALL to anon on creation, so
-- both REVOKEs below are load-bearing, not decorative. authenticated gets
-- SELECT only, matching the policy above: no write grant exists because no
-- write policy exists to authorise it.
REVOKE ALL ON TABLE "public"."finance_sync_log" FROM "anon";
REVOKE ALL ON TABLE "public"."finance_sync_log" FROM "authenticated";
GRANT SELECT ON TABLE "public"."finance_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_sync_log" TO "service_role";

COMMENT ON TABLE "public"."finance_sync_log" IS
    'Durable log of TrueLayer bank sync runs (trigger = ''scheduled'' for the nightly pg_cron job, ''manual'' for an admin-initiated sync), so the finance UI can show sync history and a missed nightly run is visible rather than silent. A run that times out or crashes writes no row and shows as missed. Written only by the truelayer-sync edge function under the service role, which bypasses RLS; the browser reads it as the admin.';

COMMENT ON COLUMN "public"."finance_sync_log"."transactions_synced" IS
    'Total transaction rows written this run, including rows already stored that were re-fetched inside the overlap window. See transactions_new for rows that were actually new.';

COMMENT ON COLUMN "public"."finance_sync_log"."transactions_new" IS
    'Rows this run inserted that were not already stored. Always <= transactions_synced.';

COMMENT ON COLUMN "public"."finance_sync_log"."banks" IS
    'Per-bank outcome for this run: array of {name text, status ''synced''|''failed'', transactions int, error text optional}. transactions counts rows fetched from that bank before de-duplication, including the re-fetched overlap window, so it is not a count of new rows. error is present only when status is ''failed''.';

COMMENT ON COLUMN "public"."finance_sync_log"."error_message" IS
    'A generic, user-safe summary of what went wrong for the run as a whole. Never the raw provider or SQL error -- see Error Handling in AGENTS.md.';

COMMIT;
