import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// This proxy is intentionally reachable without a Supabase session, since it
// backs the public Watchlist page. To stop it being abused as a free,
// unlimited generic TMDB proxy (which would burn the shared API key's
// quota), only known endpoint shapes actually used by the app are allowed.
const ALLOWED_ENDPOINT_PATTERNS = [
    /^search\/(movie|tv)$/,
    /^movie\/\d+$/,
    /^tv\/\d+$/,
    /^tv\/\d+\/season\/\d+$/,
]

const ALLOWED_ORIGINS = new Set([
    'https://dshyam3.github.io',
    'http://localhost:8080',
    'http://localhost:5173',
])

function buildCorsHeaders(req: Request) {
    const origin = req.headers.get('Origin') || ''
    return {
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://dshyam3.github.io',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    }
}

// --- Rate limiting -------------------------------------------------------
//
// The origin allowlist above is enforced by *browsers*. curl ignores it, so
// without this the endpoint allowlist bounds what can be proxied but not how
// much: a loop could burn the whole TMDB quota and leave the public Watchlist
// with nothing to show.
//
// The counter lives in Postgres, not in this module. An in-memory Map was the
// obvious cheap answer and it does nothing here -- the Edge Runtime does not
// reuse an isolate between requests at this traffic level, so module state is
// empty on every call. Measured: 90 requests in 2 seconds all passed, with a
// diagnostic header reporting a map size of 0 every time.
const WINDOW_SECONDS = 60
const MAX_REQUESTS_PER_WINDOW = 60

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Best available caller identity. Supabase sits in front of this function and
 * appends the real client IP to x-forwarded-for. Leading entries can be
 * supplied by the caller, so use the proxy-appended final entry rather than a
 * spoofable first value. This limiter only protects shared API quota; it is
 * not an authentication or authorization boundary.
 */
function callerKey(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for') || ''
    const hops = forwarded.split(',').map((value) => value.trim()).filter(Boolean)
    return hops[hops.length - 1] || 'unknown'
}

/**
 * Counts the hit and reports whether the caller is over the limit.
 *
 * Fails open. If the database is unreachable the visitor still gets their
 * page: a rate limiter that takes the site down when it breaks is worse than
 * the abuse it prevents, and what is being protected here is a free API
 * quota rather than data.
 */
async function isRateLimited(key: string): Promise<boolean> {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
                p_key: key,
                p_limit: MAX_REQUESTS_PER_WINDOW,
                p_window_seconds: WINDOW_SECONDS,
            }),
        })
        if (!response.ok) return false
        return (await response.json()) === true
    } catch (error) {
        console.error('rate limit check failed, allowing request:', error)
        return false
    }
}

serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req)

    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (await isRateLimited(callerKey(req))) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(WINDOW_SECONDS),
            },
        })
    }

    try {
        const { searchParams } = new URL(req.url)
        const endpoint = searchParams.get('endpoint')

        if (!endpoint) {
            return new Response(JSON.stringify({ error: 'Endpoint is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint))) {
            return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Filter out restricted search params and build the TMDB URL
        const tmdbParams = new URLSearchParams()
        searchParams.forEach((value, key) => {
            if (key !== 'endpoint') {
                tmdbParams.append(key, value)
            }
        })
        tmdbParams.append('api_key', TMDB_API_KEY || '')

        const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${tmdbParams.toString()}`)
        const data = await response.json()

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        // Detail goes to the function log, not to the caller: `error.message`
        // here can carry the upstream URL, which has the TMDB key in it.
        console.error('tmdb-proxy failed:', error)
        return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
