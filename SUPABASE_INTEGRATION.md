# Supabase Integration Guide

This document outlines the Supabase infrastructure required for this project. Instead of relying on rigid SQL migrations, future agents can use this guide to understand the schema, storage, and security requirements to recreate the backend from scratch.

## 1. Project Setup
- Create a new Supabase project.
- Obtain the API credentials from your project settings.
- In your local `.env` or hosting provider, set the following environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_TMDB_IMAGE_BASE_URL`="https://image.tmdb.org/t/p/w500"
  - `VITE_ADMIN_EMAIL` — the Supabase Auth account email treated as admin

  The actual TMDB API key is **not** a frontend env var — it's a server-side edge function secret (`supabase secrets set TMDB_API_KEY=...`), read by the `tmdb-proxy` and `watchlist-cron-sync` edge functions. It used to also be `VITE_TMDB_API_KEY` here, inlined into the client bundle; that was removed since it defeated the purpose of having a proxy. See the README's "Edge Functions" section for the full list of server-side secrets.

## 2. Database Schema
The application relies on several tables to drive the UI. A future AI agent can inspect the TypeScript interfaces in `src/types/` (e.g., `inventory.ts`, `books.ts`, `recipes.ts`) to infer the exact columns and data types needed.

**Core Tables:**
- **Inventory**: Tracks technology, wardrobe, and kitchen items.
- **Watchlist**: Tables like `tv_shows` and `movies` (integrates with TMDB).
- **Insights**: `articles`, `books`, `creators`, `inspirations`, `links`.
- **Personal**: `beliefs`, `recipes`.

*Implementation Note: When recreating these tables, ensure appropriate Primary Keys (e.g., `id` UUID default `gen_random_uuid()`) and `created_at` timestamp defaults.*

## 3. Storage Buckets
The application uses Supabase Storage for media and documents:
- **`images` Bucket**: Used for storing photos, inventory images, and gallery assets.
- **`documents` Bucket**: Used for storing the downloadable CV/Resume.
- **`site-assets` Bucket**: Used for critical static site assets (Memojis, maps, icons).

### Storage Security Policies
- **Read Access**: Both buckets should be public. Create policies allowing `SELECT` for anon/public users.
- **Write Access**: Should be admin-only (see the `is_admin()` pattern below), not "any authenticated user" — this mirrors the table RLS fix below, but **storage bucket policies were not audited/fixed as part of that work**. If you're recreating this project, apply the same admin-only write policy here; if you're auditing the existing project, verify the bucket policies actually match this before assuming they do.

## 4. Authentication & Row Level Security (RLS)

**The important thing to get right**: policies must check the caller's *identity*, not just their *role*. An earlier version of this project's policies checked `TO authenticated` only — since anyone can call `supabase.auth.signUp()` directly against the public anon key (regardless of whether the frontend exposes a signup form), "authenticated" means "anyone who bothered to sign up," not "the admin." That let any self-registered user write/delete every table, and — for a while — let the anon key read finance tables with no login at all.

The fix (see `supabase/20260724_add_is_admin_helper.sql` and the `supabase/20260724_secure_*.sql` migrations) is a helper function every write/admin-only policy uses:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'email' = 'your-admin-email@example.com';
$$;
```

Then, per table:
- **Content tables** (books, links, articles, creators, photos, recipes, beliefs, inspirations, movies, tv_shows, etc.): `SELECT` policy `TO public USING (true)` — genuinely public, this is a portfolio. Write policies (`INSERT`/`UPDATE`/`DELETE`, or `FOR ALL`) use `USING (public.is_admin())`, not just `TO authenticated`.
- **Finance / TrueLayer tables**: no public read at all. `FOR ALL TO authenticated USING (public.is_admin())` — admin only, both read and write. Revoke the `anon` role's `SELECT` grant on these entirely.
- **Explicit API Exposure (Grants)**: new tables aren't exposed to the Data/GraphQL API by default. Grant `SELECT` to `anon` only for genuinely public tables; grant full CRUD to `authenticated` and `service_role` (RLS still restricts `authenticated` down to admin-only via `is_admin()` where that's the intent — the grant is a ceiling, RLS is the actual gate). Grant `USAGE, SELECT` on sequences to all three roles.

## 5. Lean Codebase Strategy
The following have been moved to Supabase to keep the repository lean:
- **Site Assets**: Memojis, selfie images, and social icons are hosted in the `site-assets` bucket.
- **Map Data**: `dot-world-map.json` and `dot-city-map.json` are hosted in `site-assets`.
- **CV**: Hosted in the `documents` bucket.
- **Dynamic Content**: Static text like "About Me" is now stored in the `site_content` table.

**Reversed**: the icon-pattern data (`dot-matrix.json`'s `iconPatterns`, used by `DotMatrixIcon`) used to be fetched from `site-assets` at runtime, but that meant every page's text was invisible until that network request finished. It's now bundled at build time as `src/data/dot-matrix.json` instead — small, static, no reason to pay a network round trip for it on every page load. Character glyphs for text moved to a real webfont entirely (see the README's "Dot-matrix text system" section) and don't use this file at all anymore.

## 6. Edge Functions & Scheduled Jobs

Not covered by table/storage recreation — see the README's "How everything is wired" section for the full list of edge functions, their secrets, and the `pg_cron` scheduled sync setup.

### Future Considerations
- **Admin Dashboard**: Expand the `/admin` page to allow editing `site_content` directly from the UI.
- **More Assets**: As the project grows, continue to offload any static JSON or heavy media to `site-assets`.
