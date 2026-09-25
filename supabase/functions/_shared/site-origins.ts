/**
 * The browser origins an edge function will answer, and the redirect URIs
 * built from them.
 *
 * This repo is a personal site, but it is also a fork's starting point: clone
 * it, deploy it, and the app is now serving from a different domain. Origins
 * hard-coded per function meant every fork editing four files by hand, and a
 * mistake in any one of them either breaks CORS for the real domain or (the
 * OAuth allowlist in `truelayer-sync`) accepts a redirect to somewhere it
 * should not. One value, read once, fixes both: the deployer sets it, every
 * function agrees, and there is nothing left to keep in sync.
 *
 * `SITE_ORIGIN` must be set as a function secret before deploying --
 * `npx supabase secrets set SITE_ORIGIN=https://your-domain` -- or the live
 * site is refused. `corsOriginHeader` fails closed: with no valid
 * `SITE_ORIGIN` and a request `Origin` that is not on the allowlist, it
 * returns an empty object -- no `Access-Control-Allow-Origin` header at all,
 * so the browser has nothing to trust the response with. It never echoes the
 * literal string a sandboxed iframe or a `data:`/`file:` document sends as
 * its `Origin` header, which a browser would otherwise treat as a grant to
 * that document.
 */

/**
 * Trims and validates a candidate origin. Accepted: an absolute origin with
 * no path, query or trailing slash, on `https:`, or on `http:` when the host
 * is `localhost` -- the one scheme a browser will treat as a secure context
 * without a certificate, and only for local development.
 */
function normaliseOrigin(value: string | undefined | null): string | null {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '')
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.origin !== trimmed) return null

  if (url.protocol === 'https:') return trimmed
  if (url.protocol === 'http:' && url.hostname === 'localhost') return trimmed
  return null
}

/**
 * The local dev servers every function has allowed to date -- `vite preview`
 * and `vite dev` across the ports this repo's tooling has used.
 */
const LOCAL_DEV_ORIGINS: ReadonlySet<string> = new Set([
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:5173',
])

/**
 * Builds the origin allowlist and CORS helpers for a given `SITE_ORIGIN` env
 * value. Pure, so it is the thing under test: it takes the configured origin
 * as a parameter instead of reading `Deno.env` itself. The exports below call
 * it once, against the real environment, at module load.
 */
export function buildOrigins(siteOriginEnv: string | undefined | null) {
  const raw = (siteOriginEnv ?? '').trim()
  const siteOrigin = normaliseOrigin(siteOriginEnv)
  // Set but rejected -- an uppercase host, a trailing path, a non-https,
  // non-localhost scheme -- as opposed to simply unset.
  const rejectedSiteOriginEnv = raw && !siteOrigin ? raw : null

  const allowedOrigins: ReadonlySet<string> = new Set([
    ...(siteOrigin ? [siteOrigin] : []),
    ...LOCAL_DEV_ORIGINS,
  ])

  return {
    siteOrigin,
    allowedOrigins,
    rejectedSiteOriginEnv,

    /**
     * The `Access-Control-Allow-Origin` header, as an object to spread into
     * a response's headers. Echoes the request's own `Origin` when it is on
     * the allowlist, so the header still varies per caller; otherwise falls
     * back to the configured site origin if set; otherwise omits the header
     * entirely rather than emit a value that matches every request.
     */
    corsOriginHeader(req: Request): Record<string, string> {
      const origin = req.headers.get('Origin') || ''
      if (allowedOrigins.has(origin)) return { 'Access-Control-Allow-Origin': origin }
      if (siteOrigin) return { 'Access-Control-Allow-Origin': siteOrigin }
      return {}
    },

    /** Every allowed origin with `path` appended, for an OAuth redirect allowlist. */
    allowedRedirectUris(path: string): ReadonlySet<string> {
      return new Set(Array.from(allowedOrigins, (origin) => `${origin}${path}`))
    },
  }
}

/**
 * Reads `SITE_ORIGIN` without requiring `--allow-env` to be granted. The
 * deployed edge runtime always grants it; a `deno test` run that has not
 * asked for it should see an unset `SITE_ORIGIN` rather than crash the whole
 * module on import -- unset is exactly the fail-closed state this module
 * already handles.
 */
function readSiteOriginEnv(): string | undefined {
  try {
    return Deno.env.get('SITE_ORIGIN')
  } catch {
    return undefined
  }
}

const configured = buildOrigins(readSiteOriginEnv())

if (configured.rejectedSiteOriginEnv) {
  // Silence here makes a typo read as "the site is down" instead of what it
  // is -- a misconfigured secret. The rejected value is a public origin, not
  // a secret, so it is safe to log; it is capped in case something much
  // longer than an origin ends up in the variable by mistake.
  console.warn(
    `SITE_ORIGIN is set but is not a valid origin (need an https:// origin with no path, ` +
      `query or trailing slash, or http://localhost): ${configured.rejectedSiteOriginEnv.slice(0, 200)}`,
  )
}

/** The deployed site's origin, or null when unset or invalid. */
export const SITE_ORIGIN = configured.siteOrigin

/** Every origin a function may answer: the deployed site, plus local dev. */
export const ALLOWED_ORIGINS = configured.allowedOrigins

/**
 * The `Access-Control-Allow-Origin` header, as an object to spread into a
 * response's headers. See `buildOrigins` for the fallback behaviour.
 */
export const corsOriginHeader = configured.corsOriginHeader

/** Every allowed origin with `path` appended, for an OAuth redirect allowlist. */
export const allowedRedirectUris = configured.allowedRedirectUris
