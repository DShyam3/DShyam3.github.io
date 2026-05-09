# Supabase Integration Guide

This document outlines the Supabase infrastructure required for this project. Instead of relying on rigid SQL migrations, future agents can use this guide to understand the schema, storage, and security requirements to recreate the backend from scratch.

## 1. Project Setup
- Create a new Supabase project.
- Obtain the API credentials from your project settings.
- In your local `.env.local` or hosting provider, set the following environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_ADMIN_PASSWORD` (used for custom frontend admin flows, if applicable)
  - `VITE_TMDB_API_KEY`
  - `VITE_TMDB_BASE_URL`="https://api.themoviedb.org/3"
  - `VITE_TMDB_IMAGE_BASE_URL`="https://image.tmdb.org/t/p/w500"

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
- **Write Access**: Create policies so that only authenticated users can `INSERT`, `UPDATE`, or `DELETE` files.

## 4. Authentication & Row Level Security (RLS)
- **RLS**: Enable Row Level Security on all tables.
- **Public Read**: Create a `SELECT` policy allowing public read access (`true` for all).
- **Protected Write**: Create `INSERT`, `UPDATE`, `DELETE` policies restricting modifications to authenticated users only.

## 5. Lean Codebase Strategy
The following have been moved to Supabase to keep the repository lean:
- **Site Assets**: Memojis, selfie images, and social icons are hosted in the `site-assets` bucket.
- **Map Data**: `dot-world-map.json` and `dot-city-map.json` are hosted in `site-assets`.
- **CV**: Hosted in the `documents` bucket.
- **Dot Matrix Patterns**: Character and icon grid patterns are hosted as `dot-matrix.json` in `site-assets`.
- **Dynamic Content**: Static text like "About Me" is now stored in the `site_content` table.

### Future Considerations
- **Admin Dashboard**: Expand the `/admin` page to allow editing `site_content` directly from the UI.
- **More Assets**: As the project grows, continue to offload any static JSON or heavy media to `site-assets`.
