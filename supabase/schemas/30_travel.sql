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

ALTER TABLE ONLY "public"."visited_cities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visited_cities_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."visited_countries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visited_countries_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."visited_cities"
    ADD CONSTRAINT "visited_cities_country_code_city_name_key" UNIQUE ("country_code", "city_name");

ALTER TABLE ONLY "public"."visited_cities"
    ADD CONSTRAINT "visited_cities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."visited_countries"
    ADD CONSTRAINT "visited_countries_country_code_key" UNIQUE ("country_code");

ALTER TABLE ONLY "public"."visited_countries"
    ADD CONSTRAINT "visited_countries_pkey" PRIMARY KEY ("id");

CREATE POLICY "Admin delete" ON "public"."visited_cities" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin delete" ON "public"."visited_countries" FOR DELETE TO "authenticated" USING ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."visited_cities" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin insert" ON "public"."visited_countries" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());

CREATE POLICY "Admin update" ON "public"."visited_countries" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

CREATE POLICY "Public Read Access" ON "public"."visited_countries" FOR SELECT USING (true);

CREATE POLICY "Public read" ON "public"."visited_cities" FOR SELECT USING (true);

ALTER TABLE "public"."visited_cities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."visited_countries" ENABLE ROW LEVEL SECURITY;

-- Grants

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

-- Revoked privileges (see the note in 40_finance.sql)
REVOKE DELETE, INSERT ON TABLE "public"."visited_cities" FROM "anon";
