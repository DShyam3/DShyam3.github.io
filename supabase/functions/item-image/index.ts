import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { resolveWithDns } from '../_shared/public-address.ts'
import { findPageImages, readImage, type Want } from './images.ts'

// Two owner-only reads for cleaned card images (see images.ts):
//
//   { action: 'fetch', url }          -> the image's bytes, as octet-stream
//   { action: 'find', url, want }     -> { ok, images } named by a page
//
// The browser does the rest -- removing the background, encoding, storing --
// so nothing here decodes an image or writes anything.
//
// SSRF: both URLs come from the request body, so they are data-chosen. Each,
// and every redirect it leads to, must pass checkOutboundUrl (http or https,
// no credentials, public addresses only) before it is requested; at most
// MAX_IMAGE_BYTES of an image and MAX_PAGE_BYTES of a page are read, and an
// image's bytes go back only once their first bytes say they are an image.

const TIMEOUT_MS = 10_000
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

    let body: { action?: unknown; url?: unknown; want?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request' }, 400)
    }
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url || url.length > MAX_URL_LENGTH) return json({ error: 'Invalid request' }, 400)
    const deps = { fetch, resolve: resolveWithDns, signal: AbortSignal.timeout(TIMEOUT_MS) }

    if (body.action === 'fetch') {
      const image = await readImage(url, deps)
      if (!image.ok) return json(image)
      return new Response(image.bytes, {
        headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
      })
    }
    if (body.action === 'find') {
      const want: Want = body.want === 'icon' ? 'icon' : 'product'
      return json(await findPageImages(url, want, deps))
    }
    return json({ error: 'Invalid request' }, 400)
  } catch (error) {
    console.error('item-image failed:', error)
    return json({ error: 'Something went wrong' }, 500)
  }
})
