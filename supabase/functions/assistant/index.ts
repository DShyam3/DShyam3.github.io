import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdminUser } from '../_shared/require-admin.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import {
  buildUpstreamBody,
  configuredProviders,
  LIMITS,
  resolveModel,
  upstreamHeaders,
} from './providers.ts'

// The site assistant's model proxy (REHAUL_PLAN.md 7.6). It holds the keys
// and nothing else: tools run in the browser, against the same pure modules
// the pages use, so no figure is computed here and no table is read here.
//
// Two actions, both administrator-only:
//   { action: 'providers' }                       -> which rows have a key set
//   { action: 'chat', provider: <id>, request }  -> one model call
//
// Order matters: the session and is_admin() are checked before the body is
// even read, and the rate limit before any key is used. Error bodies are
// generic; the detail goes to the function log.

const WINDOW_SECONDS = 600
/** Model calls per administrator per window. One question can take several. */
const MAX_CALLS_PER_WINDOW = 40
// A turn may think before it answers, and a server-side fallback re-runs
// inside the same call. Under the platform's 150-second idle limit.
const UPSTREAM_TIMEOUT_MS = 120_000

function buildCorsHeaders(req: Request) {
  return {
    ...corsOriginHeader(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // is_admin() through the caller's own JWT, so this function and every RLS
    // policy agree on who an administrator is.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const caller = await requireAdminUser(userClient)
    if (!('userId' in caller)) {
      return json(caller.status, { error: caller.status === 401 ? 'Unauthorized' : 'Forbidden' })
    }

    const declared = Number(req.headers.get('Content-Length') ?? '0')
    if (declared > LIMITS.maxBodyChars * 4) return json(413, { error: 'Request too large' })
    const raw = await req.text()
    if (raw.length > LIMITS.maxBodyChars) return json(413, { error: 'Request too large' })
    let parsed: Record<string, unknown>
    try {
      const value = JSON.parse(raw)
      if (!value || typeof value !== 'object' || Array.isArray(value)) return json(400, { error: 'Bad request' })
      parsed = value
    } catch {
      return json(400, { error: 'Bad request' })
    }

    const env = (name: string) => Deno.env.get(name)

    if (parsed.action === 'providers') {
      // No key and no URL leaves: the id, a label, the protocol the browser
      // must speak, and the model, which the body below sets regardless.
      const providers = configuredProviders(env).map((row) => ({
        id: row.id,
        label: row.label,
        protocol: row.protocol,
        model: resolveModel(row, env),
      }))
      return json(200, { providers })
    }

    if (parsed.action !== 'chat') return json(400, { error: 'Bad request' })

    // Unknown and unconfigured look the same from outside.
    const row = configuredProviders(env).find((p) => p.id === parsed.provider)
    if (!row) return json(400, { error: 'Bad request' })

    // Fails closed, unlike the TMDB proxy's limiter. What this one protects is
    // a paid key, and an outage that lets calls through unmetered is the
    // expensive way to fail.
    const admin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: overLimit, error: limitError } = await admin.rpc('check_rate_limit', {
      p_key: `assistant:${caller.userId}`,
      p_limit: MAX_CALLS_PER_WINDOW,
      p_window_seconds: WINDOW_SECONDS,
    })
    if (limitError) {
      console.error('assistant rate limit check failed, refusing:', limitError.message)
      return json(503, { error: 'Something went wrong' })
    }
    if (overLimit === true) {
      return json(429, { error: 'Too many requests', retry_after: WINDOW_SECONDS }, { 'Retry-After': String(WINDOW_SECONDS) })
    }

    const built = buildUpstreamBody(row, resolveModel(row, env), parsed.request)
    if ('error' in built) {
      console.warn('assistant request refused:', built.error)
      return json(400, { error: 'Bad request' })
    }

    const key = Deno.env.get(row.secret)!.trim()
    const upstream = await fetch(row.url, {
      method: 'POST',
      headers: upstreamHeaders(row, key),
      body: JSON.stringify(built.body),
      // The row's URL is the only host this reaches; a redirect would be a
      // second one.
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (!upstream.ok) {
      // Status and the vendor's error type only: a vendor's message can quote
      // the request, and the request carries the owner's figures.
      const detail = await upstream.json().catch(() => null) as { error?: { type?: string; code?: string } } | null
      console.error('assistant upstream failed:', row.id, upstream.status, detail?.error?.type ?? detail?.error?.code ?? '')
      if (upstream.status === 429) {
        const retryAfter = Number(upstream.headers.get('retry-after')) || 60
        return json(429, { error: 'Too many requests', retry_after: retryAfter }, { 'Retry-After': String(retryAfter) })
      }
      return json(502, { error: 'Something went wrong' })
    }

    return json(200, { reply: await upstream.json() })
  } catch (error) {
    console.error('assistant failed:', error instanceof Error ? error.name : 'unknown')
    return json(500, { error: 'Something went wrong' })
  }
})
