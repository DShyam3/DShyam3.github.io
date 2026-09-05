-- Rate limiting state for the public edge functions.
--
-- Numbered 02 so it sorts after 01_functions.sql and before the content
-- collections: nothing here depends on a table, and nothing else depends on
-- this, but it is infrastructure rather than content.
--
-- Why a table at all: the first version of the limiter kept its counter in
-- the edge function's memory, which does nothing. The Edge Runtime does not
-- reuse an isolate between requests at this traffic level, so module state is
-- empty on every call -- measured as 90 requests in 2 seconds all passing.
-- The state has to outlive the request.

CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "key" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."rate_limits" OWNER TO "postgres";

ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key", "window_start");

ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;

-- No policies, deliberately. Only the service role touches this table and the
-- service role bypasses RLS, so RLS on with zero policies is exactly right:
-- everyone else is denied by default.

-- Grants
--
-- Stated as REVOKEs as well as GRANTs because pg_dump emits GRANT and never
-- REVOKE, so a privilege this database has deliberately taken away would not
-- appear in a generated diff and would be silently restored.

REVOKE ALL ON TABLE "public"."rate_limits" FROM "anon";

REVOKE ALL ON TABLE "public"."rate_limits" FROM "authenticated";

GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";

-- Counts one hit and reports whether the caller is over its limit.
--
-- A fixed window rather than a sliding one: a fixed window is a single atomic
-- upsert, a sliding window needs a row per request. The known cost is
-- burstiness at the boundary -- a caller can spend its whole allowance at the
-- end of one window and again at the start of the next. For protecting a free
-- API quota that is a fine trade.
CREATE OR REPLACE FUNCTION "public"."check_rate_limit"(
    "p_key" "text",
    "p_limit" integer,
    "p_window_seconds" integer
) RETURNS boolean
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" = "public"
    AS $$
DECLARE
    v_window timestamptz := to_timestamp(
        floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
    );
    v_count integer;
BEGIN
    INSERT INTO public.rate_limits (key, window_start, count)
    VALUES (p_key, v_window, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count INTO v_count;

    -- Sweep old windows on roughly 1% of calls. Deleting on every call would
    -- double the write cost to tidy rows nobody reads; a cron job would be
    -- another moving part for one small table.
    IF random() < 0.01 THEN
        DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
    END IF;

    RETURN v_count > p_limit;
END;
$$;

ALTER FUNCTION "public"."check_rate_limit"("text", integer, integer) OWNER TO "postgres";

-- SECURITY DEFINER, so it must not be reachable from the public API: anyone
-- could otherwise burn another visitor's allowance by passing their IP.

REVOKE ALL ON FUNCTION "public"."check_rate_limit"("text", integer, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."check_rate_limit"("text", integer, integer) FROM "anon";

REVOKE ALL ON FUNCTION "public"."check_rate_limit"("text", integer, integer) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."check_rate_limit"("text", integer, integer) TO "service_role";
