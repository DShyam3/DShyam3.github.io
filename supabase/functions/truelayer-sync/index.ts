import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const ALLOWED_ORIGINS = new Set([
  'https://dshyam3.github.io',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:5173',
])

// A callback is safe only when its destination is an exact, registered app
// URL. This list mirrors the browser origins but deliberately includes the
// `/finance` callback path as part of the allowlist.
const ALLOWED_REDIRECT_URIS = new Set([
  'https://dshyam3.github.io/finance',
  'http://localhost:8080/finance',
  'http://localhost:8081/finance',
  'http://localhost:8082/finance',
  'http://localhost:5173/finance',
])
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

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

      const { data: { user }, error: userError } = await userClient.auth.getUser()
      if (userError || !user) {
        if (userError) {
          console.warn('TrueLayer request authentication failed:', userError)
        }
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'd.shyam1256@gmail.com'
      if (user.email !== adminEmail) {
        return new Response(JSON.stringify({ error: 'Forbidden: Access restricted to administrator' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
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
          headers: { Authorization: `Bearer ${access_token}` },
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
              headers: { Authorization: `Bearer ${access_token}` },
            }),
            fetch(`${apiBaseUrl}/data/v1/cards`, {
              headers: { Authorization: `Bearer ${access_token}` },
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

      // 1. Fetch all connection details for this profile (7.M Step B)
      const { data: connections, error: connError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('*')
        .eq('profile_id', selfProfileId)

      if (connError || !connections || connections.length === 0) {
        return new Response(JSON.stringify({ error: 'No TrueLayer bank connection found. Please link your account first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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
        annual_fee: number
        emoji: string
        color: string
        updated_at: string
      }
      type SyncedTxRow = {
        is_default: boolean
        profile_id: string | null
        name: string
        merchant: string | null
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

      // Loop through each linked bank connection
      for (const connection of connections) {
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

          // 3. Fetch Accounts & Cards for this connection
          const accountsRes = await fetch(`${apiBaseUrl}/data/v1/accounts`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const cardsRes = await fetch(`${apiBaseUrl}/data/v1/cards`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })

          // Do not advance a connection-wide cursor from a partial account
          // list: a retry must get the opportunity to backfill every account
          // and card covered by this consent.
          if (!accountsRes.ok || !cardsRes.ok) {
            console.warn(`Could not retrieve the complete account list for ${connection.provider_name}`)
            connectionErrors.push({ provider: connection.provider_name, error: 'Could not fetch accounts' })
            continue
          }

          const accountsList: TlAccount[] = (await accountsRes.json()).results || []
          const cardsList: TlCard[] = (await cardsRes.json()).results || []

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
              { headers: { Authorization: `Bearer ${accessToken}` } },
            )
            if (!balanceRes.ok) {
              throw new Error(`Could not fetch balance for ${kind}/${raw.account_id}`)
            }
            const balanceData = await balanceRes.json()
            const balanceVal = balanceData.results?.[0]?.current ?? 0
            const styling = getProviderStyling(raw.provider?.display_name || connection.provider_name)
            const isCard = kind === 'cards'

            return {
              id: accId,
              is_default: false,
              profile_id: selfProfileId,
              name: importedAccountName(raw, isCard),
              type: importedAccountType((raw as TlAccount).account_type, isCard),
              issuer: raw.provider?.display_name || connection.provider_name,
              balance: isCard ? -Math.abs(Number(balanceVal)) : Number(balanceVal),
              annual_fee: 0,
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
          ): Promise<{ transactionCount: number; failed: boolean }> => {
            const qs = `from=${from.toISOString()}&to=${to.toISOString()}`
            const { kind, raw } = source
            const res = await fetch(
              `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/transactions?${qs}`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            )
            if (!res.ok) return { transactionCount: 0, failed: true }
            const txs = ((await res.json()).results || []) as TlTransaction[]
            const rows = txs
              .filter(tx => typeof tx.transaction_id === 'string' && typeof tx.timestamp === 'string')
              .map(tx => ({
                is_default: false,
                profile_id: selfProfileId,
                name: tx.merchant_name || tx.description || 'TrueLayer Transaction',
                merchant: tx.merchant_name || null,
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
            fetchSourceRange(source, new Date(now.getTime() - OVERLAP_DAYS * DAY_MS), now),
          ))
          if (recentResults.some(result => result.failed)) {
            connectionErrors.push({ provider: connection.provider_name, error: 'Could not fetch transactions' })
            continue
          }

          const workingSources = sourceStates.map(source => ({
            ...source,
            frontier: source.state.backfilled_from ? new Date(source.state.backfilled_from) : now,
            backfillComplete: source.state.backfill_complete === true,
            emptyStreak: 0,
          }))
          let transactionFetchFailed = false

          for (let window = 0; window < MAX_WINDOWS_PER_RUN; window++) {
            const sourcesToBackfill = workingSources.filter(source =>
              !source.backfillComplete && source.frontier > ABSOLUTE_FLOOR,
            )
            if (sourcesToBackfill.length === 0) break
            const results = await Promise.all(sourcesToBackfill.map(async source => {
              const windowTo = source.frontier
              const windowFrom = new Date(windowTo.getTime() - BACKFILL_WINDOW_DAYS * DAY_MS)
              return { source, result: await fetchSourceRange(source, windowFrom, windowTo), windowFrom }
            }))
            for (const { source, result, windowFrom } of results) {
              if (result.failed) {
                transactionFetchFailed = true
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
            connectionErrors.push({ provider: connection.provider_name, error: 'Could not fetch transactions' })
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
        }
      }

      // 4. Write what this sync produced
      const chunk = <T,>(rows: T[], size = 500): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
        return out
      }

      const accountRows = syncedAccounts.map(a => ({ ...a, profile_id: selfProfileId }))
      for (const batch of chunk(accountRows)) {
        const { error } = await supabaseAdmin
          .from('finance_bank_accounts')
          .upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('Failed to write synced accounts:', error)
          return new Response(JSON.stringify({ error: 'Could not write synced accounts' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

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
      const existingBySource = new Map<string, { id: string; is_reviewed: boolean }>()
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
          .select('id, is_reviewed, account_id, provider_transaction_id')
          .eq('profile_id', selfProfileId)
          .in('account_id', syncedAccountIds)
          .in('provider_transaction_id', batch)
        if (error) {
          console.error('Failed to look up existing TrueLayer transactions:', error)
          return new Response(JSON.stringify({ error: 'Could not prepare bank transactions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        for (const row of data ?? []) {
          if (row.account_id && row.provider_transaction_id) {
            existingBySource.set(
              transactionSourceKey(row.account_id, row.provider_transaction_id),
              { id: row.id, is_reviewed: row.is_reviewed },
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
        }
      }))

      for (const batch of chunk(txRows)) {
        const { error } = await supabaseAdmin
          .from('finance_transactions')
          .upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error('Failed to write synced transactions:', error)
          return new Response(JSON.stringify({ error: 'Could not write synced transactions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

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

      return new Response(JSON.stringify({
        success: true,
        synced_accounts: syncedAccounts.length,
        synced_transactions: txRows.length,
        connections_synced: connections.length,
        errors: connectionErrors.length > 0 ? connectionErrors : undefined,
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
