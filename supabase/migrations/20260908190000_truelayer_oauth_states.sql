BEGIN;

-- OAuth state is deliberately stored as a hash. A database read must never
-- disclose a bearer value that can complete a bank-link flow.
CREATE TABLE "public"."finance_truelayer_oauth_states" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "state_hash" text NOT NULL,
    "redirect_uri" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "finance_truelayer_oauth_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_truelayer_oauth_states_state_hash_key" UNIQUE ("state_hash"),
    CONSTRAINT "finance_truelayer_oauth_states_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "public"."finance_profiles"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_finance_truelayer_oauth_states_profile_expires_at"
    ON "public"."finance_truelayer_oauth_states" ("profile_id", "expires_at");

ALTER TABLE "public"."finance_truelayer_oauth_states" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin Only" ON "public"."finance_truelayer_oauth_states"
    TO "authenticated"
    USING ("public"."is_admin"())
    WITH CHECK ("public"."is_admin"());

-- The Edge Function uses the service role. Authenticated access remains RLS
-- protected for operational recovery; anonymous callers get nothing.
REVOKE ALL ON TABLE "public"."finance_truelayer_oauth_states" FROM "anon";
GRANT ALL ON TABLE "public"."finance_truelayer_oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_truelayer_oauth_states" TO "service_role";

COMMENT ON TABLE "public"."finance_truelayer_oauth_states" IS
    'One-time, SHA-256-hashed TrueLayer OAuth states. Rows are consumed before token exchange.';

COMMIT;
