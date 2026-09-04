# Security posture

This site is a static React SPA hosted on GitHub Pages (`dshyam3.github.io`).
GitHub Pages does not allow custom HTTP response headers, so anything normally
delivered as a header has to be either declared in the document or accepted as
out of our control. This file records both, so scanner reports can be triaged
quickly.

## Implemented

| Control | Where | Notes |
| --- | --- | --- |
| Content-Security-Policy | `<meta http-equiv>` injected at build time by the `inject-csp-meta` plugin in `vite.config.ts` | Build-only, because the dev server needs inline scripts and `eval` for the react-refresh preamble and HMR. Supabase origins are read from `VITE_SUPABASE_URL`. |
| Referrer-Policy | `<meta name="referrer" content="strict-origin-when-cross-origin">` in `index.html` | Equivalent to the header for this document. |
| Clickjacking defence | `src/lib/frame-guard.ts`, called from `src/main.tsx` | `X-Frame-Options` needs a header, and CSP `frame-ancestors` is ignored in a `<meta>` policy. The script breaks the page out of any cross-origin frame. |
| HTTPS enforcement | GitHub Pages sends `Strict-Transport-Security: max-age=31556952`, and `github.io` is on the browser HSTS preload list | `includeSubDomains`/`preload` on our own response are not settable, but preload coverage already applies to the domain. |

### Changing the CSP

Edit the `policy` array in `vite.config.ts`. Any new third-party host (analytics,
API, font provider) must be added to the matching directive or the browser will
block it. Verify with `npm run build && npm run preview` and check the console
for `Content Security Policy` violations before deploying.

Current allowances worth knowing about:

- `script-src` allows only `'self'` and `https://cloud.umami.is` (analytics).
- `connect-src` allows Supabase (HTTPS + WSS), the Umami ingest endpoints,
  Google Books, TMDB and `www.gov.uk` (bank holidays).
- `style-src` includes `'unsafe-inline'`: React inline style attributes and the
  `<style>` element injected by the shadcn/Recharts chart component require it.
- `img-src https:` is deliberately broad — book covers, posters and flags come
  from user-supplied URLs stored in the database.

## Not fixable on GitHub Pages

These appear in scanner output and cannot be resolved without moving the site
behind a CDN/proxy (e.g. a custom domain on Cloudflare, where Transform Rules
can add response headers):

- `X-Frame-Options` — mitigated by the frame guard above.
- `X-Content-Type-Options: nosniff` — no `<meta>` equivalent exists.
- `Permissions-Policy` — header only.
- `Cache-Control` — GitHub Pages sends `max-age=600` for all assets.
- `Access-Control-Allow-Origin: *` — GitHub Pages sets this on every static
  asset. Everything served here is public, so there is no data exposure; the
  private data lives behind Supabase, where CORS and Row Level Security are
  configured separately.
- `Server: GitHub.com` — set by the host.
- COOP / COEP / CORP — header only, and not needed for this site (no cross-origin
  isolation requirements, no `SharedArrayBuffer`).

## Reviewed, no action taken

- **Supabase anon key in the client bundle.** Expected: it is the publishable
  key. Access control depends entirely on Row Level Security policies in
  `supabase/migrations`.
- **`dangerouslySetInnerHTML`.** One use in application code,
  `src/components/ui/chart.tsx`, which builds a CSS variable block from a
  developer-defined chart config. No user input reaches it. Scanner counts of
  more occurrences come from the minified vendor bundle (React internals).
- **Subresource Integrity on the Umami script.** `cloud.umami.is/script.js` is a
  rolling URL with no versioned filename, so an `integrity` hash would break the
  site on the vendor's next release. Self-hosting the script is the way to get
  SRI here if the trade-off is ever worth it.

## What the external scanner cannot see

The public scan only reads response headers and the served HTML. The real
attack surface of this site is Supabase, and it was audited separately
(2026-09-04):

- **RLS**: enabled on all 39 public tables. Every `finance_*` table, including
  `finance_truelayer_connection` (live bank tokens), is `is_admin()`-only.
  Content tables are anonymous-read, `is_admin()`-write.
- **Edge functions**: `truelayer-sync` verifies the JWT and the admin email;
  `tmdb-proxy` is deliberately public but restricted to an endpoint allowlist so
  it cannot be used as a generic TMDB proxy; `watchlist-cron-sync` requires the
  service role key. All three use an origin allowlist for CORS.
- **Secrets**: the TMDB API key lives only in edge function env, never in the
  bundle. Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_TMDB_IMAGE_BASE_URL` and `VITE_ADMIN_EMAIL` reach the client.
- **Storage**: see `20260904_secure_storage_object_policies.sql` — object
  policies were gated on the `authenticated` role rather than `is_admin()`.
- **Auth**: public email signup is enabled on the project. Since every policy
  now checks the admin email, a self-registered user gets nothing, but signup
  should be disabled in the dashboard (Authentication → Sign In / Providers)
  because this is a single-account site.
