import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { isServiceRoleRequest } from '../_shared/service-role.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { recordApiUsage } from '../_shared/api-usage.ts'

const GOV_UK_HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json'
const REGIONS = ['england-and-wales', 'scotland', 'northern-ireland'] as const

interface GovUkEvent {
  date?: string
  title?: string
}

serve(async (req) => {
  const corsHeaders = {
    ...corsOriginHeader(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }

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
    const isServiceRole = isServiceRoleRequest(authHeader, serviceRoleKey)
    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const denial = await requireAdmin(userClient)
      if (denial) {
        return new Response(JSON.stringify({ error: denial.error }), {
          status: denial.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const fetchStartedAt = Date.now()
    const res = await fetch(GOV_UK_HOLIDAYS_URL, { signal: AbortSignal.timeout(15_000) })
    await recordApiUsage({
      provider: 'bank_holidays',
      endpoint: 'bank-holidays.json',
      source: isServiceRole ? 'cron' : 'edge',
      statusCode: res.status,
      durationMs: Date.now() - fetchStartedAt,
    })
    if (!res.ok) {
      throw new Error(`gov.uk returned ${res.status}`)
    }
    const data = await res.json() as Record<string, { events?: GovUkEvent[] } | undefined>
    const updatedAt = new Date().toISOString()

    const rows: { region: string; date: string; title: string; updated_at: string }[] = []
    for (const region of REGIONS) {
      const events = data[region]?.events ?? []
      for (const event of events) {
        if (
          typeof event.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
          typeof event.title === 'string' &&
          event.title.trim()
        ) {
          rows.push({
            region,
            date: event.date,
            title: event.title.trim(),
            updated_at: updatedAt,
          })
        }
      }
    }

    if (rows.length === 0) {
      throw new Error('No bank holiday rows parsed from gov.uk')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabaseAdmin
      .from('uk_bank_holidays')
      .upsert(rows, { onConflict: 'region,date' })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('sync-bank-holidays failed:', error)
    return new Response(JSON.stringify({ error: 'Failed to sync bank holidays' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
