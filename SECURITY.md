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

- **RLS**: enabled on all 40 public tables. Every `finance_*` table, including
  `finance_truelayer_connection` (live bank tokens), is `is_admin()`-only.
  Content tables are anonymous-read, `is_admin()`-write.
- **Edge functions**: browser calls to `truelayer-sync` and
  `merchant-logo-cache` verify the JWT and admin email; `truelayer-sync` also
  accepts the service role only for its Vault-authenticated scheduled sync.
  `tmdb-proxy` is deliberately public but restricted to an endpoint allowlist
  so it cannot be used as a generic TMDB proxy; `watchlist-cron-sync` requires
  the service role key. All four use an origin allowlist for CORS.
- **TrueLayer OAuth (deploy migration and function together)**: the callback
  state is generated with 256 bits of server-side randomness, stored only as a
  SHA-256 hash with a ten-minute expiry, and bound to the exact redirect URI
  and finance profile. The browser verifies its tab-scoped copy first; the
  function atomically consumes the matching state before exchanging a code.
- **Outbound fetches (SSRF)**: `merchant-logo-cache` is the only function that
  requests anything from a host we do not run. It holds the host list as a
  constant; no URL, host or path is ever read from the request body, so it
  cannot be steered. Redirects are followed by hand, at most three hops, and
  only to another host on the same list — an automatic follow is how an
  allowlist is normally escaped. What it stores is decided by magic bytes, not
  by the remote host's `Content-Type`, and capped at 256 KB.
- **Merchant logos, and why they are not hotlinked**: rendering a logo straight
  from a third-party CDN would send that CDN one request per transaction row,
  with the user's IP and referrer, describing where they shop. The logo is
  fetched once server-side instead and served from the `merchant-logos` bucket.
  That bucket is public — a supermarket's logo is public — and holds nothing
  user-specific: object keys are brand slugs, never a profile or transaction
  id. Writes to it are `is_admin()`; the same is true of its index table
  `finance_merchant_logos`, which is public-read by design.
- **Secrets**: the TMDB API key lives only in edge function env, never in the
  bundle. Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_TMDB_IMAGE_BASE_URL` and `VITE_ADMIN_EMAIL` reach the client.
- **Storage**: see migration `20260904110337` — object policies were gated on
  the `authenticated` role rather than `is_admin()`, and are now `is_admin()`.
- **Table grants**: RLS is not the only layer. Supabase's defaults `GRANT ALL`
  to `anon` on every table in `public`, and `TRUNCATE` is **not** filtered by
  row-level security. Migration `20260905160000` revokes those grants on the
  content, watchlist and travel tables and grants back only `SELECT`. Finance
  migrations revoke every `anon` grant from `finance_*` tables; the OAuth
  state table is deliberately included despite being service-role-only in
  normal operation.
- **Auth**: public email signup is enabled on the project. Since every policy
  now checks the admin email, a self-registered user gets nothing, but signup
  should be disabled in the dashboard (Authentication → Sign In / Providers)
  because this is a single-account site.

## Accepted Supabase advisor lints

These show up in `get_advisors(type: "security")` on every run and are
deliberate. Recorded here so a fresh advisor report can be triaged without
re-deriving the reasoning.

| Lint | Why it stays |
| --- | --- |
| `anon_security_definer_function_executable` on `is_admin()` | RLS policy expressions are evaluated with the querying role's own privileges, so revoking `EXECUTE` from `anon`/`authenticated` would break every policy on the project. The function takes no arguments and returns a single boolean about the caller — it leaks nothing an attacker did not already supply. |
| Content tables readable by `anon` | This is a public portfolio. Anonymous `SELECT` on books, links, articles, photos, recipes, the watchlist and travel tables is the product, not a finding. Writes are `is_admin()`-only at both the policy and grant layer. |

Not accepted, still open, and only fixable from the dashboard:

Project ref is `yvtiybyuifkiwyrnjebe`, so each link below is
`https://supabase.com/dashboard/project/yvtiybyuifkiwyrnjebe` + the path given.

- **Public email signup is enabled** — `/auth/providers`, the Email provider
  panel, "Allow new users to sign up". This is the structural fix behind S-1:
  every policy checks one admin address, so a self-registered account gets
  nothing, but it should not be possible to create one on a single-account
  site.
- **Leaked-password protection is disabled** — same Email provider panel.
  Supabase Auth checks candidate passwords against HaveIBeenPwned. **Pro plan
  and above only**; on Free the option is not offered, which is worth knowing
  before hunting for the toggle. Raising the minimum length and requiring mixed
  character classes is available on any plan and lives in the same place.
- **No MFA options enabled.** Enrollment and verification are dashboard-gated
  under Authentication; enabling the TOTP (app authenticator) factor is the
  cheap win on the one account that owns everything.
- **Postgres has outstanding security patches** (`supabase-postgres-15.8.1.030`)
  — the "Upgrade project" button is on `/settings/general`, not under
  Infrastructure. The project goes offline for the upgrade and the window
  scales with database size, so pick a quiet moment. Read replicas would block
  it; this project has none.
