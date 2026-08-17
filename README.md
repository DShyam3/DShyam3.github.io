# Dhyan's Website - Personal Portfolio & Tracker

Welcome to my personal corner of the web. This site serves as a central hub to showcase my personal interests, curated collections, and ongoing trackers.

## 🌟 About This Site

This platform is more than just a tracker; it's a window into what I value and how I spend my time. It features:

- **Inventory**: A curated showcase of my technology, wardrobe, and kitchen essentials.
- **Watchlist**: My personal tracking for TV shows and movies, including release schedules and progress monitoring.
- **Finance**: A private income/tax/budget dashboard, including live bank sync via TrueLayer.
- **Insights**: Collections of books, articles, and inspirations that shape my perspective.
- **Personal Touch**: A glimpse into my beliefs, favorite recipes, and photography.

## 🛠️ Technology Stack

- **Frontend**: Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- **Backend**: Supabase (Postgres + Row Level Security + Auth + Storage + Edge Functions + pg_cron)
- **Data Integration**: TMDB API (media metadata), TrueLayer (open banking, Finance page only)
- **Deployment**: GitHub Pages, via a GitHub Actions workflow (`.github/workflows/deploy.yml`)

## 🚀 Getting Started

```sh
# Clone the repository
git clone https://github.com/DShyam3/DShyam3.github.io.git

# Install dependencies
npm i

# Start the development server
npm run dev        # http://localhost:8080

# Other useful scripts
npm run build       # production build
npm run lint         # eslint (warnings allowed, errors fail the build)
npm run typecheck    # tsc --noEmit -- not yet a CI gate, run it by hand
```

## 🔐 Environment Setup (local `.env`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the anon key. Meant to be public; RLS is what actually protects data, not this key.
- `VITE_TMDB_IMAGE_BASE_URL` — just the TMDB image CDN base (`https://image.tmdb.org/t/p/w500`), not a secret.
- `VITE_ADMIN_EMAIL` — the Supabase Auth account email treated as admin (`/auth` page login).

**Not needed / intentionally removed**: `VITE_TMDB_API_KEY`, `VITE_TMDB_BASE_URL`, `VITE_ADMIN_PASSWORD` used to exist here but were removed — the TMDB key is server-side only now (see Edge Functions below), and `VITE_ADMIN_PASSWORD` was dead, unused config that only ever risked shipping `"admin"` into the client bundle.

## 🧭 How everything is wired

### Frontend → Supabase

The browser talks to Supabase directly via `@supabase/supabase-js` (`src/integrations/supabase/client.ts`) using the anon key. **Row Level Security is the actual authorization boundary** — every table has an `is_admin()`-gated policy (see `supabase/20260724_add_is_admin_helper.sql`), checking the caller's JWT email against `VITE_ADMIN_EMAIL`. Content tables (books, links, articles, etc.) are publicly readable by design (it's a portfolio); finance and TrueLayer tables are admin-only for both read and write. See `supabase/secure_policies.sql` and the `supabase/20260724_secure_*.sql` migrations for the full policy set.

### Edge Functions (`supabase/functions/`)

Server-side Deno functions, deployed independently of the frontend — **pushing to `main` does NOT deploy these**, they need their own `supabase functions deploy <name>` (see Deployment below).

| Function | Purpose | Required secrets | Callable by |
|---|---|---|---|
| `tmdb-proxy` | Proxies TMDB API calls so the TMDB key never reaches the browser. Endpoint allow-listed (only the shapes the app actually uses) to stop it being used as a free generic proxy. | `TMDB_API_KEY` | Public (needed for anonymous visitors browsing the Watchlist page), origin-restricted CORS |
| `truelayer-sync` | Finance page's bank connection: OAuth exchange, balance/transaction sync via TrueLayer, using the service role key to write `finance_*` tables directly (bypasses RLS, which is fine since the function itself checks the caller is the admin). | `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET`, `ADMIN_EMAIL` (+ auto-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`) | Admin only (checks caller's JWT email) |
| `watchlist-cron-sync` | Server-side port of the Watchlist page's TV/movie sync logic (see below). Refreshes status, episodes, seasons, streaming platform from TMDB for every watchlist item. | `TMDB_API_KEY` (+ auto-injected Supabase vars) | Service role key only (called by pg_cron, not public) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every edge function's environment by the platform — never set those manually. Everything else needs:

```sh
supabase secrets set TMDB_API_KEY=... TRUELAYER_CLIENT_ID=... TRUELAYER_CLIENT_SECRET=... ADMIN_EMAIL=...
supabase functions deploy tmdb-proxy
supabase functions deploy truelayer-sync
supabase functions deploy watchlist-cron-sync
```

### Why there are two watchlist sync implementations

`src/contexts/WatchlistContext.tsx`'s `syncWatchlist` (browser) and `supabase/functions/watchlist-cron-sync/index.ts` (server) implement **the same logic twice**, deliberately — there's no module shared between the Vite/browser bundle and the Deno edge runtime. The browser version only runs while an admin has the Watchlist page open (manual sync button, or auto-triggered on page load); the edge function version runs on a schedule regardless of whether anyone has the site open. **If you change the sync logic, change both.**

### Scheduled sync (pg_cron)

`supabase/20260725_schedule_watchlist_sync.sql` schedules `watchlist-cron-sync` to run daily at 06:00 UTC via `pg_cron`/`pg_net`. It authenticates using the service role key, which it looks up from **Supabase Vault** at run time — the key is never written into the migration file or git history.

To set this up on a fresh project (one-time, run directly in the Supabase SQL Editor — **never commit the second command to git**):

```sql
-- 1. Only if Vault doesn't already have this (modern Supabase projects usually do by default)
select vault.create_secret('<service role key from Project Settings > API>', 'service_role_key');
```

Then apply `supabase/20260725_schedule_watchlist_sync.sql` (SQL Editor, or `supabase db push` once the migration-history is reconciled — see note below).

To check it's actually running: query `sync_log` (`sync_type = 'auto'`) or `cron.job_run_details` in the SQL Editor after the scheduled time passes. Known caveat: the schedule is UTC, so it drifts an hour relative to UK local time across the BST/GMT boundary — not worth over-engineering for a "keep it roughly fresh" job.

### Applying SQL migrations

The `supabase/*.sql` files are **not** in `supabase/migrations/` and don't follow the CLI's strict migration-history conventions (this predates the current maintainer's use of the CLI) — `supabase db push` will fail with a remote-history mismatch until that's reconciled. Until then, apply them directly via the Supabase SQL Editor, in filename order.

## 📦 Deployment

**Frontend** (GitHub Pages): pushing to `main` triggers `.github/workflows/deploy.yml` — installs, lints, builds, deploys `dist/` to Pages. Required repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TMDB_IMAGE_BASE_URL`, `VITE_ADMIN_EMAIL`.

**Edge functions**: not part of CI. Deploy manually (`supabase functions deploy <name>`) whenever `supabase/functions/**` changes.

**Database changes**: apply manually via the SQL Editor (see above) whenever a new `supabase/*.sql` file is added.

## 🔡 Dot-matrix text system

The pixel/LED-style headings and labels ("DHYAN SHYAM", nav links, etc.) render as real text set in [Doto](https://fonts.google.com/specimen/Doto), a Google Font imported in `src/index.css` (`--font-matrix`) — `DotMatrixText` is just a `<span>` with that font applied, no per-character data or generation step involved. Doto is a variable font where the "dots" are literally circles that grow and fuse together as weight increases, so low weights (400-600, see `DotMatrixText.css`) read as distinct dots and heavy weights read as solid strokes — reach for weight, not font-size, if the dot-matrix look isn't obvious enough.

Icons that can't be represented as a font glyph (theme toggle sun/moon, the `+` social-links trigger, the flip-style `DotMatrixClock`) still use the original hand-authored dot-grid approach (`DotMatrixIcon`/`DotMatrixClock` → `DotMatrixGlyph`, backed by `src/data/dot-matrix.json`) — `iconPatterns` for icons, and `charPatterns` (trimmed to just `0-9`/`:`, all `DotMatrixClock` ever renders) for the clock digits. Larger standalone glyphs use a separate 25x25 tier (`scripts/generate-hero-glyphs.py` → `src/data/hero-glyphs.json` → `DotMatrixHeroGlyph`), built from geometric primitives rather than the font.

## 🧠 Codebase knowledge graph (graphify)

This repo has a graphify knowledge graph at `graphify-out/` (gitignored, local-only). If you're an AI agent working in this repo, see `GEMINI.md`/`CLAUDE.md` for the rules — in short: read `graphify-out/GRAPH_REPORT.md` before architecture questions, and run `graphify update .` after making code changes to keep it current.

## 🗄️ Database schema / recreating the backend from scratch

See [SUPABASE_INTEGRATION.md](SUPABASE_INTEGRATION.md).

## ⚖️ License

MIT
