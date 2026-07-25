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
      await supabaseAdmin.from('finance_truelayer_connection').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all rows
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ACTION: exchange_code
    if (action === 'exchange_code') {
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

      // Clear existing connections and insert new one
      await supabaseAdmin.from('finance_truelayer_connection').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error: insertError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .insert({
          access_token,
          refresh_token,
          expires_at: expiresAt,
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
      // 1. Fetch connection details
      const { data: connection, error: connError } = await supabaseAdmin
        .from('finance_truelayer_connection')
        .select('*')
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

      const syncedAccounts = []
      const allNewTransactions = []

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

      // Determine if this is the initial sync by checking if we have any existing TrueLayer transactions in the database
      const { count: existingTlTxCount } = await supabaseAdmin
        .from('finance_transactions')
        .select('id', { count: 'exact', head: true })
        .like('id', 'tl_tx_%')

      const isInitialSync = !existingTlTxCount || existingTlTxCount === 0
      const daysToFetch = isInitialSync ? 90 : 30 // Pull 90 days on initial sync, 30 days on subsequent syncs to keep it fast
      const fromDate = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000).toISOString()

      // A. Process Bank Accounts (balance + transactions fetched in
      // parallel per account, and accounts processed in parallel with each
      // other -- previously this was 2 sequential round-trips per account).
      await Promise.all(accountsList.map(async (account: any) => {
        const accId = `tl_acc_${account.account_id}`

        const [balanceRes, txRes] = await Promise.all([
          fetch(`${apiBaseUrl}/data/v1/accounts/${account.account_id}/balance`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${apiBaseUrl}/data/v1/accounts/${account.account_id}/transactions?from=${fromDate}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ])

        const balanceData = balanceRes.ok ? await balanceRes.json() : {}
        const balanceVal = balanceData.results?.[0]?.current ?? 0

        const styling = getProviderStyling(account.provider?.display_name || '')
        const accountRow = {
          id: accId,
          is_default: false,
          name: account.display_name || `${account.provider?.display_name} Checking`,
          type: account.account_type === 'savings' ? 'savings' : 'checking',
          issuer: account.provider?.display_name || 'TrueLayer Sandbox',
          balance: Number(balanceVal),
          annual_fee: 0,
          emoji: styling.emoji,
          color: styling.color,
          updated_at: new Date().toISOString(),
        }

        syncedAccounts.push(accountRow)

        if (txRes.ok) {
          const txData = await txRes.json()
          const txs = txData.results || []
          for (const tx of txs) {
            allNewTransactions.push({
              id: `tl_tx_${tx.transaction_id}`,
              is_default: false,
              name: tx.merchant_name || tx.description || 'TrueLayer Transaction',
              category: mapCategory(tx.transaction_category, tx.transaction_classification),
              amount: -Number(tx.amount), // invert since debits are negative in TrueLayer, positive in app
              date: tx.timestamp.split('T')[0],
              is_reviewed: false,
              account_id: accId,
            })
          }
        }
      }))

      // B. Process Card Accounts (same parallelization as accounts above)
      await Promise.all(cardsList.map(async (card: any) => {
        const accId = `tl_card_${card.account_id}`

        const [balanceRes, txRes] = await Promise.all([
          fetch(`${apiBaseUrl}/data/v1/cards/${card.account_id}/balance`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${apiBaseUrl}/data/v1/cards/${card.account_id}/transactions?from=${fromDate}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ])

        const balanceData = balanceRes.ok ? await balanceRes.json() : {}
        const balanceVal = balanceData.results?.[0]?.current ?? 0

        const styling = getProviderStyling(card.provider?.display_name || '')
        const accountRow = {
          id: accId,
          is_default: false,
          name: card.display_name || `${card.provider?.display_name} Card`,
          type: 'credit',
          issuer: card.provider?.display_name || 'TrueLayer Sandbox',
          balance: -Math.abs(Number(balanceVal)), // force negative outstanding balance
          annual_fee: 0,
          emoji: styling.emoji,
          color: styling.color,
          updated_at: new Date().toISOString(),
        }

        syncedAccounts.push(accountRow)

        if (txRes.ok) {
          const txData = await txRes.json()
          const txs = txData.results || []
          for (const tx of txs) {
            allNewTransactions.push({
              id: `tl_tx_${tx.transaction_id}`,
              is_default: false,
              name: tx.merchant_name || tx.description || 'TrueLayer Card Transaction',
              category: mapCategory(tx.transaction_category, tx.transaction_classification),
              amount: -Number(tx.amount), // invert since debits are negative in TrueLayer, positive in app
              date: tx.timestamp.split('T')[0],
              is_reviewed: false,
              account_id: accId,
            })
          }
        }
      }))

      // 4. Update Bank Accounts Table (Delete and replace only our synced accounts to prevent clashing)
      // Since saving in the frontend deletes is_default=false, we will upsert these.
      // Wait, to keep them aligned, we should query existing bank accounts, merge with our new synced ones,
      // and update the table.
      const { data: existingAccounts } = await supabaseAdmin
        .from('finance_bank_accounts')
        .select('*')
        .eq('is_default', false)

      const mergedAccountsMap = new Map()
      if (existingAccounts) {
        existingAccounts.forEach(acc => mergedAccountsMap.set(acc.id, acc))
      }
      syncedAccounts.forEach(acc => {
        const existing = mergedAccountsMap.get(acc.id)
        mergedAccountsMap.set(acc.id, {
          ...existing,
          ...acc
        })
      })

      // Clean and write accounts
      await supabaseAdmin.from('finance_bank_accounts').delete().eq('is_default', false)
      const accountsToWrite = Array.from(mergedAccountsMap.values())
      if (accountsToWrite.length > 0) {
        await supabaseAdmin.from('finance_bank_accounts').insert(accountsToWrite.map(a => ({
          id: a.id,
          is_default: false,
          name: a.name,
          type: a.type,
          issuer: a.issuer,
          balance: a.balance,
          annual_fee: a.annual_fee,
          emoji: a.emoji,
          color: a.color,
        })))
      }

      // 5. Update Transactions Table (Avoiding duplicates by matching id)
      const { data: existingTx } = await supabaseAdmin
        .from('finance_transactions')
        .select('id, is_reviewed')
        .eq('is_default', false)

      const existingTxMap = new Map()
      if (existingTx) {
        existingTx.forEach(t => existingTxMap.set(t.id, t.is_reviewed))
      }

      // Filter new transactions and preserve review status for ones we already have
      const finalTxList = []
      const newTxIds = new Set()
      
      for (const tx of allNewTransactions) {
        if (newTxIds.has(tx.id)) continue
        newTxIds.add(tx.id)

        if (existingTxMap.has(tx.id)) {
          // Transaction already in DB, keep it with its current is_reviewed status
          finalTxList.push({
            ...tx,
            is_reviewed: existingTxMap.get(tx.id)
          })
        } else {
          // New transaction
          finalTxList.push(tx)
        }
      }

      // Also preserve any manually added transactions (not from TrueLayer) that exist in database
      if (existingAccounts) {
        // Find existing transactions that are NOT TrueLayer transactions
        const nonTlTx = existingTx?.filter(t => !t.id.startsWith('tl_tx_')) || []
        if (nonTlTx.length > 0) {
          // Single batched lookup instead of one round-trip per transaction
          const { data: fullTxRows } = await supabaseAdmin
            .from('finance_transactions')
            .select('*')
            .in('id', nonTlTx.map(t => t.id))
          if (fullTxRows) {
            finalTxList.push(...fullTxRows)
          }
        }
      }

      // Write merged transactions list
      await supabaseAdmin.from('finance_transactions').delete().eq('is_default', false)
      if (finalTxList.length > 0) {
        await supabaseAdmin.from('finance_transactions').insert(finalTxList.map(t => ({
          id: t.id,
          is_default: false,
          name: t.name,
          category: t.category,
          amount: t.amount,
          date: t.date,
          is_reviewed: t.is_reviewed,
          account_id: t.account_id || null,
        })))
      }

      return new Response(JSON.stringify({
        success: true,
        synced_accounts: syncedAccounts.length,
        synced_transactions: finalTxList.filter(t => t.id.startsWith('tl_tx_')).length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
