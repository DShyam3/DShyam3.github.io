GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

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
