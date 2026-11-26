import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { isServiceRoleRequest } from '../_shared/service-role.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { resolveWithDns } from '../_shared/public-address.ts'
import { checkLink, nextCheckRow } from './check.ts'

// Checks every saved link and records what it found in `link_checks`, which
// only the owner can read, so the Links page can show them which links have
// stopped working without telling every visitor. Run daily by
// pg_cron (migration 20261126100000_links_check.sql) with the service role;
// the owner may also call it.
//
// SSRF: the URLs come from the `links` table, which only the owner can write,
// and each one -- and every redirect it leads to -- must pass
// checkOutboundUrl (http or https, no credentials, public addresses only)
// before it is requested. Nothing in the request body names a URL.

/** Time for one link, every redirect included. */
const PER_LINK_MS = 10_000
/** No new link is started after this; the rest go first next run. */
const RUN_BUDGET_MS = 45_000
const CONCURRENCY = 4

interface LinkRow {
  id: string
  url: string
}

interface PreviousCheck {
  link_id: string
  url: string
  checked_at: string
  check_failures: number
  failing_since: string | null
}

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Supabase environment is not configured')
    }

    const authHeader = req.headers.get('Authorization')
    if (!isServiceRoleRequest(authHeader, serviceRoleKey)) {
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const denial = await requireAdmin(userClient)
      if (denial) return json({ error: denial.error }, denial.status)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const [linksResult, checksResult] = await Promise.all([
      admin.from('links').select('id, url'),
      admin.from('link_checks').select('link_id, url, checked_at, check_failures, failing_since'),
    ])
    if (linksResult.error) throw linksResult.error
    if (checksResult.error) throw checksResult.error
    const previous = new Map(
      ((checksResult.data ?? []) as PreviousCheck[]).map(check => [check.link_id, check]),
    )
    // Least recently checked first, so a run cut short by the budget still
    // reaches every link over successive days.
    const lastRun = (link: LinkRow) => previous.get(link.id)?.checked_at ?? ''
    const links = ((linksResult.data ?? []) as LinkRow[]).sort((a, b) => lastRun(a).localeCompare(lastRun(b)))

    const startedAt = Date.now()
    const queue = [...links]
    let checked = 0
    let failed = 0
    const worker = async () => {
      for (let link = queue.shift(); link; link = queue.shift()) {
        if (Date.now() - startedAt > RUN_BUDGET_MS) return
        const result = await checkLink(link.url, {
          fetch,
          resolve: resolveWithDns,
          signal: AbortSignal.timeout(PER_LINK_MS),
        })
        // Stored with the URL it is for: if the owner changes the link
        // mid-run, the page ignores this result and the next run starts its
        // streak afresh.
        const row = nextCheckRow(previous.get(link.id) ?? null, link.url, result, new Date().toISOString())
        const { error: writeError } = await admin
          .from('link_checks')
          .upsert({ link_id: link.id, ...row }, { onConflict: 'link_id' })
        if (writeError) {
          // A link deleted mid-run fails its foreign key here; nothing to keep.
          console.error('links-check: could not save a result:', writeError.message)
          continue
        }
        checked++
        if (row.check_failures > 0) failed++
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // `failed`: links that failed this run, whether or not the page flags them yet.
    return json({ checked, failed, unchecked: links.length - checked })
  } catch (error) {
    console.error('links-check failed:', error instanceof Error ? error.message : error)
    return json({ error: 'Something went wrong' }, 500)
  }
})
