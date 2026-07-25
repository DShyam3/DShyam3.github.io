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

serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req)

    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
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
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
