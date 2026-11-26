import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { resolveWithDns } from '../_shared/public-address.ts'
import { readLinkMetadata } from './metadata.ts'

// Reads the name and description a page declares, for the Links add form to
// fill in once the owner pastes a URL. A browser cannot read another site's
// page itself (CORS), so the request is made here. Owner only.
//
// SSRF: the URL comes from the request body, so it is data-chosen. It -- and
// every redirect it leads to -- must pass checkOutboundUrl (http or https, no
// credentials, public addresses only) before it is requested; at most
// MAX_HEAD_BYTES of the page are read, and only two cleaned strings come back.

/** Time for the whole read, every redirect included. */
const TIMEOUT_MS = 8_000
const MAX_URL_LENGTH = 2_048

serve(async (req) => {
  const corsHeaders = {
    ...corsOriginHeader(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase environment is not configured')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const denial = await requireAdmin(userClient)
    if (denial) return json({ error: denial.error }, denial.status)

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request' }, 400)
    }
    const url = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url.trim() : ''
    if (!url || url.length > MAX_URL_LENGTH) return json({ error: 'Invalid request' }, 400)

    const metadata = await readLinkMetadata(url, {
      fetch,
      resolve: resolveWithDns,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return json(metadata)
  } catch (error) {
    console.error('links-metadata failed:', error)
    return json({ error: 'Something went wrong' }, 500)
  }
})
