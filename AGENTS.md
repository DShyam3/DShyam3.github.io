# Project rules

## Always fix linting issues (errors and warnings)

After modifying any code file, run `npm run lint`. The lint step must end with
0 errors and 0 warnings before the turn ends. Fix the offending code, or adjust
`eslint.config.js` where the rule itself is wrong.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` over grep -- these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Checks before shipping

- `npm run lint` -- 0 errors, 0 warnings
- `npm run typecheck`
- `npm run build`
- `npm run ship-check` -- should-i-ship launch-readiness scan, writes to `.should-i-ship/` (gitignored)
- `security/AI-CHECKLIST.md` -- the vibe-check audit, run on request: "Run the security audit defined in security/AI-CHECKLIST.md against this project"

# Security rules

Copied verbatim from benavlabs/vibe-check so this stays diffable against
upstream. They are non-negotiable for code generated in this project, read with
the shape of this project in mind:

- **This is a static React SPA on GitHub Pages.** There is no server and no
  middleware, so "set these headers via a single global middleware" cannot be
  followed literally. `SECURITY.md` records what is set instead (CSP via a
  build-time `<meta>`, Referrer-Policy via `<meta>`, a JS frame guard standing
  in for `X-Frame-Options`) and what is out of our control. Read it before
  acting on the Security Headers section.
- **The backend is Supabase**, so the Database and Authorization rules are the
  load-bearing ones here: RLS on every table, `is_admin()` on every write, and
  no policy left as `USING (true)` for anything but public reads.
- **`VITE_SUPABASE_URL` and the publishable key belong in the client.** The
  anon key is public by design and is safe only because RLS is correct --
  which is why the Database rules matter more here than the Secrets ones. No
  other secret may carry the `VITE_` prefix.
- Firebase, Stripe, Python `pickle` and the Express/Next specifics do not apply
  today. They are kept so the file diffs cleanly if the stack grows.

## Secrets

- NEVER put API keys, database credentials, or tokens in frontend code (anything under src/, app/, pages/, components/, public/)
- NEVER put secret keys in environment variables prefixed with NEXT_PUBLIC_, VITE_, or REACT_APP_ (these are bundled into the client)
- NEVER hardcode credentials in source files. Use environment variables loaded server-side only
- The .env file MUST be in .gitignore before the first commit. Verify this before creating any .env file
- Use .env.example with placeholder values only, never real credentials

## Database

- Enable Row Level Security on EVERY Supabase table before deployment. Default policy: deny all. Write explicit policies scoped to auth.uid()
- NEVER set a Supabase RLS policy to `USING (true)` or `FOR ALL` without a WHERE condition
- Firebase Security Rules MUST require `request.auth != null` and scope access to `request.auth.uid`
- NEVER use `pickle.loads`, `pickle.load`, or any deserialization on user-supplied data. Use JSON for all network data exchange

## Authentication and Authorization

- EVERY API route that returns or modifies user data MUST have authentication middleware that runs BEFORE the handler, not inside it
- Unauthenticated requests to protected endpoints MUST return 401
- EVERY route that takes a resource ID MUST verify the authenticated user owns that resource: `current_user.id == resource.owner_id`. This is a SEPARATE check from authentication
- Admin endpoints MUST verify admin role and return 403 for non-admin users
- Session cookies MUST set `httpOnly: true`, `secure: true`, and `sameSite: 'lax'`

## Input and Output

- NEVER concatenate user input into SQL queries. ALWAYS use parameterized queries or ORM methods
- NEVER use `dangerouslySetInnerHTML`, `v-html`, or `innerHTML` with user-supplied content unless it is first sanitized with DOMPurify
- ALL user input MUST be validated server-side. Client-side validation is for UX only
- File uploads MUST validate file type by reading magic bytes, not by checking the filename extension. Rename all uploads to UUIDs server-side. Store on a separate domain (S3, R2, GCS), never on the app origin

## URL Fetching (SSRF Prevention)

- If the application fetches URLs provided by users (link previews, image proxies, URL validators), it MUST:
  - Block all private/internal IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1
  - Allow only http and https schemes
  - Resolve the hostname and check the IP BEFORE making the request

## Security Headers

- Set these headers on ALL responses via a single global middleware:
  - `Content-Security-Policy: default-src 'self'` (adjust as needed for your app)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- In Express, use the `helmet` package. In Next.js, set headers in next.config.js

## CORS

- NEVER set CORS origin to `*` (wildcard). Use an explicit allowlist of your actual domains
- NEVER combine `origin: '*'` with `credentials: true`

## Rate Limiting

- Login, registration, and password reset endpoints MUST have rate limiting (block after N failed attempts per IP within a time window)
- Do NOT trust X-Forwarded-For for rate limiting unless behind a trusted reverse proxy

## Payments

- Stripe webhook endpoints MUST verify the signature using `stripe.Webhook.construct_event` (or equivalent) on every request. Reject any request with an invalid or missing signature
- Webhook handlers MUST track processed event IDs and skip duplicates (idempotency)
- Handle the full event lifecycle: payment_intent.succeeded, invoice.payment_failed, customer.subscription.deleted, customer.subscription.past_due

## Error Handling

- NEVER expose stack traces, SQL errors, file paths, or library names in API responses
- Production error responses MUST return only generic messages: `{"error": "Something went wrong"}`
- Full error details go to server-side logs only
- Debug mode / development error pages MUST be disabled in production

## Password Hashing

- ALWAYS use bcrypt, Argon2, or scrypt for password hashing
- NEVER use MD5, SHA-1, or plain SHA-256 for passwords

## Dependencies

- Before installing any package, verify it exists on the official registry with a reasonable download count and history
- Pin exact versions in package.json / requirements.txt (no ^ or ~ in production)
- Commit lock files (package-lock.json, poetry.lock, yarn.lock)
