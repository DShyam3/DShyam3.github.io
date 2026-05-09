import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
