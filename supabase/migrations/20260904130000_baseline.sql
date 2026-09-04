-- Baseline: the complete state of this database as of 2026-09-04.
--
-- Replaces the previous migration history, which could not rebuild the
-- database: several changes had been applied through the dashboard without a
-- corresponding file, so replaying migrations/ from empty failed on
-- `function public.is_admin() does not exist`.
--
-- The superseded migrations remain in git history. Their end state is fully
-- represented here.
--
-- Sections:
--   1. public schema  -- pg_dump of the live database
--   2. storage        -- buckets and object policies (outside the public dump)
--   3. scheduled jobs -- pg_cron

-- ============================================================
-- 1. PUBLIC SCHEMA
-- ============================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."content_type" AS ENUM (
    'inventory',
    'link',
    'book',
    'article',
    'creator',
    'photo',
    'recipe',
    'belief',
    'inspiration'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.jwt() ->> 'email' = 'd.shyam1256@gmail.com';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_episodes_watched_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Only run if the 'watched' status actually changed
  IF (OLD.watched IS DISTINCT FROM NEW.watched) THEN
    UPDATE tv_show_episodes
    SET watched = NEW.watched
    WHERE season_id = NEW.id
    AND watched IS DISTINCT FROM NEW.watched; -- Only update rows that actually need to change
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_episodes_watched_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_season_watched_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_season_id INT;
  all_watched BOOLEAN;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_season_id := OLD.season_id;
  ELSE
    target_season_id := NEW.season_id;
  END IF;

  -- Calculate if everything is watched
  SELECT COALESCE(bool_and(watched), false)
  INTO all_watched
  FROM tv_show_episodes
  WHERE season_id = target_season_id;

  -- Update ONLY if the status is different from current
  UPDATE tv_show_seasons
  SET watched = all_watched
  WHERE id = target_season_id
    AND watched IS DISTINCT FROM all_watched;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_season_watched_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text",
    "link" "text",
    "image_url" "text",
    "notes" "text",
    "category" "text" DEFAULT 'articles'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beliefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote" "text" NOT NULL,
    "author" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."beliefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "author" "text" NOT NULL,
    "cover_url" "text",
    "description" "text",
    "link" "text",
    "category" "text" DEFAULT 'favourite'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price" numeric,
    "tags" "text"[]
);


ALTER TABLE "public"."books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "link" "text",
    "category" "text" DEFAULT 'artist'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favourites" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "poster" "text",
    "media_type" "text" DEFAULT 'movie'::"text" NOT NULL,
    "tmdb_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'Hollywood'::"text",
    CONSTRAINT "favourites_media_type_check" CHECK (("media_type" = ANY (ARRAY['movie'::"text", 'tv'::"text"])))
);


ALTER TABLE "public"."favourites" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."favourites_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."favourites_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."favourites_id_seq" OWNED BY "public"."favourites"."id";



CREATE TABLE IF NOT EXISTS "public"."finance_bank_accounts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "issuer" "text",
    "balance" numeric DEFAULT 0 NOT NULL,
    "annual_fee" numeric DEFAULT 0 NOT NULL,
    "use_case" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_budget_categories" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_template" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "budgeted" numeric DEFAULT 0 NOT NULL,
    "group_type" "text",
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_budget_items" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_template" boolean DEFAULT false NOT NULL,
    "category_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "budgeted" numeric DEFAULT 0 NOT NULL,
    "spent" numeric DEFAULT 0 NOT NULL,
    "linked_account_id" "text",
    "emoji" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_budget_presets" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "preset_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text",
    "group_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_budget_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_credit_bureaus" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "emoji" "text",
    "color" "text",
    "max_score" integer NOT NULL,
    "gradient" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_credit_bureaus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_credit_scores" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "bureau" "text" NOT NULL,
    "date" "date" NOT NULL,
    "score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_credit_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_data" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."finance_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_debts" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "lender" "text",
    "original_amount" numeric DEFAULT 0 NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "interest_rate" numeric DEFAULT 0 NOT NULL,
    "min_payment" numeric DEFAULT 0 NOT NULL,
    "start_date" "date",
    "payoff_date" "date",
    "repayment_type" "text" DEFAULT 'amortising'::"text" NOT NULL,
    "student_loan_plan" "text",
    "write_off_years" integer,
    "draws" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_defaults" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."finance_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_goal_contributions" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "goal_id" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "note" "text",
    "bank_account_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_goal_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_goals" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric DEFAULT 0 NOT NULL,
    "current_amount" numeric DEFAULT 0 NOT NULL,
    "target_date" "date",
    "start_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "emoji" "text"
);


ALTER TABLE "public"."finance_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_holiday_defaults" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "month_index" integer NOT NULL,
    "count" numeric DEFAULT 0 NOT NULL,
    "dates" "text",
    "occasion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_holiday_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_memberships" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text",
    "annual_fee" numeric DEFAULT 0 NOT NULL,
    "use_case" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_recurring_bills" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "due_date" integer NOT NULL,
    "is_paid" boolean DEFAULT false NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "due_month" integer,
    "emoji" "text",
    "category" "text",
    "tag" "text",
    "linked_budget_item_id" "text",
    "linked_account_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_recurring_bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_recurring_templates" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "emoji" "text",
    "tag" "text",
    "default_amount" numeric DEFAULT 0 NOT NULL,
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "linked_budget_item_id" "text",
    "budget_category_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_recurring_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "gross_salary" numeric DEFAULT 0 NOT NULL,
    "pension_type" "text" DEFAULT 'net_pay'::"text" NOT NULL,
    "personal_pension_percent" numeric DEFAULT 0 NOT NULL,
    "employer_pension_percent" numeric DEFAULT 0 NOT NULL,
    "student_loan_plan" "text" DEFAULT 'none'::"text" NOT NULL,
    "tax_code" "text" DEFAULT '1257L'::"text" NOT NULL,
    "personal_allowance" numeric DEFAULT 12570 NOT NULL,
    "weekends" integer DEFAULT 104 NOT NULL,
    "bank_holidays" integer DEFAULT 8 NOT NULL,
    "work_holidays" integer DEFAULT 25 NOT NULL,
    "working_hours_per_day" numeric DEFAULT 7.5 NOT NULL,
    "tax_year" integer DEFAULT 2026 NOT NULL,
    "uk_region" "text" DEFAULT 'england-and-wales'::"text" NOT NULL,
    "pay_day_of_month" integer DEFAULT 25,
    "payday_schedule" "text" DEFAULT 'monthly_date'::"text",
    "payday_weekday" integer DEFAULT 5,
    "payday_biweekly_anchor" "text" DEFAULT '2026-01-02'::"text",
    "active_savings_types" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_tax_configs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "student_loan_thresholds" "jsonb" NOT NULL,
    "student_loan_rates" "jsonb" NOT NULL,
    "income_tax_bands" "jsonb" NOT NULL,
    "national_insurance_bands" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_tax_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "amount" numeric DEFAULT 0 NOT NULL,
    "date" "date" NOT NULL,
    "is_reviewed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bank_account_id" "text",
    "goal_id" "text",
    "notes" "text",
    "tags" "text"[],
    "is_recurring" boolean DEFAULT false,
    "account_id" "text"
);


ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_truelayer_connection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_truelayer_connection" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_user_holidays" (
    "id" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "occasion" "text",
    "count" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_user_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspirations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "image_url" "text",
    "link" "text",
    "description" "text",
    "category" "text" DEFAULT 'creators'::"text" NOT NULL,
    "why_i_like" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inspirations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text" DEFAULT 'tech-edc'::"text" NOT NULL,
    "price" numeric,
    "image" "text",
    "is_new" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link" "text",
    "subcategory" "text",
    "is_wishlist" boolean DEFAULT false,
    "description" "text"
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."movies" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text",
    "genre" "text",
    "release_year" integer,
    "poster" "text",
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer,
    "runtime" integer
);


ALTER TABLE "public"."movies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."movies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."movies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."movies_id_seq" OWNED BY "public"."movies"."id";



CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "link" "text",
    "is_personal" boolean DEFAULT true NOT NULL,
    "ingredients" "text",
    "instructions" "text",
    "category" "text" DEFAULT 'main'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "key" "text" NOT NULL,
    "content" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "section" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "order" integer DEFAULT 0
);


ALTER TABLE "public"."site_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_log" (
    "id" integer NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sync_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "items_synced" integer DEFAULT 0,
    "error_message" "text",
    "duration_ms" integer DEFAULT 0
);


ALTER TABLE "public"."sync_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sync_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."sync_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sync_log_id_seq" OWNED BY "public"."sync_log"."id";



CREATE TABLE IF NOT EXISTS "public"."tv_show_episodes" (
    "id" integer NOT NULL,
    "season_id" integer,
    "episode_number" integer NOT NULL,
    "release_date" "date",
    "watched" boolean DEFAULT false,
    "runtime" integer,
    "title" "text"
);


ALTER TABLE "public"."tv_show_episodes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tv_show_episodes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."tv_show_episodes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tv_show_episodes_id_seq" OWNED BY "public"."tv_show_episodes"."id";



CREATE TABLE IF NOT EXISTS "public"."tv_show_seasons" (
    "id" integer NOT NULL,
    "tv_show_id" integer,
    "season_number" integer NOT NULL,
    "release_year" integer,
    "watched" boolean DEFAULT false,
    "release_date" "date"
);


ALTER TABLE "public"."tv_show_seasons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tv_show_seasons_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."tv_show_seasons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tv_show_seasons_id_seq" OWNED BY "public"."tv_show_seasons"."id";



CREATE TABLE IF NOT EXISTS "public"."tv_shows" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "genre" "text",
    "status" "text",
    "poster" "text",
    "overview" "text",
    "release_date" "date",
    "tmdb_id" integer
);


ALTER TABLE "public"."tv_shows" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tv_shows_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."tv_shows_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tv_shows_id_seq" OWNED BY "public"."tv_shows"."id";



CREATE TABLE IF NOT EXISTS "public"."visited_cities" (
    "id" bigint NOT NULL,
    "country_code" "text" NOT NULL,
    "city_name" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "dot_col" integer NOT NULL,
    "dot_row" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visited_cities" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."visited_cities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."visited_cities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."visited_cities_id_seq" OWNED BY "public"."visited_cities"."id";



CREATE TABLE IF NOT EXISTS "public"."visited_countries" (
    "id" integer NOT NULL,
    "country_code" "text" NOT NULL,
    "country_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flag_url" "text"
);


ALTER TABLE "public"."visited_countries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."visited_countries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."visited_countries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."visited_countries_id_seq" OWNED BY "public"."visited_countries"."id";



CREATE TABLE IF NOT EXISTS "public"."weekly_schedule" (
    "id" integer NOT NULL,
    "tv_show_id" integer,
    "day_of_week" "text" NOT NULL,
    "movie_id" bigint,
    CONSTRAINT "weekly_schedule_day_of_week_check" CHECK (("day_of_week" = ANY (ARRAY['Sunday'::"text", 'Monday'::"text", 'Tuesday'::"text", 'Wednesday'::"text", 'Thursday'::"text", 'Friday'::"text", 'Saturday'::"text"])))
);


ALTER TABLE "public"."weekly_schedule" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."weekly_schedule_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."weekly_schedule_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."weekly_schedule_id_seq" OWNED BY "public"."weekly_schedule"."id";



ALTER TABLE ONLY "public"."favourites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."favourites_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."movies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sync_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sync_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tv_show_episodes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_show_episodes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tv_show_seasons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_show_seasons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tv_shows" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tv_shows_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."visited_cities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visited_cities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."visited_countries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visited_countries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."weekly_schedule" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."weekly_schedule_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beliefs"
    ADD CONSTRAINT "beliefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."books"
    ADD CONSTRAINT "books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creators"
    ADD CONSTRAINT "creators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favourites"
    ADD CONSTRAINT "favourites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_bank_accounts"
    ADD CONSTRAINT "finance_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_budget_categories"
    ADD CONSTRAINT "finance_budget_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_budget_presets"
    ADD CONSTRAINT "finance_budget_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_credit_bureaus"
    ADD CONSTRAINT "finance_credit_bureaus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_credit_scores"
    ADD CONSTRAINT "finance_credit_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_data"
    ADD CONSTRAINT "finance_data_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."finance_debts"
    ADD CONSTRAINT "finance_debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_defaults"
    ADD CONSTRAINT "finance_defaults_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_goals"
    ADD CONSTRAINT "finance_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_holiday_defaults"
    ADD CONSTRAINT "finance_holiday_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_memberships"
    ADD CONSTRAINT "finance_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_recurring_bills"
    ADD CONSTRAINT "finance_recurring_bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_recurring_templates"
    ADD CONSTRAINT "finance_recurring_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_settings"
    ADD CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_tax_configs"
    ADD CONSTRAINT "finance_tax_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_truelayer_connection"
    ADD CONSTRAINT "finance_truelayer_connection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_user_holidays"
    ADD CONSTRAINT "finance_user_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspirations"
    ADD CONSTRAINT "inspirations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movies"
    ADD CONSTRAINT "movies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "seasons_unique_match" UNIQUE ("tv_show_id", "season_number");



ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tv_shows"
    ADD CONSTRAINT "tv_shows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "unique_episode_per_season" UNIQUE ("season_id", "episode_number");



ALTER TABLE ONLY "public"."visited_cities"
    ADD CONSTRAINT "visited_cities_country_code_city_name_key" UNIQUE ("country_code", "city_name");



ALTER TABLE ONLY "public"."visited_cities"
    ADD CONSTRAINT "visited_cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visited_countries"
    ADD CONSTRAINT "visited_countries_country_code_key" UNIQUE ("country_code");



ALTER TABLE ONLY "public"."visited_countries"
    ADD CONSTRAINT "visited_countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_tv_show_id_day_of_week_key" UNIQUE ("tv_show_id", "day_of_week");



CREATE INDEX "idx_finance_budget_items_category_id" ON "public"."finance_budget_items" USING "btree" ("category_id");



CREATE INDEX "idx_finance_goal_contributions_goal_id" ON "public"."finance_goal_contributions" USING "btree" ("goal_id");



CREATE INDEX "idx_finance_transactions_account_id" ON "public"."finance_transactions" USING "btree" ("account_id");



CREATE INDEX "idx_tv_shows_tmdb_id" ON "public"."tv_shows" USING "btree" ("tmdb_id");



CREATE INDEX "idx_weekly_schedule_movie_id" ON "public"."weekly_schedule" USING "btree" ("movie_id");



CREATE OR REPLACE TRIGGER "tr_update_episodes_watched" AFTER UPDATE OF "watched" ON "public"."tv_show_seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_episodes_watched_status"();



CREATE OR REPLACE TRIGGER "tr_update_season_watched" AFTER INSERT OR DELETE OR UPDATE OF "watched" ON "public"."tv_show_episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_watched_status"();



ALTER TABLE ONLY "public"."finance_budget_items"
    ADD CONSTRAINT "finance_budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."finance_budget_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_goal_contributions"
    ADD CONSTRAINT "finance_goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."finance_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."finance_bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tv_show_episodes"
    ADD CONSTRAINT "tv_show_episodes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."tv_show_seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tv_show_seasons"
    ADD CONSTRAINT "tv_show_seasons_tv_show_id_fkey" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_schedule"
    ADD CONSTRAINT "weekly_schedule_tv_show_id_fkey" FOREIGN KEY ("tv_show_id") REFERENCES "public"."tv_shows"("id") ON DELETE CASCADE;



CREATE POLICY "Admin All Access" ON "public"."finance_truelayer_connection" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_bank_accounts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_budget_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_budget_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_budget_presets" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_credit_bureaus" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_credit_scores" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_data" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_debts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_defaults" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_goal_contributions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_goals" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_holiday_defaults" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_memberships" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_recurring_bills" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_recurring_templates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_tax_configs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_transactions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin Only" ON "public"."finance_user_holidays" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."articles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."beliefs" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."books" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."creators" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."inspirations" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."inventory_items" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."links" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."movies" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."photos" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."recipes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."site_content" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."tv_show_episodes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."tv_show_seasons" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."tv_shows" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."visited_cities" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."visited_countries" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete" ON "public"."weekly_schedule" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete favourites" ON "public"."favourites" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin delete sync_log" ON "public"."sync_log" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."articles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."beliefs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."books" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."creators" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."inspirations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."inventory_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."links" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."movies" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."photos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."recipes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."site_content" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."tv_show_episodes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."tv_show_seasons" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."tv_shows" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."visited_cities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."visited_countries" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert" ON "public"."weekly_schedule" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert favourites" ON "public"."favourites" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin insert sync_log" ON "public"."sync_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin read sync_log" ON "public"."sync_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."articles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."beliefs" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."books" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."creators" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."inspirations" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."links" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."movies" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."photos" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."recipes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."site_content" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."tv_show_episodes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."tv_show_seasons" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."tv_shows" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."visited_countries" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update" ON "public"."weekly_schedule" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin update favourites" ON "public"."favourites" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Anyone can read favourites" ON "public"."favourites" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."articles" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."beliefs" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."books" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."creators" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."inspirations" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."inventory_items" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."links" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."movies" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."photos" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."recipes" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."tv_show_episodes" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."tv_show_seasons" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."tv_shows" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."visited_countries" FOR SELECT USING (true);



CREATE POLICY "Public Read Access" ON "public"."weekly_schedule" FOR SELECT USING (true);



CREATE POLICY "Public Read Site Content" ON "public"."site_content" FOR SELECT USING (true);



CREATE POLICY "Public read" ON "public"."visited_cities" FOR SELECT USING (true);



ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beliefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favourites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_budget_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_budget_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_budget_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_credit_bureaus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_credit_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_debts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_goal_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_holiday_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_recurring_bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_recurring_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_tax_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_truelayer_connection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_user_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inspirations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tv_show_episodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tv_show_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tv_shows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visited_cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visited_countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_schedule" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






































































































































































































GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_episodes_watched_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_season_watched_status"() TO "service_role";
























GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."beliefs" TO "anon";
GRANT ALL ON TABLE "public"."beliefs" TO "authenticated";
GRANT ALL ON TABLE "public"."beliefs" TO "service_role";



GRANT ALL ON TABLE "public"."books" TO "anon";
GRANT ALL ON TABLE "public"."books" TO "authenticated";
GRANT ALL ON TABLE "public"."books" TO "service_role";



GRANT ALL ON TABLE "public"."creators" TO "anon";
GRANT ALL ON TABLE "public"."creators" TO "authenticated";
GRANT ALL ON TABLE "public"."creators" TO "service_role";



GRANT ALL ON TABLE "public"."favourites" TO "anon";
GRANT ALL ON TABLE "public"."favourites" TO "authenticated";
GRANT ALL ON TABLE "public"."favourites" TO "service_role";



GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."favourites_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."finance_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_bank_accounts" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."finance_budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_budget_categories" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_items" TO "anon";
GRANT ALL ON TABLE "public"."finance_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_budget_items" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_budget_presets" TO "anon";
GRANT ALL ON TABLE "public"."finance_budget_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_budget_presets" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_credit_bureaus" TO "anon";
GRANT ALL ON TABLE "public"."finance_credit_bureaus" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_credit_bureaus" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_credit_scores" TO "anon";
GRANT ALL ON TABLE "public"."finance_credit_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_credit_scores" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_data" TO "anon";
GRANT ALL ON TABLE "public"."finance_data" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_data" TO "service_role";



GRANT ALL ON TABLE "public"."finance_debts" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_debts" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_defaults" TO "anon";
GRANT ALL ON TABLE "public"."finance_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_defaults" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_goal_contributions" TO "anon";
GRANT ALL ON TABLE "public"."finance_goal_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_goal_contributions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_goals" TO "anon";
GRANT ALL ON TABLE "public"."finance_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_goals" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_holiday_defaults" TO "anon";
GRANT ALL ON TABLE "public"."finance_holiday_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_holiday_defaults" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_memberships" TO "anon";
GRANT ALL ON TABLE "public"."finance_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_memberships" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_recurring_bills" TO "anon";
GRANT ALL ON TABLE "public"."finance_recurring_bills" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_recurring_bills" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_recurring_templates" TO "anon";
GRANT ALL ON TABLE "public"."finance_recurring_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_recurring_templates" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_settings" TO "anon";
GRANT ALL ON TABLE "public"."finance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_settings" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_tax_configs" TO "anon";
GRANT ALL ON TABLE "public"."finance_tax_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_tax_configs" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_transactions" TO "anon";
GRANT ALL ON TABLE "public"."finance_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transactions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_truelayer_connection" TO "anon";
GRANT ALL ON TABLE "public"."finance_truelayer_connection" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_truelayer_connection" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."finance_user_holidays" TO "anon";
GRANT ALL ON TABLE "public"."finance_user_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_user_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."inspirations" TO "anon";
GRANT ALL ON TABLE "public"."inspirations" TO "authenticated";
GRANT ALL ON TABLE "public"."inspirations" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."links" TO "anon";
GRANT ALL ON TABLE "public"."links" TO "authenticated";
GRANT ALL ON TABLE "public"."links" TO "service_role";



GRANT ALL ON TABLE "public"."movies" TO "anon";
GRANT ALL ON TABLE "public"."movies" TO "authenticated";
GRANT ALL ON TABLE "public"."movies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."movies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."site_content" TO "anon";
GRANT ALL ON TABLE "public"."site_content" TO "authenticated";
GRANT ALL ON TABLE "public"."site_content" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."sync_log" TO "anon";
GRANT ALL ON TABLE "public"."sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tv_show_episodes" TO "anon";
GRANT ALL ON TABLE "public"."tv_show_episodes" TO "authenticated";
GRANT ALL ON TABLE "public"."tv_show_episodes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tv_show_episodes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tv_show_seasons" TO "anon";
GRANT ALL ON TABLE "public"."tv_show_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."tv_show_seasons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tv_show_seasons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tv_shows" TO "anon";
GRANT ALL ON TABLE "public"."tv_shows" TO "authenticated";
GRANT ALL ON TABLE "public"."tv_shows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tv_shows_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."visited_cities" TO "anon";
GRANT ALL ON TABLE "public"."visited_cities" TO "authenticated";
GRANT ALL ON TABLE "public"."visited_cities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."visited_cities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."visited_cities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."visited_cities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."visited_countries" TO "anon";
GRANT ALL ON TABLE "public"."visited_countries" TO "authenticated";
GRANT ALL ON TABLE "public"."visited_countries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."visited_countries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."visited_countries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."visited_countries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_schedule" TO "anon";
GRANT ALL ON TABLE "public"."weekly_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_schedule" TO "service_role";



GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."weekly_schedule_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";































-- ============================================================
-- 2. STORAGE
-- ============================================================
-- storage.buckets and storage.objects live outside the public schema, so they
-- are not covered by the dump above. Reads are anonymous; every write is
-- gated on public.is_admin().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('photos', 'photos', true, 52428800,
   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic']),
  ('documents', 'documents', true, 52428800,
   ARRAY['application/pdf']),
  ('site-assets', 'site-assets', true, 52428800,
   ARRAY['application/json','image/svg+xml','image/png','image/jpeg','image/webp',
         'image/gif','image/x-icon','image/vnd.microsoft.icon','font/woff2','font/woff'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Public photo access" ON storage.objects;
CREATE POLICY "Public photo access" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Public document access" ON storage.objects;
CREATE POLICY "Public document access" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

-- Admin write
DROP POLICY IF EXISTS "Admin uploads site-assets" ON storage.objects;
CREATE POLICY "Admin uploads site-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admin uploads photos" ON storage.objects;
CREATE POLICY "Admin uploads photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin updates photos" ON storage.objects;
CREATE POLICY "Admin updates photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin deletes photos" ON storage.objects;
CREATE POLICY "Admin deletes photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin uploads documents" ON storage.objects;
CREATE POLICY "Admin uploads documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admin updates documents" ON storage.objects;
CREATE POLICY "Admin updates documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Admin deletes documents" ON storage.objects;
CREATE POLICY "Admin deletes documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());

-- ============================================================
-- 3. SCHEDULED JOBS
-- ============================================================
-- Nightly server-side watchlist sync, so the data stays fresh even when nobody
-- opens the page. Mirrors the client-side sync in WatchlistContext.tsx; see
-- supabase/functions/watchlist-cron-sync/index.ts.
--
-- Prerequisite on a fresh project: a vault secret named 'service_role_key'
-- must exist, otherwise the job runs but the edge function rejects the call.

SELECT cron.unschedule('watchlist-daily-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watchlist-daily-sync');

SELECT cron.schedule(
  'watchlist-daily-sync',
  '0 6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://yvtiybyuifkiwyrnjebe.supabase.co/functions/v1/watchlist-cron-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);

-- ============================================================
-- 4. REVOKED PRIVILEGES
-- ============================================================
-- pg_dump emits GRANT statements but never REVOKEs: a revoked privilege shows
-- up only as the absence of a grant. A fresh Supabase project starts with
-- permissive defaults on the public schema, so replaying the dump alone leaves
-- privileges this database has explicitly taken away. These restore that.
--
-- Note the inconsistency, preserved here because a baseline must reproduce
-- current state rather than improve on it: finance_debts has every anon
-- privilege revoked, while the other finance tables had only SELECT revoked
-- and still grant anon DELETE/INSERT/UPDATE/TRUNCATE. RLS is what actually
-- stops those today. See finding S-10 in REHAUL_PLAN.md -- tightening them is
-- a separate migration, deliberately not folded in here.

REVOKE SELECT ON TABLE
  public.finance_bank_accounts,
  public.finance_budget_categories,
  public.finance_budget_items,
  public.finance_budget_presets,
  public.finance_credit_bureaus,
  public.finance_credit_scores,
  public.finance_data,
  public.finance_defaults,
  public.finance_goal_contributions,
  public.finance_goals,
  public.finance_holiday_defaults,
  public.finance_memberships,
  public.finance_recurring_bills,
  public.finance_recurring_templates,
  public.finance_settings,
  public.finance_tax_configs,
  public.finance_transactions,
  public.finance_truelayer_connection,
  public.finance_user_holidays
FROM anon;

REVOKE ALL ON TABLE public.finance_debts FROM anon;

REVOKE DELETE, INSERT ON TABLE public.sync_log FROM anon;

REVOKE DELETE, INSERT ON TABLE public.visited_cities FROM anon;
