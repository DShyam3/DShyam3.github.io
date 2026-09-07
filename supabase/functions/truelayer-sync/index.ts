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

    const token = authHeader.replace('Bearer ', '')
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
      const { data: connection } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('id, expires_at')
        .eq('profile_id', selfProfileId)
        .maybeSingle()

      return new Response(JSON.stringify({
        connected: !!connection,
        expires_at: connection?.expires_at || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: disconnect
    if (action === 'disconnect') {
      // Scoped to this profile. The unscoped form deleted every profile's
      // connection, so disconnecting one bank signed the others out too.
      if (!selfProfileId) {
        return new Response(JSON.stringify({ error: 'No finance profile found.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await supabaseAdmin
        .from('finance_truelayer_connection')
        .delete()
        .eq('profile_id', selfProfileId)
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

      // Replace this profile's connection. Still one bank per profile -- the
      // table has no provider identity yet, so a second row would be
      // indistinguishable from the first (REHAUL_PLAN.md 7.M step B). What
      // changes here is that it no longer signs out every other profile.
      await supabaseAdmin
        .from('finance_truelayer_connection')
        .delete()
        .eq('profile_id', selfProfileId)
      const { error: insertError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .insert({
          access_token,
          refresh_token,
          expires_at: expiresAt,
          profile_id: selfProfileId,
        })

      if (insertError) {
        return new Response(JSON.stringify({ error: `Failed to store tokens: ${insertError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
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

      // 1. Fetch connection details
      const { data: connection, error: connError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('*')
        .eq('profile_id', selfProfileId)
        .maybeSingle()

      if (connError || !connection) {
        return new Response(JSON.stringify({ error: 'No TrueLayer bank connection found. Please link your account first.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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
          return new Response(JSON.stringify({ error: `Failed to refresh TrueLayer token: ${errText}` }), {
            status: refreshResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const refreshData = await refreshResponse.json()
        accessToken = refreshData.access_token
        refreshToken = refreshData.refresh_token || refreshToken // might not return new refresh token
        expiresAt = new Date(Date.now() + refreshData.expires_in * 1000)

        // Update database
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

      // 3. Fetch Accounts from TrueLayer Data API
      const accountsRes = await fetch(`${apiBaseUrl}/data/v1/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      
      const cardsRes = await fetch(`${apiBaseUrl}/data/v1/cards`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const accountsList = accountsRes.ok ? (await accountsRes.json()).results || [] : []
      const cardsList = cardsRes.ok ? (await cardsRes.json()).results || [] : []

      if (!accountsRes.ok && !cardsRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to retrieve accounts from TrueLayer' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Shapes written back to Supabase. Named so the accumulators are not
      // any[], which is what let a stray field through unnoticed before.
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
        category: string
        amount: number
        date: string
        is_reviewed: boolean
        account_id: string
      }

      const syncedAccounts: SyncedAccountRow[] = []
      const allNewTransactions: SyncedTxRow[] = []

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

      // How far back to ask for.
      //
      // A fixed 30-day incremental window silently assumes you sync at least
      // monthly. Left seven weeks between syncs and it leaves a hole: the
      // fetch starts 30 days ago, the store ends where the last sync did, and
      // nothing ever fills the gap between. Since nothing is deleted any more,
      // an overlapping request is free -- the same rows simply upsert over
      // themselves -- so the window is anchored to the data instead.
      const { data: newestRow } = await supabaseAdmin
        .from('finance_transactions')
        .select('date')
        .eq('profile_id', selfProfileId)
        .like('id', 'tl_tx_%')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      // The other end of what is held, used to seed the history walk the first
      // time it runs.
      const { data: oldestRow } = await supabaseAdmin
        .from('finance_transactions')
        .select('date')
        .eq('profile_id', selfProfileId)
        .like('id', 'tl_tx_%')
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()

      const DAY_MS = 24 * 60 * 60 * 1000
      // Re-ask for a week either side of the boundary: a transaction can
      // settle days after the date it carries, so it may not have existed
      // when the sync that covered its date ran.
      const OVERLAP_DAYS = 7
      // Providers rarely serve more than a couple of years unattended, and an
      // absurd range is likelier to be rejected than honoured.
      const MAX_DAYS = 730
      const INITIAL_DAYS = 90

      const daysSinceNewest = newestRow?.date
        ? Math.ceil((Date.now() - new Date(newestRow.date).getTime()) / DAY_MS)
        : null

      const daysToFetch = Math.min(
        MAX_DAYS,
        daysSinceNewest === null ? INITIAL_DAYS : daysSinceNewest + OVERLAP_DAYS,
      )

      // A. Accounts and balances. Fetched once: a balance is a point in time,
      // not something a date range changes.
      type TlAccount = {
        account_id: string
        display_name?: string
        account_type?: string
        provider?: { display_name?: string }
      }
      type TlCard = {
        account_id: string
        display_name?: string
        provider?: { display_name?: string }
      }

      /** `kind` picks the endpoint family and the id prefix. */
      const sources: { kind: 'accounts' | 'cards'; raw: TlAccount | TlCard }[] = [
        ...accountsList.map((raw: TlAccount) => ({ kind: 'accounts' as const, raw })),
        ...cardsList.map((raw: TlCard) => ({ kind: 'cards' as const, raw })),
      ]
      const accountRowId = (kind: 'accounts' | 'cards', id: string) =>
        kind === 'accounts' ? `tl_acc_${id}` : `tl_card_${id}`

      await Promise.all(sources.map(async ({ kind, raw }) => {
        const accId = accountRowId(kind, raw.account_id)
        const balanceRes = await fetch(
          `${apiBaseUrl}/data/v1/${kind}/${raw.account_id}/balance`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        const balanceData = balanceRes.ok ? await balanceRes.json() : {}
        const balanceVal = balanceData.results?.[0]?.current ?? 0
        const styling = getProviderStyling(raw.provider?.display_name || '')
        const isCard = kind === 'cards'

        syncedAccounts.push({
          id: accId,
          is_default: false,
          profile_id: selfProfileId,
          name:
            raw.display_name ||
            `${raw.provider?.display_name} ${isCard ? 'Card' : 'Checking'}`,
          type: isCard
            ? 'credit'
            : (raw as TlAccount).account_type === 'savings'
              ? 'savings'
              : 'checking',
          issuer: raw.provider?.display_name || 'TrueLayer Sandbox',
          // A card's outstanding balance is money owed.
          balance: isCard ? -Math.abs(Number(balanceVal)) : Number(balanceVal),
          annual_fee: 0,
          emoji: styling.emoji,
          color: styling.color,
          updated_at: new Date().toISOString(),
        })
      }))

      // B. Transactions for one date range, across every account and card.
      // Repeatable, because the history walk calls it once per window.
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
              category: mapCategory(tx.transaction_category, tx.transaction_classification),
              // Debits are positive at TrueLayer and negative here.
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

      const now = new Date()

      // C. Forward pass: everything since the newest row already held.
      await fetchRange(new Date(now.getTime() - daysToFetch * DAY_MS), now)

      // D. Backward pass: walk older windows until the provider runs dry.
      //
      // The retention limit is not published and differs per provider, so it is
      // discovered -- ask for progressively older windows and stop when two in
      // a row come back empty. Bounded per invocation because an edge function
      // is killed long before a multi-year walk finishes; the frontier is
      // persisted so the next sync resumes where this one stopped.
      const BACKFILL_WINDOW_DAYS = 90
      const MAX_WINDOWS_PER_RUN = 8
      const EMPTY_WINDOWS_TO_STOP = 2
      const ABSOLUTE_FLOOR = new Date(now.getTime() - 6 * 365 * DAY_MS)

      let frontier = connection.backfilled_from
        ? new Date(connection.backfilled_from)
        // Not started: begin at the oldest row already held, or at the forward
        // window's edge when there is nothing at all.
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)

      // 4. Write what this sync produced, and touch nothing else.
      //
      // This used to delete every row with is_default = false and reinsert a
      // merged list. Two things were wrong with that. The delete was scoped by
      // is_default alone, so it crossed every profile, and the reinsert stamped
      // the self profile onto every row it wrote -- one sync collapsed all
      // profiles onto one. And the reinserted list only ever contained the
      // current fetch window, so bank history older than that window was
      // deleted on every run and could not be re-fetched once the provider had
      // aged it out.
      //
      // Upsert on the primary key does the whole job: TrueLayer ids are stable,
      // so a row is created once and corrected in place afterwards. Nothing is
      // ever deleted, which is the point -- the bank's window moves, this store
      // does not.
      const syncProfileId = connection.profile_id ?? selfProfileId

      // Supabase sends `in` filters and upsert payloads over the wire, so a
      // ninety-day sync across several accounts has to be chunked.
      const chunk = <T,>(rows: T[], size = 500): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
        return out
      }

      const accountRows = syncedAccounts.map(a => ({ ...a, profile_id: syncProfileId }))
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

      // 5. Transactions, same rule. The bank may correct a description or an
      // amount, so those are overwritten -- but is_reviewed is the user's, not
      // the bank's, and has to survive a re-sync.
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
        profile_id: syncProfileId,
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
        backfilled_from: frontier.toISOString().split('T')[0],
        backfill_complete: backfillComplete,
        windows_walked: windowsWalked
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // The detail goes to the function log, not to the caller: an unhandled
    // throw here can carry a stack or a database message, and CLAUDE.md is
    // explicit that neither belongs in a response body.
    console.error('truelayer-sync failed', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
