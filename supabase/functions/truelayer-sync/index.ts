import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

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

    // Verify user is authenticated and is the admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'Invalid user'}` }), {
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
      return new Response(JSON.stringify({ error: 'Configuration error: TrueLayer credentials not set on server' }), {
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
      const { redirect_uri, state } = body
      if (!redirect_uri) {
        return new Response(JSON.stringify({ error: 'redirect_uri is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const scopes = 'info accounts balance transactions cards offline_access'
      const providersParam = isSandbox ? '&providers=uk-cs-mock%20uk-ob-all' : ''
      const authUrl = `${authBaseUrl}/?response_type=code&client_id=${truelayerClientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scopes)}${providersParam}&state=${state || ''}`

      return new Response(JSON.stringify({ url: authUrl }), {
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
        return new Response(JSON.stringify({ error: `Failed to disconnect: ${delError.message}` }), {
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

      const { code, redirect_uri } = body
      if (!code || !redirect_uri) {
        return new Response(JSON.stringify({ error: 'code and redirect_uri are required' }), {
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
          redirect_uri: redirect_uri,
          code: code,
        }),
      })

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text()
        return new Response(JSON.stringify({ error: `TrueLayer token exchange failed: ${errText}` }), {
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

      // Fallback: check /data/v1/accounts if /data/v1/me did not resolve provider
      if (providerId === 'default') {
        try {
          const accRes = await fetch(`${apiBaseUrl}/data/v1/accounts`, {
            headers: { Authorization: `Bearer ${access_token}` },
          })
          if (accRes.ok) {
            const accData = await accRes.json()
            const firstAcc = accData.results?.[0]
            if (firstAcc?.provider) {
              providerId = firstAcc.provider.provider_id || providerId
              providerName = firstAcc.provider.display_name || providerName
              providerLogoUri = firstAcc.provider.logo_uri || null
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      // Default consent expiry to ~90 days from now if not explicitly returned by API
      if (!consentExpiresAt) {
        consentExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Upsert scoped to (profile_id, provider_id).
      // Connect inserts or updates this provider rather than deleting other banks!
      const { error: upsertError } = await supabaseAdmin
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
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'profile_id,provider_id',
        })

      if (upsertError) {
        return new Response(JSON.stringify({ error: `Failed to store tokens: ${upsertError.message}` }), {
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
        id: string
        is_default: boolean
        profile_id: string | null
        name: string
        merchant: string | null
        category: string
        amount: number
        date: string
        is_reviewed: boolean
        account_id: string
      }

      const syncedAccounts: SyncedAccountRow[] = []
      const allNewTransactions: SyncedTxRow[] = []
      const connectionErrors: { provider: string; error: string }[] = []

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
      const MAX_DAYS = 730
      const INITIAL_DAYS = 90
      const BACKFILL_WINDOW_DAYS = 90
      const MAX_WINDOWS_PER_RUN = 8
      const EMPTY_WINDOWS_TO_STOP = 2
      const now = new Date()
      const ABSOLUTE_FLOOR = new Date(now.getTime() - 6 * 365 * DAY_MS)

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

      const accountRowId = (kind: 'accounts' | 'cards', id: string) =>
        kind === 'accounts' ? `tl_acc_${id}` : `tl_card_${id}`

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
              connectionErrors.push({ provider: connection.provider_name, error: `Token refresh failed: ${errText}` })
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

          const accountsList: TlAccount[] = accountsRes.ok ? (await accountsRes.json()).results || [] : []
          const cardsList: TlCard[] = cardsRes.ok ? (await cardsRes.json()).results || [] : []

          if (!accountsRes.ok && !cardsRes.ok) {
            console.warn(`Could not retrieve accounts for ${connection.provider_name}`)
            connectionErrors.push({ provider: connection.provider_name, error: 'Could not fetch accounts' })
            continue
          }

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

          // A. Balances
          await Promise.all(sources.map(async ({ kind, raw }) => {
            const accId = accountRowId(kind, raw.account_id)
            const balanceRes = await fetch(
              `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/balance`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            )
            const balanceData = balanceRes.ok ? await balanceRes.json() : {}
            const balanceVal = balanceData.results?.[0]?.current ?? 0
            const styling = getProviderStyling(raw.provider?.display_name || connection.provider_name)
            const isCard = kind === 'cards'

            syncedAccounts.push({
              id: accId,
              is_default: false,
              profile_id: selfProfileId,
              name:
                raw.display_name ||
                `${raw.provider?.display_name || connection.provider_name} ${isCard ? 'Card' : 'Checking'}`,
              type: isCard
                ? 'credit'
                : (raw as TlAccount).account_type === 'savings'
                  ? 'savings'
                  : 'checking',
              issuer: raw.provider?.display_name || connection.provider_name,
              balance: isCard ? -Math.abs(Number(balanceVal)) : Number(balanceVal),
              annual_fee: 0,
              emoji: styling.emoji,
              color: styling.color,
              updated_at: new Date().toISOString(),
            })
          }))

          // B. Transactions for this connection
          const connectionAccountIds = sources.map(s => accountRowId(s.kind, s.raw.account_id))

          const { data: newestRow } = await supabaseAdmin
            .from('finance_transactions')
            .select('date')
            .eq('profile_id', selfProfileId)
            .in('account_id', connectionAccountIds)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle()

          const { data: oldestRow } = await supabaseAdmin
            .from('finance_transactions')
            .select('date')
            .eq('profile_id', selfProfileId)
            .in('account_id', connectionAccountIds)
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle()

          const daysSinceNewest = newestRow?.date
            ? Math.ceil((Date.now() - new Date(newestRow.date).getTime()) / DAY_MS)
            : null

          const daysToFetch = Math.min(
            MAX_DAYS,
            daysSinceNewest === null ? INITIAL_DAYS : daysSinceNewest + OVERLAP_DAYS,
          )

          const fetchRange = async (from: Date, to: Date): Promise<number> => {
            const qs = `from=${from.toISOString()}&to=${to.toISOString()}`
            const perSource = await Promise.all(sources.map(async ({ kind, raw }) => {
              const accId = accountRowId(kind, raw.account_id)
              const res = await fetch(
                `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/transactions?${qs}`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
              )
              if (!res.ok) return 0
              const txs = (await res.json()).results || []
              for (const tx of txs) {
                allNewTransactions.push({
                  id: `tl_tx_${tx.transaction_id}`,
                  is_default: false,
                  profile_id: selfProfileId,
                  name: tx.merchant_name || tx.description || 'TrueLayer Transaction',
                  merchant: tx.merchant_name || null,
                  category: mapCategory(tx.transaction_category, tx.transaction_classification),
                  amount: -Number(tx.amount),
                  date: tx.timestamp.split('T')[0],
                  is_reviewed: false,
                  account_id: accId,
                })
              }
              return txs.length
            }))
            return perSource.reduce((a: number, b: number) => a + b, 0)
          }

          // Forward pass
          await fetchRange(new Date(now.getTime() - daysToFetch * DAY_MS), now)

          // Backward backfill pass
          let frontier = connection.backfilled_from
            ? new Date(connection.backfilled_from)
            : oldestRow?.date
              ? new Date(oldestRow.date)
              : new Date(now.getTime() - daysToFetch * DAY_MS)

          let backfillComplete = connection.backfill_complete === true
          let emptyStreak = 0
          let windowsWalked = 0

          while (
            !backfillComplete &&
            windowsWalked < MAX_WINDOWS_PER_RUN &&
            frontier > ABSOLUTE_FLOOR
          ) {
            const windowTo = frontier
            const windowFrom = new Date(frontier.getTime() - BACKFILL_WINDOW_DAYS * DAY_MS)
            const found = await fetchRange(windowFrom, windowTo)
            windowsWalked++
            frontier = windowFrom

            emptyStreak = found === 0 ? emptyStreak + 1 : 0
            if (emptyStreak >= EMPTY_WINDOWS_TO_STOP) backfillComplete = true
          }

          if (frontier <= ABSOLUTE_FLOOR) backfillComplete = true

          await supabaseAdmin
            .from('finance_truelayer_connection')
            .update({
              backfilled_from: frontier.toISOString().split('T')[0],
              backfill_complete: backfillComplete,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id)

        } catch (connLoopErr) {
          console.error(`Error syncing provider ${connection.provider_name}:`, connLoopErr)
          connectionErrors.push({
            provider: connection.provider_name,
            error: connLoopErr instanceof Error ? connLoopErr.message : 'Sync failed',
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
          return new Response(JSON.stringify({ error: `Failed to write accounts: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // 5. Deduplicate and write transactions, preserving is_reviewed
      const byId = new Map<string, SyncedTxRow>()
      for (const tx of allNewTransactions) byId.set(tx.id, tx)
      const deduped = Array.from(byId.values())

      const reviewedById = new Map<string, boolean>()
      for (const batch of chunk(deduped.map(t => t.id))) {
        const { data } = await supabaseAdmin
          .from('finance_transactions')
          .select('id, is_reviewed')
          .in('id', batch)
        for (const row of data ?? []) reviewedById.set(row.id, row.is_reviewed)
      }

      const txRows = deduped.map(t => ({
        ...t,
        profile_id: selfProfileId,
        is_reviewed: reviewedById.get(t.id) ?? t.is_reviewed,
      }))

      for (const batch of chunk(txRows)) {
        const { error } = await supabaseAdmin
          .from('finance_transactions')
          .upsert(batch, { onConflict: 'id' })
        if (error) {
          return new Response(JSON.stringify({ error: `Failed to write transactions: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
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

    return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), {
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
