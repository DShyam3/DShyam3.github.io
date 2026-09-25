import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { buildTrueLayerTransactionQuery } from '../_shared/truelayer-transaction-query.ts'
import { requireAdmin } from '../_shared/require-admin.ts'
import { claimCooldown, cooldownResponse, releaseCooldown } from '../_shared/cooldown.ts'
import { groupRowsByColumns } from '../_shared/upsert-batches.ts'
import { corsOriginHeader, allowedRedirectUris } from '../_shared/site-origins.ts'

// A callback is safe only when its destination is an exact, registered app
// URL. This mirrors the browser origins but deliberately includes the
// `/finance` callback path as part of the allowlist.
const ALLOWED_REDIRECT_URIS = allowedRedirectUris('/finance')
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

/**
 * Gap enforced between two manual bank syncs. Every sync walks every linked
 * account at the bank, and banks throttle how often a connection may be read,
 * so a button pressed on repeat spends that allowance for nothing new. The
 * 05:00 pg_cron run is exempt; linking a bank clears it (see exchange_code).
 */
const MANUAL_SYNC_COOLDOWN_SECONDS = 15 * 60
const MANUAL_SYNC_COOLDOWN_KEY = 'truelayer-sync:manual'

function isAllowedRedirectUri(value: unknown): value is string {
  return typeof value === 'string' && ALLOWED_REDIRECT_URIS.has(value)
}

function createOAuthState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function isValidOAuthState(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildCorsHeaders(req: Request) {
  return {
    ...corsOriginHeader(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

/**
 * TrueLayer uses this value to apply provider call limits to the person who
 * authorised the connection, rather than to our shared Edge Function IP.
 * It is deliberately transient: validate the proxy-supplied value, forward it
 * only while serving that person's manual sync, and never write it to Postgres.
 */
function getPsuIp(req: Request): string | null {
  const candidate = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is either internal service role (e.g. pg_cron) or authenticated admin
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })

      // Asks public.is_admin() through the caller's own JWT, so this function
      // and every RLS policy agree on who an administrator is.
      const denial = await requireAdmin(userClient)
      if (denial) {
        if (denial.status === 401) {
          console.warn('TrueLayer request authentication failed')
        }
        return new Response(JSON.stringify({ error: denial.error }), {
          status: denial.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const psuIp = isServiceRole ? null : getPsuIp(req)
    const trueLayerDataHeaders = (accessToken: string) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'X-Client-Correlation-Id': crypto.randomUUID(),
      }
      if (psuIp) headers['X-PSU-IP'] = psuIp
      return headers
    }

    // Initialize Supabase Client with service key to read/write credentials
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Every non-template finance row carries a profile_id, and the database
    // enforces it with a CHECK (Phase 7.1). This function writes accounts and
    // transactions, so it needs the operator's own profile before it can.
    const { data: selfProfile } = await supabaseAdmin
      .from('finance_profiles')
      .select('id')
      .eq('is_self', true)
      .maybeSingle()
    const selfProfileId = selfProfile?.id ?? null

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { action } = body

    let truelayerClientId = Deno.env.get('TRUELAYER_CLIENT_ID')
    let truelayerClientSecret = Deno.env.get('TRUELAYER_CLIENT_SECRET')

    if (!truelayerClientId || !truelayerClientSecret) {
      console.error('TrueLayer credentials are not configured')
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Clean up literal quotes or spaces
    truelayerClientId = truelayerClientId.trim().replace(/^["']|["']$/g, '')
    truelayerClientSecret = truelayerClientSecret.trim().replace(/^["']|["']$/g, '')

    const isSandbox = truelayerClientId.startsWith('sandbox-')
    const authBaseUrl = isSandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com'
    const apiBaseUrl = isSandbox ? 'https://api.truelayer-sandbox.com' : 'https://api.truelayer.com'

    // ACTION: get_auth_url
    if (action === 'get_auth_url') {
      const redirectUri = body.redirect_uri
      if (!isAllowedRedirectUri(redirectUri)) {
        return new Response(JSON.stringify({ error: 'Invalid redirect URI' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!selfProfileId) {
        return new Response(JSON.stringify({ error: 'No finance profile found; cannot start the connection.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Store only a hash. The raw, 256-bit value is returned once to the
      // browser, which keeps it in sessionStorage until the provider returns.
      const state = createOAuthState()
      const stateHash = await sha256Hex(state)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS).toISOString()

      const { error: cleanupError } = await supabaseAdmin
        .from('finance_truelayer_oauth_states')
        .delete()
        .eq('profile_id', selfProfileId)
        .lt('expires_at', now.toISOString())
      if (cleanupError) {
        console.warn('Failed to remove expired TrueLayer OAuth states:', cleanupError)
      }

      const { error: stateError } = await supabaseAdmin
        .from('finance_truelayer_oauth_states')
        .insert({
          profile_id: selfProfileId,
          state_hash: stateHash,
          redirect_uri: redirectUri,
          expires_at: expiresAt,
        })
      if (stateError) {
        console.error('Failed to store TrueLayer OAuth state:', stateError)
        return new Response(JSON.stringify({ error: 'Could not start bank connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const scopes = 'info accounts balance transactions cards offline_access'
      const providersParam = isSandbox ? '&providers=uk-cs-mock%20uk-ob-all' : ''
      const authUrl = `${authBaseUrl}/?response_type=code&client_id=${truelayerClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}${providersParam}&state=${encodeURIComponent(state)}`

      return new Response(JSON.stringify({ url: authUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: check_connection
    if (action === 'check_connection') {
      const { data: connections, error: connErr } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('id, provider_id, provider_name, provider_logo_uri, consent_expires_at, last_synced_at, backfilled_from, backfill_complete, expires_at, created_at')
        .eq('profile_id', selfProfileId)
        .order('created_at', { ascending: true })

      if (connErr) {
        console.error('Failed to fetch connections:', connErr)
      }

      const list = connections || []
      const expiries = list
        .map(c => c.consent_expires_at || c.expires_at)
        .filter(Boolean) as string[]
      const earliestExpiry = expiries.length > 0
        ? expiries.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
        : null

      return new Response(JSON.stringify({
        connected: list.length > 0,
        connections: list,
        expires_at: earliestExpiry,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: disconnect
    if (action === 'disconnect') {
      if (!selfProfileId) {
        return new Response(JSON.stringify({ error: 'No finance profile found.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { connection_id, provider_id } = body
      let query = supabaseAdmin
        .from('finance_truelayer_connection')
        .delete()
        .eq('profile_id', selfProfileId)

      if (connection_id) {
        query = query.eq('id', connection_id)
      } else if (provider_id) {
        query = query.eq('provider_id', provider_id)
      }

      const { error: delError } = await query
      if (delError) {
        console.error('Failed to disconnect TrueLayer connection:', delError)
        return new Response(JSON.stringify({ error: 'Could not disconnect bank connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: exchange_code
    if (action === 'exchange_code') {
      if (!selfProfileId) {
        return new Response(JSON.stringify({ error: 'No finance profile found; cannot store the connection.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { code, state } = body
      const redirectUri = body.redirect_uri
      if (typeof code !== 'string' || !code || !isAllowedRedirectUri(redirectUri) || !isValidOAuthState(state)) {
        return new Response(JSON.stringify({ error: 'Invalid authorization callback' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Deleting the matching row before calling TrueLayer makes state
      // single-use, even when a callback URL is replayed concurrently.
      const { data: consumedState, error: stateError } = await supabaseAdmin
        .from('finance_truelayer_oauth_states')
        .delete()
        .eq('profile_id', selfProfileId)
        .eq('state_hash', await sha256Hex(state))
        .eq('redirect_uri', redirectUri)
        .gt('expires_at', new Date().toISOString())
        .select('id')
        .maybeSingle()
      if (stateError || !consumedState) {
        if (stateError) {
          console.error('Failed to consume TrueLayer OAuth state:', stateError)
        }
        return new Response(JSON.stringify({ error: 'Invalid or expired authorization state' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Exchange code for token
      const tokenResponse = await fetch(`${authBaseUrl}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: truelayerClientId,
          client_secret: truelayerClientSecret,
          redirect_uri: redirectUri,
          code: code,
        }),
      })

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text()
        console.error('TrueLayer token exchange failed:', tokenResponse.status, errText)
        return new Response(JSON.stringify({ error: 'TrueLayer token exchange failed' }), {
          status: tokenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokenData = await tokenResponse.json()
      const { access_token, refresh_token, expires_in } = tokenData
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

      // Discover provider identity via TrueLayer Data API /data/v1/me (7.M Step B)
      let providerId = 'default'
      let providerName = 'Connected Bank'
      let providerLogoUri: string | null = null
      let consentExpiresAt: string | null = null

      try {
        const meRes = await fetch(`${apiBaseUrl}/data/v1/me`, {
          headers: trueLayerDataHeaders(access_token),
        })
        if (meRes.ok) {
          const meData = await meRes.json()
          const meItem = meData.results?.[0]
          if (meItem?.provider) {
            providerId = meItem.provider.provider_id || providerId
            providerName = meItem.provider.display_name || providerName
            providerLogoUri = meItem.provider.logo_uri || null
          }
          if (meItem?.consent_expires_at) {
            consentExpiresAt = meItem.consent_expires_at
          }
        }
      } catch (meErr) {
        console.warn('Could not query /data/v1/me, will check /accounts fallback', meErr)
      }

      // Fallback: discover the provider from an account or card if /me did
      // not return it. A credit-card-only consent is still a valid connection.
      if (providerId === 'default') {
        try {
          const [accountsResponse, cardsResponse] = await Promise.all([
            fetch(`${apiBaseUrl}/data/v1/accounts`, {
              headers: trueLayerDataHeaders(access_token),
            }),
            fetch(`${apiBaseUrl}/data/v1/cards`, {
              headers: trueLayerDataHeaders(access_token),
            }),
          ])
          const sourceResponses = [accountsResponse, cardsResponse]
          for (const response of sourceResponses) {
            if (response.ok) {
              const data = await response.json()
              const firstSource = data.results?.[0]
              if (firstSource?.provider) {
                providerId = firstSource.provider.provider_id || providerId
                providerName = firstSource.provider.display_name || providerName
                providerLogoUri = firstSource.provider.logo_uri || null
                break
              }
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      // A placeholder identity would make unrelated connections conflict on
      // (profile_id, provider_id) and replace one another. Do not store a
      // token unless TrueLayer has identified the authorised institution.
      if (providerId === 'default') {
        console.error('TrueLayer did not return a provider identity for the new connection')
        return new Response(JSON.stringify({
          error: 'Could not identify the bank. Please try connecting it again.',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Default consent expiry to ~90 days from now if not explicitly returned by API
      if (!consentExpiresAt) {
        consentExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Upsert scoped to (profile_id, provider_id). A renewed consent may
      // expose a changed source list, so its per-source cursors are reset only
      // after the replacement token was safely stored. Imported rows remain.
      const { data: storedConnection, error: upsertError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .upsert({
          profile_id: selfProfileId,
          provider_id: providerId,
          provider_name: providerName,
          provider_logo_uri: providerLogoUri,
          access_token,
          refresh_token,
          expires_at: expiresAt,
          consent_expires_at: consentExpiresAt,
          backfilled_from: new Date().toISOString().split('T')[0],
          backfill_complete: false,
          last_synced_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'profile_id,provider_id',
        })
        .select('id')
        .single()

      if (upsertError) {
        console.error('Failed to store TrueLayer tokens:', upsertError)
        return new Response(JSON.stringify({ error: 'Could not store bank connection' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: resetSourcesError } = await supabaseAdmin
        .from('finance_truelayer_source_sync')
        .delete()
        .eq('connection_id', storedConnection.id)
      if (resetSourcesError) {
        console.error('Failed to reset TrueLayer source history state:', resetSourcesError)
        return new Response(JSON.stringify({ error: 'Could not prepare bank history sync' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // The client syncs straight after linking. A cooldown held from an
      // earlier sync would refuse the first read of a bank nobody has read.
      await releaseCooldown(supabaseAdmin, MANUAL_SYNC_COOLDOWN_KEY)

      return new Response(JSON.stringify({
        success: true,
        provider_id: providerId,
        provider_name: providerName,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: sync_transactions
    if (action === 'sync_transactions') {
      if (!selfProfileId) {
        return new Response(JSON.stringify({ error: 'No finance profile found; cannot write synced data.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // One finance_sync_log row for every run that finishes or fails in a way
      // this action handles, so the history can tell a night the job failed
      // from a night it never ran. A wall-clock timeout or an exception caught
      // by the outer handler writes nothing, and the history shows that night
      // as missed. Best effort: a failed log write must not turn a good sync
      // into an error. Messages stored here are the generic ones this function
      // already returns, never raw provider or database errors.
      type BankRunResult = { name: string; status: 'synced' | 'failed'; transactions: number; error?: string }
      const runStartedAt = Date.now()
      const recordRun = async (run: {
        status: 'success' | 'partial' | 'error'
        errorMessage?: string
        connectionsSynced?: number
        accountsSynced?: number
        transactionsSynced?: number
        transactionsNew?: number
        banks?: BankRunResult[]
      }) => {
        try {
          const { error } = await supabaseAdmin.from('finance_sync_log').insert({
            profile_id: selfProfileId,
            trigger: isServiceRole ? 'scheduled' : 'manual',
            status: run.status,
            duration_ms: Date.now() - runStartedAt,
            connections_synced: run.connectionsSynced ?? 0,
            accounts_synced: run.accountsSynced ?? 0,
            transactions_synced: run.transactionsSynced ?? 0,
            transactions_new: run.transactionsNew ?? 0,
            banks: run.banks ?? [],
            error_message: run.errorMessage ?? null,
          })
          if (error) console.warn('Failed to record bank sync run:', error)
        } catch (logException) {
          console.warn('Failed to record bank sync run:', logException)
        }
      }

      // 1. Fetch all connection details for this profile (7.M Step B).
      // Named columns rather than '*': this row holds the access and refresh
      // tokens, so a wildcard pulls every future column into memory and into
      // any log line that touches it. Add to this list deliberately.
      const { data: connections, error: connError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('id, provider_id, provider_name, provider_logo_uri, access_token, refresh_token, expires_at')
        .eq('profile_id', selfProfileId)

      if (connError || !connections || connections.length === 0) {
        // Only the nightly job logs this: a manual press is answered on
        // screen, but an unattended run with no bank to call is exactly what
        // the history is for.
        if (isServiceRole) {
          await recordRun({
            status: 'error',
            errorMessage: connError ? 'Could not read bank connections' : 'No bank connection found',
          })
        }
        return new Response(JSON.stringify({ error: 'No TrueLayer bank connection found. Please link your account first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Claimed only once there is a bank to call, so a refused or empty
      // request does not hold the cooldown.
      let cooldownClaimedAt: number | null = null
      if (!isServiceRole) {
        const wait = await claimCooldown(supabaseAdmin, MANUAL_SYNC_COOLDOWN_KEY, MANUAL_SYNC_COOLDOWN_SECONDS)
        if (wait > 0) return cooldownResponse(wait, 'A bank sync', corsHeaders)
        cooldownClaimedAt = Date.now()
      }

      // Shapes written back to Supabase
      type SyncedAccountRow = {
        id: string
        is_default: boolean
        profile_id: string | null
        name: string
        type: string
        issuer: string
        balance: number
        // No annual_fee: the bank does not report one, so the owner enters it,
        // and an upsert overwrites every column it names. Absent from every
        // row, a new account takes the column's default of 0 and an existing
        // one keeps what the owner set.
        emoji: string
        color: string
        updated_at: string
        /** Cards only, and only when the bank returned one; see the upsert. */
        credit_limit?: number
      }
      type SyncedTxRow = {
        is_default: boolean
        profile_id: string | null
        name: string
        merchant: string | null
        provider_category: string | null
        category: string
        amount: number
        date: string
        is_reviewed: boolean
        account_id: string
        provider_transaction_id: string
      }

      const syncedAccounts: SyncedAccountRow[] = []
      const allNewTransactions: SyncedTxRow[] = []
      const connectionErrors: { provider: string; error: string }[] = []
      // A cursor means every row through that point is durable. Keep it in
      // memory until account and transaction writes have both succeeded;
      // otherwise an Edge Function timeout can make later runs skip data.
      const pendingSourceProgress: {
        id: string
        backfilled_from: string
        backfill_complete: boolean
      }[] = []
      const pendingConnectionProgress: {
        id: string
        backfilled_from: string
        backfill_complete: boolean
      }[] = []

      // Helper function to get default emoji & color based on bank/provider name
      const getProviderStyling = (providerName: string) => {
        const name = providerName.toLowerCase()
        if (name.includes('monzo')) return { emoji: '⚡', color: '#ff4f5e' }
        if (name.includes('revolut')) return { emoji: '🖤', color: '#000000' }
        if (name.includes('hsbc')) return { emoji: '🟥', color: '#db0011' }
        if (name.includes('barclays')) return { emoji: '🟦', color: '#00aeef' }
        if (name.includes('lloyds')) return { emoji: '🟩', color: '#006a4e' }
        if (name.includes('starling')) return { emoji: '🟢', color: '#27255f' }
        if (name.includes('halifax')) return { emoji: '🟦', color: '#003a70' }
        if (name.includes('santander')) return { emoji: '🟥', color: '#ec0000' }
        if (name.includes('nationwide')) return { emoji: '🔷', color: '#002c5f' }
        return { emoji: '💰', color: '#4f46e5' } // default indigo
      }

      // Helper to map TrueLayer category classifications to app categories
      const mapCategory = (category: string, classifications: string[]): string => {
        const primary = category ? category.toLowerCase() : ''
        const list = (classifications || []).map(c => c.toLowerCase())

        // A bank transfer may be a move between the owner's own accounts, a
        // payment to someone, or money coming back -- nothing here can tell
        // which, so it is labelled for what it is rather than filed under a
        // spending category. Whether it counts is decided in transfer review.
        if (primary === 'transfer') {
          return 'Transfers'
        }

        if (list.includes('groceries') || list.includes('eating_out') || primary === 'food_and_drink') {
          return 'Food & Drink'
        }
        if (primary === 'rent_and_mortgage' || primary === 'housing') {
          return 'Housing'
        }
        if (primary === 'bills_and_utilities' || list.includes('utility')) {
          return 'Needs'
        }
        if (primary === 'transport' || list.includes('auto_and_transport') || list.includes('public_transport')) {
          return 'Transportation'
        }
        if (primary === 'entertainment' || primary === 'leisure' || list.includes('games') || list.includes('movies_and_tv')) {
          return 'Entertainment'
        }
        if (primary === 'shopping' || list.includes('clothes') || list.includes('electronics')) {
          return 'Shopping'
        }
        if (primary === 'personal_care') {
          return 'Self Care'
        }
        if (primary === 'travel') {
          return 'Travel'
        }
        if (primary === 'charity') {
          return 'Donations'
        }
        if (primary === 'savings' || primary === 'investments') {
          return 'Savings'
        }
        return 'Wants' // default fallback
      }

      const DAY_MS = 24 * 60 * 60 * 1000
      const OVERLAP_DAYS = 7
      const BACKFILL_WINDOW_DAYS = 90
      const MAX_WINDOWS_PER_RUN = 8
      const EMPTY_WINDOWS_TO_STOP = 8
      const now = new Date()
      const ABSOLUTE_FLOOR = new Date('1970-01-01T00:00:00.000Z')

      const connectionErrorMessage = (resource: string, status: number) => {
        if (status === 401 || status === 403) return 'Bank access needs renewing; reconnect this bank'
        if (status === 429) return 'Bank request limit reached; retry later'
        if (status >= 500) return 'Bank is temporarily unavailable; retry later'
        return `Could not fetch ${resource} (HTTP ${status})`
      }

      type TlAccount = {
        account_id: string
        display_name?: string
        account_type?: string
        provider?: { display_name?: string; provider_id?: string; logo_uri?: string }
      }
      type TlCard = {
        account_id: string
        display_name?: string
        provider?: { display_name?: string; provider_id?: string; logo_uri?: string }
      }
      type TlTransaction = {
        transaction_id: string
        merchant_name?: string
        description?: string
        transaction_category?: string
        transaction_classification?: string[]
        amount: number | string
        timestamp: string
      }

      const importedAccountType = (accountType: string | undefined, isCard: boolean) => {
        if (isCard) return 'credit' as const
        switch (accountType?.trim().toLowerCase()) {
          case 'savings':
            return 'savings' as const
          case 'investment':
            return 'investment' as const
          default:
            return 'checking' as const
        }
      }
      const importedAccountLabel = (accountType: string | undefined, isCard: boolean) => {
        if (isCard) return 'Credit Card'
        switch (importedAccountType(accountType, isCard)) {
          case 'savings':
            return 'Savings Account'
          case 'investment':
            return 'Investment Account'
          default:
            return 'Current Account'
        }
      }
      const importedAccountName = (raw: TlAccount | TlCard, isCard: boolean) => {
        const displayName = raw.display_name?.trim()
        // Several UK providers return the account holder (for example,
        // "Mr Dhyan Shyam") here, not the product. The product label is more
        // useful and remains distinct from the provider shown as issuer.
        const looksLikeAccountHolder = /^(mr|mrs|ms|miss|dr)\b/i.test(displayName || '')
        return displayName && !looksLikeAccountHolder
          ? displayName
          : importedAccountLabel((raw as TlAccount).account_type, isCard)
      }

      const accountRowId = (kind: 'accounts' | 'cards', id: string) =>
        kind === 'accounts' ? `tl_acc_${id}` : `tl_card_${id}`
      const transactionSourceKey = (accountId: string, transactionId: string) =>
        `${accountId}\u0000${transactionId}`

      // Per bank, for the sync history: rows fetched (before de-duplication)
      // and whether it failed. Keyed by connection id, since two connections
      // can share a display name.
      const fetchedByConnection = new Map<string, number>()
      const failureByConnection = new Map<string, string>()

      // Loop through each linked bank connection
      for (const connection of connections) {
        const fetchedBefore = allNewTransactions.length
        const errorsBefore = connectionErrors.length
        try {
          let accessToken = connection.access_token
          let refreshToken = connection.refresh_token
          let expiresAt = new Date(connection.expires_at)

          // 2. Refresh token if expired or expiring within 5 minutes
          if (expiresAt.getTime() - Date.now() < 300000) {
            const refreshResponse = await fetch(`${authBaseUrl}/connect/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: truelayerClientId,
                client_secret: truelayerClientSecret,
                refresh_token: refreshToken,
              }),
            })

            if (!refreshResponse.ok) {
              const errText = await refreshResponse.text()
              console.error(`Failed to refresh token for ${connection.provider_name}: ${errText}`)
              connectionErrors.push({ provider: connection.provider_name, error: 'Token refresh failed' })
              continue
            }

            const refreshData = await refreshResponse.json()
            accessToken = refreshData.access_token
            refreshToken = refreshData.refresh_token || refreshToken
            expiresAt = new Date(Date.now() + refreshData.expires_in * 1000)

            await supabaseAdmin
              .from('finance_truelayer_connection')
              .update({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id)
          }

          const logDataApiFailure = (resource: string, response: Response) => {
            // The correlation ID lets us trace this exact provider call in
            // TrueLayer support without logging a token, account ID, or body.
            console.warn('TrueLayer Data API request failed', {
              provider: connection.provider_name,
              resource,
              status: response.status,
              correlationId: response.headers.get('x-tl-correlation-id'),
            })
          }

          // 3. Fetch Accounts & Cards for this connection
          const accountsRes = await fetch(`${apiBaseUrl}/data/v1/accounts`, {
            headers: trueLayerDataHeaders(accessToken),
          })
          const cardsRes = await fetch(`${apiBaseUrl}/data/v1/cards`, {
            headers: trueLayerDataHeaders(accessToken),
          })

          // A credit-card-only consent (for example American Express) has no
          // debit accounts, while a current-account consent may have no cards.
          // One unavailable list must not hide the valid list from the other.
          if (!accountsRes.ok && !cardsRes.ok) {
            logDataApiFailure('accounts', accountsRes)
            logDataApiFailure('cards', cardsRes)
            connectionErrors.push({
              provider: connection.provider_name,
              error: connectionErrorMessage('accounts or cards', Math.max(accountsRes.status, cardsRes.status)),
            })
            continue
          }

          if (!accountsRes.ok) logDataApiFailure('accounts', accountsRes)
          if (!cardsRes.ok) logDataApiFailure('cards', cardsRes)

          const accountsList: TlAccount[] = accountsRes.ok ? (await accountsRes.json()).results || [] : []
          const cardsList: TlCard[] = cardsRes.ok ? (await cardsRes.json()).results || [] : []

          const sources: { kind: 'accounts' | 'cards'; raw: TlAccount | TlCard }[] = [
            ...accountsList.map(raw => ({ kind: 'accounts' as const, raw })),
            ...cardsList.map(raw => ({ kind: 'cards' as const, raw })),
          ]

          // Heal legacy placeholder provider_name or provider_id if needed
          const detectedProvider = sources[0]?.raw.provider
          if (detectedProvider && (connection.provider_id === 'default' || connection.provider_name === 'Connected Bank')) {
            const updatedProviderId = detectedProvider.provider_id || connection.provider_id
            const updatedProviderName = detectedProvider.display_name || connection.provider_name
            const updatedLogoUri = detectedProvider.logo_uri || connection.provider_logo_uri
            await supabaseAdmin
              .from('finance_truelayer_connection')
              .update({
                provider_id: updatedProviderId,
                provider_name: updatedProviderName,
                provider_logo_uri: updatedLogoUri,
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id)
          }

          // A. Balances. Never overwrite a known balance with zero when the
          // provider call itself failed.
          const balances = await Promise.all(sources.map(async ({ kind, raw }) => {
            const accId = accountRowId(kind, raw.account_id)
            const balanceRes = await fetch(
              `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/balance`,
              { headers: trueLayerDataHeaders(accessToken) },
            )
            if (!balanceRes.ok) {
              logDataApiFailure(`${kind} balance`, balanceRes)
              throw new Error(`Could not fetch balance for ${kind}/${raw.account_id}`)
            }
            const balanceData = await balanceRes.json()
            const balanceVal = balanceData.results?.[0]?.current ?? 0
            const styling = getProviderStyling(raw.provider?.display_name || connection.provider_name)
            const isCard = kind === 'cards'
            // Card balances carry the limit; account balances do not. Kept
            // only when it is a real, non-negative number.
            const rawLimit = isCard ? Number(balanceData.results?.[0]?.credit_limit) : NaN
            const creditLimit = Number.isFinite(rawLimit) && rawLimit >= 0 ? { credit_limit: rawLimit } : {}

            return {
              ...creditLimit,
              id: accId,
              is_default: false,
              profile_id: selfProfileId,
              name: importedAccountName(raw, isCard),
              type: importedAccountType((raw as TlAccount).account_type, isCard),
              issuer: raw.provider?.display_name || connection.provider_name,
              balance: isCard ? -Math.abs(Number(balanceVal)) : Number(balanceVal),
              emoji: styling.emoji,
              color: styling.color,
              updated_at: new Date().toISOString(),
            }
          }))
          syncedAccounts.push(...balances)

          // B. Transactions. A bank connection can contain many accounts and
          // cards, each with its own age and provider retention. Keep a
          // durable cursor for every source rather than allowing one account's
          // newest or oldest transaction to govern the others.
          const sourceKey = (kind: 'accounts' | 'cards', providerAccountId: string) =>
            `${kind}\u0000${providerAccountId}`
          type SourceState = {
            id: string
            source_kind: 'accounts' | 'cards'
            provider_account_id: string
            backfilled_from: string | null
            backfill_complete: boolean
          }
          const { data: storedSourceStates, error: storedSourceStatesError } = await supabaseAdmin
            .from('finance_truelayer_source_sync')
            .select('id, source_kind, provider_account_id, backfilled_from, backfill_complete')
            .eq('connection_id', connection.id)
          if (storedSourceStatesError) throw storedSourceStatesError

          const statesBySource = new Map<string, SourceState>(
            ((storedSourceStates || []) as SourceState[]).map(state => [
              sourceKey(state.source_kind, state.provider_account_id), state,
            ]),
          )
          const unseenSources = sources.filter(source =>
            !statesBySource.has(sourceKey(source.kind, source.raw.account_id)),
          )
          if (unseenSources.length > 0) {
            const { data: insertedStates, error: insertStatesError } = await supabaseAdmin
              .from('finance_truelayer_source_sync')
              .insert(unseenSources.map(source => ({
                connection_id: connection.id,
                source_kind: source.kind,
                provider_account_id: source.raw.account_id,
              })))
              .select('id, source_kind, provider_account_id, backfilled_from, backfill_complete')
            if (insertStatesError) throw insertStatesError
            for (const state of (insertedStates || []) as SourceState[]) {
              statesBySource.set(sourceKey(state.source_kind, state.provider_account_id), state)
            }
          }

          const sourceStates = sources.map(source => {
            const state = statesBySource.get(sourceKey(source.kind, source.raw.account_id))
            if (!state) throw new Error('Could not initialise TrueLayer source history state')
            return { ...source, state }
          })

          const fetchSourceRange = async (
            source: typeof sourceStates[number],
            from: Date,
            to: Date,
            resource: 'current transactions' | 'historical transactions',
          ): Promise<{ transactionCount: number; failed: boolean; status?: number }> => {
            // Data API v1 documents these as inclusive calendar dates. Sending
            // ISO instants worked with some providers but led others to reject
            // historical calls with HTTP 400, so use the supported shape.
            const qs = buildTrueLayerTransactionQuery(from, to)
            const { kind, raw } = source
            const res = await fetch(
              `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/transactions?${qs}`,
              { headers: trueLayerDataHeaders(accessToken) },
            )
            if (!res.ok) {
              logDataApiFailure(resource, res)
              return { transactionCount: 0, failed: true, status: res.status }
            }
            const txs = ((await res.json()).results || []) as TlTransaction[]
            const rows = txs
              .filter(tx => typeof tx.transaction_id === 'string' && typeof tx.timestamp === 'string')
              .map(tx => ({
                is_default: false,
                profile_id: selfProfileId,
                name: tx.merchant_name || tx.description || 'TrueLayer Transaction',
                // Falls back to the description because merchant identification
                // is TrueLayer's paid enrichment: on the raw Data API most UK
                // issuers return no merchant_name at all, and keying only off
                // it left every row without an identity.
                //
                // A description is noisier than a name -- "SUMUP *FONDATION DU
                // M GENEVE CH" -- but normaliseMerchant strips exactly the
                // parts that vary between two visits to the same shop: the
                // processor prefix, the store number, the till reference. What
                // survives is stable, which is all a key has to be.
                merchant: tx.merchant_name || tx.description || null,
                // The bank's own label, kept verbatim beside the mapped
                // category below. Transfer detection reads it as evidence;
                // it never decides a category on its own.
                provider_category: tx.transaction_category?.trim().toLowerCase() || null,
                category: mapCategory(tx.transaction_category || '', tx.transaction_classification || []),
                amount: -Number(tx.amount),
                date: tx.timestamp.split('T')[0],
                is_reviewed: false,
                account_id: accountRowId(kind, raw.account_id),
                provider_transaction_id: tx.transaction_id,
              }))
            allNewTransactions.push(...rows)
            return { transactionCount: rows.length, failed: false }
          }

          // Keep recent changes covered for every source. Its independent
          // history cursor then walks backward from today without assuming a
          // fixed age for a newly authorised account or card.
          const recentResults = await Promise.all(sourceStates.map(source =>
            fetchSourceRange(source, new Date(now.getTime() - OVERLAP_DAYS * DAY_MS), now, 'current transactions'),
          ))
          if (recentResults.some(result => result.failed)) {
            const status = recentResults.find(result => result.failed)?.status
            connectionErrors.push({
              provider: connection.provider_name,
              error: status ? connectionErrorMessage('current transactions', status) : 'Could not fetch current transactions',
            })
            continue
          }

          const workingSources = sourceStates.map(source => ({
            ...source,
            frontier: source.state.backfilled_from ? new Date(source.state.backfilled_from) : now,
            backfillComplete: source.state.backfill_complete === true,
            emptyStreak: 0,
          }))
          let transactionFetchFailed = false
          let transactionFailureStatus: number | undefined

          for (let window = 0; window < MAX_WINDOWS_PER_RUN; window++) {
            const sourcesToBackfill = workingSources.filter(source =>
              !source.backfillComplete && source.frontier > ABSOLUTE_FLOOR,
            )
            if (sourcesToBackfill.length === 0) break
            const results = await Promise.all(sourcesToBackfill.map(async source => {
              const windowTo = source.frontier
              const windowFrom = new Date(windowTo.getTime() - BACKFILL_WINDOW_DAYS * DAY_MS)
              return { source, result: await fetchSourceRange(source, windowFrom, windowTo, 'historical transactions'), windowFrom }
            }))
            for (const { source, result, windowFrom } of results) {
              if (result.failed) {
                // When status is 400 or 422, the requested date range precedes the bank's
                // supported historical window (e.g. HSBC's 90-day unattended limit or
                // 1-2 year retention limit). This is the natural boundary of the provider's
                // transaction history for this source, not a fatal server/network outage.
                if (result.status === 400 || result.status === 422) {
                  source.backfillComplete = true
                  continue
                }
                transactionFetchFailed = true
                transactionFailureStatus ||= result.status
                continue
              }
              source.frontier = windowFrom
              source.emptyStreak = result.transactionCount === 0 ? source.emptyStreak + 1 : 0
              if (source.emptyStreak >= EMPTY_WINDOWS_TO_STOP || source.frontier <= ABSOLUTE_FLOOR) {
                source.backfillComplete = true
              }
            }
          }

          if (transactionFetchFailed) {
            connectionErrors.push({
              provider: connection.provider_name,
              error: transactionFailureStatus
                ? connectionErrorMessage('historical transactions', transactionFailureStatus)
                : 'Could not fetch historical transactions',
            })
            continue
          }

          for (const source of workingSources) {
            if (source.frontier <= ABSOLUTE_FLOOR) source.backfillComplete = true
            pendingSourceProgress.push({
              id: source.state.id,
              backfilled_from: source.frontier.toISOString().split('T')[0],
              backfill_complete: source.backfillComplete,
            })
          }
          const oldestFrontier = workingSources.reduce(
            (oldest, source) => source.frontier < oldest ? source.frontier : oldest,
            now,
          )
          pendingConnectionProgress.push({
            id: connection.id,
            backfilled_from: oldestFrontier.toISOString().split('T')[0],
            backfill_complete: workingSources.every(source => source.backfillComplete),
          })

        } catch (connLoopErr) {
          console.error(`Error syncing provider ${connection.provider_name}:`, connLoopErr)
          connectionErrors.push({
            provider: connection.provider_name,
            error: 'Sync failed',
          })
        } finally {
          fetchedByConnection.set(connection.id, allNewTransactions.length - fetchedBefore)
          if (connectionErrors.length > errorsBefore) {
            failureByConnection.set(connection.id, connectionErrors[errorsBefore].error)
          }
        }
      }

      const bankResults: BankRunResult[] = connections.map(connection => {
        const failure = failureByConnection.get(connection.id)
        return {
          name: connection.provider_name,
          status: failure ? 'failed' : 'synced',
          transactions: fetchedByConnection.get(connection.id) ?? 0,
          ...(failure ? { error: failure } : {}),
        }
      })
      // What was already written when a later step failed, so the log does
      // not report zero for rows that are in the database.
      const written = { accounts: 0, transactions: 0 }
      const failRun = (errorMessage: string) =>
        recordRun({
          status: 'error',
          errorMessage,
          connectionsSynced: connections.length,
          accountsSynced: written.accounts,
          transactionsSynced: written.transactions,
          banks: bankResults,
        })

      // 4. Write what this sync produced
      const chunk = <T,>(rows: T[], size = 500): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
        return out
      }

      const accountRows = syncedAccounts.map(a => ({ ...a, profile_id: selfProfileId }))

      // Name, emoji and colour are the bank's suggestion for a new account and
      // the owner's once it exists: the edit form changes all three, and
      // rewriting them on every run undid those edits overnight.
      //
      // They are sent back as they stand, not left out. An upsert is an
      // INSERT first, and Postgres checks NOT NULL on the proposed row before
      // it finds the conflict -- so a row without `name` fails even when it
      // exists. That took down the nightly run of 2026-09-25.
      const ownerValues = new Map<string, { name: string; emoji: string | null; color: string | null }>()
      if (accountRows.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('finance_bank_accounts')
          .select('id, name, emoji, color')
          .in('id', accountRows.map(row => row.id))
        if (error) {
          console.error('Failed to look up existing synced accounts:', error)
          await failRun('Could not prepare synced accounts')
          return new Response(JSON.stringify({ error: 'Could not prepare synced accounts' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        for (const row of data ?? []) {
          ownerValues.set(row.id, { name: row.name, emoji: row.emoji, color: row.color })
        }
      }
      const rowsToWrite: Record<string, unknown>[] = accountRows.map(row => {
        const kept = ownerValues.get(row.id)
        return kept ? { ...row, ...kept } : row
      })

      // Grouped by exactly the columns each row carries, so a hand-entered
      // credit limit is never blanked by a batch-mate that sends one (see
      // _shared/upsert-batches).
      for (const group of groupRowsByColumns(rowsToWrite)) {
        for (const batch of chunk(group)) {
          const { error } = await supabaseAdmin
            .from('finance_bank_accounts')
            .upsert(batch, { onConflict: 'id' })
          if (error) {
            console.error('Failed to write synced accounts:', error)
            await failRun('Could not write synced accounts')
            return new Response(JSON.stringify({ error: 'Could not write synced accounts' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      }

      written.accounts = accountRows.length

      // 5. A provider transaction ID is only unique within its account. Keep
      // its stable source identity separate from our primary key, so two bank
      // accounts can legitimately contain the same provider-issued ID.
      const bySource = new Map<string, SyncedTxRow>()
      for (const tx of allNewTransactions) {
        bySource.set(transactionSourceKey(tx.account_id, tx.provider_transaction_id), tx)
      }
      const deduped = Array.from(bySource.values())

      // Existing IDs remain unchanged: profile-transfer rows can reference
      // them. New rows receive a deterministic hash of account + provider ID.
      const existingBySource = new Map<string, { id: string; is_reviewed: boolean; category: string | null }>()
      const syncedAccountIds = Array.from(new Set(deduped.map(tx => tx.account_id)))
      const providerTransactionIds = Array.from(
        new Set(deduped.map(tx => tx.provider_transaction_id)),
      )
      // This filter is encoded into a GET query by PostgREST. Historical
      // imports can contain hundreds of provider IDs, so keep each URL well
      // below proxy/request-line limits instead of using the generic 500-row
      // write batch size.
      for (const batch of chunk(providerTransactionIds, 100)) {
        const { data, error } = await supabaseAdmin
          .from('finance_transactions')
          .select('id, is_reviewed, category, account_id, provider_transaction_id')
          .eq('profile_id', selfProfileId)
          .in('account_id', syncedAccountIds)
          .in('provider_transaction_id', batch)
        if (error) {
          console.error('Failed to look up existing TrueLayer transactions:', error)
          await failRun('Could not prepare bank transactions')
          return new Response(JSON.stringify({ error: 'Could not prepare bank transactions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        for (const row of data ?? []) {
          if (row.account_id && row.provider_transaction_id) {
            existingBySource.set(
              transactionSourceKey(row.account_id, row.provider_transaction_id),
              { id: row.id, is_reviewed: row.is_reviewed, category: row.category },
            )
          }
        }
      }

      const txRows = await Promise.all(deduped.map(async tx => {
        const existing = existingBySource.get(
          transactionSourceKey(tx.account_id, tx.provider_transaction_id),
        )
        return {
          ...tx,
          id: existing?.id ?? `tl_tx_${await sha256Hex(
            transactionSourceKey(tx.account_id, tx.provider_transaction_id),
          )}`,
          profile_id: selfProfileId,
          is_reviewed: existing?.is_reviewed ?? tx.is_reviewed,
          // The category is the owner's once the row exists. Re-mapping it on
          // every sync reverted any re-categorisation made inside the overlap
          // window, which the next run re-reads.
          category: existing?.category || tx.category,
        }
      }))

      for (const batch of chunk(txRows)) {
        const { error } = await supabaseAdmin
          .from('finance_transactions')
          .upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('Failed to write synced transactions:', error)
          await failRun('Could not write synced transactions')
          return new Response(JSON.stringify({ error: 'Could not write synced transactions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      written.transactions = txRows.length

      // Commit each account/card cursor only after its fetched data is in the
      // database. If this update itself fails, the bounded overlap makes the
      // next run safely re-fetch those rows rather than losing them.
      for (const progress of pendingSourceProgress) {
        const { error } = await supabaseAdmin
          .from('finance_truelayer_source_sync')
          .update({
            backfilled_from: progress.backfilled_from,
            backfill_complete: progress.backfill_complete,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', progress.id)
        if (error) {
          console.error('Failed to advance TrueLayer source sync progress:', error)
          await failRun('Could not record bank sync progress')
          return new Response(JSON.stringify({ error: 'Could not record bank sync progress' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // This aggregate is retained for the existing connection-status UI.
      // Its state now reflects all of the independent source cursors.
      for (const progress of pendingConnectionProgress) {
        const { error } = await supabaseAdmin
          .from('finance_truelayer_connection')
          .update({
            backfilled_from: progress.backfilled_from,
            backfill_complete: progress.backfill_complete,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', progress.id)
        if (error) {
          console.error('Failed to advance TrueLayer sync progress:', error)
          await failRun('Could not record bank sync progress')
          return new Response(JSON.stringify({ error: 'Could not record bank sync progress' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Update daily net worth & balance snapshots with freshly synced figures
      try {
        const { error: snapshotError } = await supabaseAdmin.rpc('capture_finance_snapshots')
        if (snapshotError) {
          console.warn('Failed to capture finance snapshots after sync:', snapshotError)
        }
      } catch (snapshotException) {
        console.warn('Failed to capture finance snapshots after sync:', snapshotException)
      }

      const failedBanks = bankResults.filter(bank => bank.status === 'failed').length
      const everyBankFailed = failedBanks === bankResults.length
      await recordRun({
        status: failedBanks === 0 ? 'success' : everyBankFailed ? 'error' : 'partial',
        errorMessage: everyBankFailed ? 'Every bank failed to sync' : undefined,
        connectionsSynced: connections.length,
        accountsSynced: syncedAccounts.length,
        transactionsSynced: txRows.length,
        transactionsNew: deduped.filter(tx => !existingBySource.has(
          transactionSourceKey(tx.account_id, tx.provider_transaction_id),
        )).length,
        banks: bankResults,
      })

      return new Response(JSON.stringify({
        success: true,
        synced_accounts: syncedAccounts.length,
        synced_transactions: txRows.length,
        connections_synced: connections.length,
        errors: connectionErrors.length > 0 ? connectionErrors : undefined,
        retry_after: cooldownClaimedAt === null
          ? undefined
          : Math.max(0, MANUAL_SYNC_COOLDOWN_SECONDS - Math.floor((Date.now() - cooldownClaimedAt) / 1000)),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('truelayer-sync failed', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
