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
// showing nothing.
//
// A sliding window per caller IP. Held in memory rather than in Postgres,
// which is a deliberate trade: a database counter would be exact across
// instances but costs a write on every request, and the thing being protected
// is a free API quota, not data. In memory this is per instance and resets on
// a cold start -- it stops a script hammering the endpoint, which is the
// actual threat, and does not pretend to stop a distributed one.
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 60

const hits = new Map<string, number[]>()

/**
 * Best available caller identity. Supabase sits in front of the function and
 * appends the real client IP to x-forwarded-for, so the *first* entry is the
 * client's own claim and can be spoofed. That is acceptable here: spoofing it
 * costs an attacker nothing but also gains them nothing beyond what a pool of
 * real IPs would, and no decision more serious than "wait a minute" hangs on
 * it.
 */
function callerKey(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for') || ''
    return forwarded.split(',')[0].trim() || 'unknown'
}

function isRateLimited(key: string): boolean {
    const now = Date.now()
    const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
    recent.push(now)
    hits.set(key, recent)

    // Drop keys that have gone quiet, so a long-lived instance does not hold
    // an entry for every IP it has ever seen.
    if (hits.size > 5_000) {
        for (const [k, times] of hits) {
            if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
        }
    }

    return recent.length > MAX_REQUESTS_PER_WINDOW
}

serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req)

    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (isRateLimited(callerKey(req))) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(WINDOW_MS / 1000),
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
