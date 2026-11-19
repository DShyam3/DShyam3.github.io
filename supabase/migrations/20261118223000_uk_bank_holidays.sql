-- Cache UK bank holidays from gov.uk in Supabase so the Finance client
-- never needs a live external fetch, refreshed monthly by pg_cron.

CREATE TABLE IF NOT EXISTS "public"."uk_bank_holidays" (
    "region" "text" NOT NULL,
    "date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "uk_bank_holidays_pkey" PRIMARY KEY ("region", "date"),
    CONSTRAINT "uk_bank_holidays_region_check" CHECK ("region" = ANY (ARRAY['england-and-wales'::"text", 'scotland'::"text", 'northern-ireland'::"text"]))
);

ALTER TABLE "public"."uk_bank_holidays" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read uk_bank_holidays" ON "public"."uk_bank_holidays";
CREATE POLICY "Public read uk_bank_holidays" ON "public"."uk_bank_holidays"
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin insert uk_bank_holidays" ON "public"."uk_bank_holidays";
CREATE POLICY "Admin insert uk_bank_holidays" ON "public"."uk_bank_holidays"
    FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Admin update uk_bank_holidays" ON "public"."uk_bank_holidays";
CREATE POLICY "Admin update uk_bank_holidays" ON "public"."uk_bank_holidays"
    FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

DROP POLICY IF EXISTS "Admin delete uk_bank_holidays" ON "public"."uk_bank_holidays";
CREATE POLICY "Admin delete uk_bank_holidays" ON "public"."uk_bank_holidays"
    FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

GRANT SELECT ON TABLE "public"."uk_bank_holidays" TO "anon", "authenticated";
GRANT ALL ON TABLE "public"."uk_bank_holidays" TO "service_role";

SELECT cron.unschedule('uk-bank-holidays-monthly-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uk-bank-holidays-monthly-sync');

SELECT cron.schedule(
  'uk-bank-holidays-monthly-sync',
  '0 5 1 * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/sync-bank-holidays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $job$
);
