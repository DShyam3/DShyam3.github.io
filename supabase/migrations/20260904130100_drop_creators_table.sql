drop policy "Admin delete" on "public"."creators";

drop policy "Admin insert" on "public"."creators";

drop policy "Admin update" on "public"."creators";

drop policy "Public Read Access" on "public"."creators";

revoke delete on table "public"."creators" from "anon";

revoke insert on table "public"."creators" from "anon";

revoke references on table "public"."creators" from "anon";

revoke select on table "public"."creators" from "anon";

revoke trigger on table "public"."creators" from "anon";

revoke truncate on table "public"."creators" from "anon";

revoke update on table "public"."creators" from "anon";

revoke delete on table "public"."creators" from "authenticated";

revoke insert on table "public"."creators" from "authenticated";

revoke references on table "public"."creators" from "authenticated";

revoke select on table "public"."creators" from "authenticated";

revoke trigger on table "public"."creators" from "authenticated";

revoke truncate on table "public"."creators" from "authenticated";

revoke update on table "public"."creators" from "authenticated";

revoke delete on table "public"."creators" from "service_role";

revoke insert on table "public"."creators" from "service_role";

revoke references on table "public"."creators" from "service_role";

revoke select on table "public"."creators" from "service_role";

revoke trigger on table "public"."creators" from "service_role";

revoke truncate on table "public"."creators" from "service_role";

revoke update on table "public"."creators" from "service_role";

alter table "public"."creators" drop constraint "creators_pkey";

drop index if exists "public"."creators_pkey";

drop table "public"."creators";


