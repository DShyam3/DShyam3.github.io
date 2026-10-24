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

- **RLS**: enabled on all 59 public tables (hosted, 2026-10-24; the public schema
  also holds one view). Every `finance_*` table, including
  `finance_truelayer_connection` (live bank tokens), is `is_admin()`-only at the
  policy layer. Since `20261024150000` (applied to hosted 2026-10-24), that table
  has no `authenticated` grant either, so only `service_role` (the `truelayer-sync`
  function) reaches it.
  Content tables are anonymous-read, `is_admin()`-write. Policies ask it as
  `(SELECT public.is_admin())`, which runs once per statement rather than once
  per row and returns the same answer (migrations `20261024120000` for public
  tables and `20261024130000` for storage, applied to hosted 2026-10-24).
  `src/integrations/supabase/rls-admin-check.test.ts` replays every migration
  and fails on any policy, public or storage, that calls it bare.
- **Edge functions**: browser calls to `truelayer-sync`,
  `merchant-logo-cache` and `watchlist-cron-sync` verify the JWT and then call
  `public.is_admin()` through the caller's own token
  (`_shared/require-admin.ts`), so a function and an RLS policy cannot
  disagree about who is an administrator; `truelayer-sync` and
  `watchlist-cron-sync` also accept the service role, for their
  Vault-authenticated scheduled runs. `tmdb-proxy` is deliberately public but
  restricted to an endpoint allowlist so it cannot be used as a generic TMDB
  proxy. All four use an origin allowlist for CORS.
- **Rate limits**: every function that spends a third-party call limits it
  server-side in the service-role-only `rate_limits` table -- `tmdb-proxy`
  per IP, the admin-triggered syncs by a cooldown between runs
  (`_shared/cooldown.ts`), `merchant-logo-cache` per five minutes. Scheduled
  runs are exempt; a refused call answers 429 with `retry_after`. See
  README.md, *Spam protection on the edge functions*.
- **TrueLayer OAuth (deploy migration and function together)**: the callback
  state is generated with 256 bits of server-side randomness, stored only as a
  SHA-256 hash with a ten-minute expiry, and bound to the exact redirect URI
  and finance profile. The browser verifies its tab-scoped copy first; the
  function atomically consumes the matching state before exchanging a code.
- **Outbound fetches (SSRF)**: `merchant-logo-cache` is the only function that
  requests anything from a host we do not run, and it talks to exactly two:
  `api.brandfetch.io` and `cdn.brandfetch.io`. No URL, host or path is ever
  read from the request body, so it cannot be steered. The domain that brand
  search returns is never fetched directly either — it is handed back to
  Brandfetch's own CDN as a path — so a hostile search response cannot point us
  at an internal address. Neither request follows a redirect on trust: the
  brand search refuses redirects outright and treats a 3xx as a failed search,
  and the image fetch follows at most 3, re-checking every hop against the
  same two-host allowlist and refusing anything that is not `https`. What gets stored is decided by magic bytes, not by
  the remote host's `Content-Type`, capped at 256 KB, and SVG is refused:
  served from our own storage origin it could execute script if opened
  directly.
- **Merchant logos, and why they are not hotlinked**: rendering a logo straight
  from a third-party CDN would send that CDN one request per transaction row,
  with the user's IP and referrer, describing where they shop. The logo is
  resolved once server-side instead and served from the `merchant-logos`
  bucket. That bucket is public — a supermarket's logo is public — and its
  object keys are brand slugs, never a profile or transaction id. Writes to it
  are `is_admin()`; the same is true of its index table
  `finance_merchant_logos`. **Finding (2026-10-24), fixed on hosted:** the index
  and the bucket's object list were readable by anon, and they are not free of
  user data. `merchant-logo-cache` resolves only brands found in the owner's
  transactions, so the slugs (with `resolved_at`) said which directory brands
  the owner pays — 21 on hosted. `20261024140000` (applied to hosted 2026-10-24)
  makes both admin-only: the index's public read policy is dropped, anon's
  privileges on it are revoked, and the bucket's public list policy is replaced
  by an admin-only read. Images still load through public URLs, which need
  neither read; the only in-app reader of the index is admin-gated. Loading a
  logo over HTTP after the change is **unverified live**: the checks ran in SQL,
  and no request has yet been made to the project's public storage route. One gap stays open:
  the public object route still answers "exists" or "no such key" for a guessed
  `<slug>.<ext>`, so a guessed brand can be confirmed. It is an open line in
  `REHAUL_PLAN.md`.
- **What a merchant lookup discloses**: resolving a brand to a logo sends a
  name to Brandfetch, so only names from `src/lib/finance/merchant-directory.ts`
  are ever sent — public brand names committed to our own source. A merchant
  the directory does not name is never queried, so the ledger cannot leak
  through this path: not a counterparty, not an employer, not an account label,
  not the account holder's own name.
  This replaced a frequency threshold, which was the wrong control. Brand
  search is fuzzy and never answers "no such brand" — asked about a person's
  name it returns a real company with real confidence — and a transfer labelled
  with the account holder's name recurs happily, so it passed the threshold and
  resolved to an unrelated business whose logo then rendered on the row. Rows
  cached under a slug the directory no longer names are deleted, object and
  all, at the start of every run.
  Each brand is asked about once for the whole install, with no user, amount or
  date attached, and the answer is cached in our bucket so it is never asked
  again. `BRANDFETCH_CLIENT_ID` lives in the function's env and carries no
  `VITE_` prefix, so it never reaches the bundle.
- **Secrets**: the TMDB API key lives only in edge function env, never in the
  bundle. Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_TMDB_IMAGE_BASE_URL` and `VITE_ADMIN_EMAIL` reach the client.
- **Storage**: see migration `20260904110337` — object policies were gated on
  the `authenticated` role rather than `is_admin()`, and are now `is_admin()`.
  Migration `20261024130000` rewrites the 14 admin policies on
  `storage.objects` to pair each bucket test with the wrapped check,
  `bucket_id = '<bucket>' AND (SELECT public.is_admin())`, changing only the
  call and refusing to run unless every policy reads exactly as expected. On
  the local stack, before and after, anon and a signed-in non-admin can
  neither list, download, sign a URL for, upload, update nor delete a
  `finance-documents` object, and the administrator can do all six. On hosted
  (2026-10-24, roles simulated inside a rolled-back transaction) anon and a
  non-admin read none of the bucket's objects and cannot upload to it; the
  administrator reads all of them and can.
- **Table grants**: RLS is not the only layer. Supabase's defaults `GRANT ALL`
  to `anon` on every table in `public`, and `TRUNCATE` is **not** filtered by
  row-level security. Migration `20260905160000` revokes those grants on the
  content, watchlist and travel tables and grants back only `SELECT`. Finance
  migrations revoke `anon`'s grants from `finance_*` tables, except
  `finance_merchant_logos` (see below). The OAuth state table is deliberately
  included despite being service-role-only in normal operation. The same
  defaults gave `authenticated` `TRUNCATE`, `REFERENCES` and `TRIGGER` as well.
  Migration `20261024150000` narrows `authenticated` on 50 tables. 48 keep
  `SELECT`, `INSERT`, `UPDATE` and `DELETE`. `finance_truelayer_connection` and `finance_truelayer_oauth_states`
  get no `authenticated` grant at all, so only `service_role` (the
  `truelayer-sync` edge function) holds any grant on them: the first stores
  TrueLayer access and refresh tokens in plain columns, and the grant was the
  only thing that let an admin JWT read them through PostgREST.
  `finance_merchant_logos` is one of the 48: `20261024140000` revokes `anon`'s
  privileges on it and drops its public read policy, and `20261024150000`
  narrows `authenticated`. `20261024150000` also turns the `postgres` default
  privileges into an allowlist: a new table gives `authenticated` the four data
  verbs and `anon` nothing, and a public-read table grants `anon` `SELECT` in its
  own schema file. Its post-check rolls the migration back if anything is still
  wider. Both migrations were applied to hosted on 2026-10-24 with
  `supabase db push`, and checked read-only afterwards: no public relation gives
  `anon` or `authenticated` TRUNCATE, REFERENCES or TRIGGER; `authenticated`
  holds only the four data verbs (or SELECT) per table and nothing on the two
  TrueLayer tables; `anon` holds SELECT on 20 tables and nothing on
  `finance_merchant_logos`; and the `postgres` default table ACL gives
  `authenticated` the four verbs and `anon` nothing, with no global row. A live
  HTTP check of the API and storage routes is **unverified**.
- **Auth**: public email signup is enabled on the project. Since every policy
  checks `public.is_admin()`, and that reads the `admin_users` table, a
  self-registered user gets nothing — the account exists but holds no grant.
  Signup should still be disabled in the dashboard (Authentication → Sign In /
  Providers) because this is a single-account site. Disable *signup*, not the
  email provider: the provider toggle gates sign-in too, and turning it off
  locks the password box out of the site.

- **Administrator identity**: a row in `public.admin_users`, keyed on
  `auth.users.id`. It used to be an email literal inside `is_admin()`, which
  meant a second administrator or a test account needed a migration, and which
  rested on a claim the account holder can change. The table is readable by an
  administrator and writable only by the service role — an admin session cannot
  grant admin rights over the API. Adding one is a deliberate SQL statement.

## Accepted Supabase advisor lints

These show up in `get_advisors(type: "security")` on every run and are
deliberate. Recorded here so a fresh advisor report can be triaged without
re-deriving the reasoning.

| Lint | Why it stays |
| --- | --- |
| `anon_security_definer_function_executable` on `is_admin()` | RLS policy expressions are evaluated with the querying role's own privileges, so revoking `EXECUTE` from `anon`/`authenticated` would break every policy on the project. The function takes no arguments and returns a single boolean about the caller — it leaks nothing an attacker did not already supply. |
| Content tables readable by `anon` | This is a public portfolio. Anonymous `SELECT` on books, links, articles, photos, recipes, the watchlist and travel tables is the product, not a finding. Writes are `is_admin()`-only at both the policy and grant layer. |
| `rls_enabled_no_policy` (INFO) on `rate_limits` and `finance_truelayer_source_sync` | RLS is on and no policy is written, on purpose. Both tables are service-role-only: `anon` and `authenticated` hold no grant, and service_role bypasses RLS. A policy would add nothing except a route to them. |

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

## Readiness scan triage (2026-10-23)

The scan remains unsuppressed. These findings have different exposure and follow-up
requirements; a successful build does not mean the advisories are fixed.

### Build-tool dependency follow-up

- `braces@3.0.3` arrives through Tailwind's watch/glob tools and the TypeScript
  ESLint tooling. The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  was withdrawn on 2026-10-23 as not practically exploitable. The package is
  unchanged; disappearance from the refreshed scan is an advisory withdrawal,
  not a code fix. Tailwind's inputs remain repository-defined globs, and no
  application or Edge Function import was found.
- `postcss-selector-parser` is pinned to 7.1.7 through `package.json` overrides
  for Tailwind and postcss-nested. This includes the linear-time parsing fix in
  the [upstream advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
  Tailwind 3 still requests parser 6, so this is an explicitly validated major
  override: a clean install, lint, both typechecks, 1,001 tests and production
  build pass, and both emitted CSS files are byte-identical to the parser 6.1.4
  baseline. This covers the current site's CSS, not every possible future
  selector. Recheck the override when upgrading either parent and remove it
  when both parents request a patched version themselves. npm audit reports
  zero vulnerabilities on 2026-10-23; this is not a whole-application security audit.
- The unused `@tailwindcss/typography` dependency has been removed, along with its
  separate parser 6.0.10 copy. It was not registered in the Tailwind plugin list.

### Potential N+1 queries

The scanner's four-file finding is reviewed, not resolved or suppressed:

| Location | Observed behaviour | Follow-up |
| --- | --- | --- |
| `FinanceDataContext.tsx` | Transaction reads paginate; other finance collections still use single responses. Inserts, ID lookups and deletes batch at 100. Updates group identical patches, then batch IDs. Distinct patches can still require individual requests. | Measure large saves before changing ordering or profile scoping. |
| `TaxIncomeSettingsDialog.tsx` | Reset performs seven fixed table deletes in parallel. | Request count does not grow with row count; reset atomicity is a separate risk. |
| `TransactionsTab.tsx` | Flagged deletes include local Set operations; bulk edits pass rows to the context's batching. | No per-row request established at these call sites. |
| `WatchlistContext.tsx` | Initial reads paginate. Show imports fetch/insert per season with batched episodes. Favourite-facts sync makes sequential TMDB and update requests, capped at 50, with cancellation between items. | Measure import/sync latency and concurrency; preserve partial-failure and cancellation behaviour when batching. |

A [local synthetic paged-read benchmark](performance/README.md) now measures
movie and private-profile transaction reads through the real helper and REST API.
It does not measure full providers, saves, TV nesting, TMDB sync or live workloads.
The outstanding Watchlist cron CPU and finance save/race verification tasks remain open.

### Newly reported dependency follow-up (2026-10-24)

The fresh scan reports `zod@3.25.76` under
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), patched in
4.6.6. The advisory concerns memory exhaustion while validating oversized
collections. Exposure analysis and a validated major-version migration remain
open. The zero-vulnerability npm audit above is dated 2026-10-23 and is not a
claim about the refreshed advisory database.
