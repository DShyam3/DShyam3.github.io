CREATE TABLE IF NOT EXISTS "public"."links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'productivity'::"text" NOT NULL,
    "icon" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."links" OWNER TO "postgres";

ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."links" FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin insert" ON "public"."links" FOR INSERT TO "authenticated" WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Admin update" ON "public"."links" FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));

CREATE POLICY "Public Read Access" ON "public"."links" FOR SELECT USING (true);

ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;

-- Grants

REVOKE ALL ON TABLE "public"."links" FROM "anon";

GRANT SELECT ON TABLE "public"."links" TO "anon";

REVOKE ALL ON TABLE "public"."links" FROM "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."links" TO "authenticated";

GRANT ALL ON TABLE "public"."links" TO "service_role";

CREATE TABLE IF NOT EXISTS "public"."link_checks" (
    "link_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "checked_at" timestamp with time zone NOT NULL,
    "check_status" smallint,
    "check_error" "text",
    "check_failures" smallint DEFAULT 0 NOT NULL,
    "failing_since" timestamp with time zone,
    CONSTRAINT "link_checks_check_error_check" CHECK (("check_error" IS NULL OR "check_error" = ANY (ARRAY['bad_url'::"text", 'blocked_address'::"text", 'dns'::"text", 'timeout'::"text", 'connection'::"text", 'too_many_redirects'::"text"]))),
    CONSTRAINT "link_checks_check_failures_check" CHECK (("check_failures" >= 0))
);

ALTER TABLE "public"."link_checks" OWNER TO "postgres";

ALTER TABLE ONLY "public"."link_checks"
    ADD CONSTRAINT "link_checks_pkey" PRIMARY KEY ("link_id");

ALTER TABLE ONLY "public"."link_checks"
    ADD CONSTRAINT "link_checks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE CASCADE;

ALTER TABLE "public"."link_checks" ENABLE ROW LEVEL SECURITY;

-- Read-only from the API, deliberately: only the links-check edge function
-- writes this table, over the service role, which bypasses RLS.
CREATE POLICY "Admin read" ON "public"."link_checks" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."link_checks" FROM "anon";

REVOKE ALL ON TABLE "public"."link_checks" FROM "authenticated";

GRANT SELECT ON TABLE "public"."link_checks" TO "authenticated";

GRANT ALL ON TABLE "public"."link_checks" TO "service_role";

COMMENT ON TABLE "public"."link_checks" IS 'Daily dead-link check results, written by the links-check function with the service role and read by the owner only.';

COMMENT ON COLUMN "public"."link_checks"."link_id" IS 'The link this result belongs to; the result is deleted with the link.';

COMMENT ON COLUMN "public"."link_checks"."url" IS 'The URL this result is for; a result whose url differs from the link''s current url is stale.';

COMMENT ON COLUMN "public"."link_checks"."checked_at" IS 'When the last dead-link check for this link finished.';

COMMENT ON COLUMN "public"."link_checks"."check_status" IS 'The final HTTP status after redirects; NULL when no response was received.';

COMMENT ON COLUMN "public"."link_checks"."check_error" IS 'Why the check got no usable response (bad_url, blocked_address, dns, timeout, connection or too_many_redirects); NULL when a response arrived.';

COMMENT ON COLUMN "public"."link_checks"."check_failures" IS 'How many consecutive checks have failed; 0 when the last check passed.';

COMMENT ON COLUMN "public"."link_checks"."failing_since" IS 'When the current streak of failed checks began; NULL when the link is not failing.';
