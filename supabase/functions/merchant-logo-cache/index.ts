import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// Route C of the transaction-logo work: fetch a merchant's mark ONCE,
// server-side, and cache it in our own bucket.
//
// The version of this that lives in the browser -- <img src="logohost/tesco">
// -- is the one to avoid. It hands a third party a live feed of where this
// user shops, with their IP and a referrer, one request per rendered row.
// Spend history is precisely what the project's projection rules say never
// leaves the allowlist. Done here instead, an outside host learns only that
// somebody once asked about a brand, with no user attached and no repeat.
//
// SSRF: the domain list below is the entire universe of hosts this function
// will touch. Nothing in the request body names a host, a URL or a path -- if
// it ever does, this becomes an open proxy sitting on the service role key.

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

// Mirror of normaliseMerchant/merchantSlug in src/lib/finance/merchant.ts.
// Deno cannot import from src/, so this is a hand-maintained copy -- the same
// arrangement watchlist-cron-sync documents. Change both together, or a
// merchant will cache under one slug and be looked up under another.
const PROCESSOR_PREFIX = /^(paypal|pp|sq|sqc|sumup|zettle|iz|izettle|stripe|klarna|wpy|worldpay|tsys)\s*\*+\s*/

const merchantSlug = (raw: string): string =>
  raw
    .toLowerCase()
    .trim()
    .replace(PROCESSOR_PREFIX, '')
    .replace(/['’ʼ]s\b/g, 's')
    .replace(/\b([a-z0-9-]+)\.(com|co\.uk|net|org|io|shop)\b/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '-')

// Canonical slug to the brand's own domain. Server-side by design: this is the
// SSRF allowlist, not a display concern, and a copy in the browser bundle
// would invite somebody to "just pass the domain in".
//
// Aliases are not listed. The client resolves an alias to its canonical slug
// before it ever asks about a logo, and this function resolves the same way
// through MERCHANT_ALIASES below.
const MERCHANT_DOMAINS: Record<string, string> = {
  'tesco': 'www.tesco.com',
  'sainsburys': 'www.sainsburys.co.uk',
  'asda': 'www.asda.com',
  'morrisons': 'groceries.morrisons.com',
  'aldi': 'www.aldi.co.uk',
  'lidl': 'www.lidl.co.uk',
  'waitrose': 'www.waitrose.com',
  'co-op': 'www.coop.co.uk',
  'marks-and-spencer': 'www.marksandspencer.com',
  'iceland': 'www.iceland.co.uk',
  'amazon': 'www.amazon.co.uk',
  'ebay': 'www.ebay.co.uk',
  'argos': 'www.argos.co.uk',
  'john-lewis': 'www.johnlewis.com',
  'ikea': 'www.ikea.com',
  'boots': 'www.boots.com',
  'screwfix': 'www.screwfix.com',
  'b-q': 'www.diy.com',
  'currys': 'www.currys.co.uk',
  'zara': 'www.zara.com',
  'h-m': 'www2.hm.com',
  'uniqlo': 'www.uniqlo.com',
  'apple': 'www.apple.com',
  'deliveroo': 'deliveroo.co.uk',
  'just-eat': 'www.just-eat.co.uk',
  'uber-eats': 'www.ubereats.com',
  'uber': 'www.uber.com',
  'bolt': 'bolt.eu',
  'mcdonalds': 'www.mcdonalds.com',
  'greggs': 'www.greggs.co.uk',
  'pret-a-manger': 'www.pret.co.uk',
  'costa': 'www.costa.co.uk',
  'starbucks': 'www.starbucks.co.uk',
  'nandos': 'www.nandos.co.uk',
  'wagamama': 'www.wagamama.com',
  'tfl': 'tfl.gov.uk',
  'trainline': 'www.thetrainline.com',
  'national-rail': 'www.nationalrail.co.uk',
  'lner': 'www.lner.co.uk',
  'gwr': 'www.gwr.com',
  'shell': 'www.shell.co.uk',
  'bp': 'www.bp.com',
  'esso': 'www.esso.co.uk',
  'ryanair': 'www.ryanair.com',
  'easyjet': 'www.easyjet.com',
  'british-airways': 'www.britishairways.com',
  'netflix': 'www.netflix.com',
  'spotify': 'www.spotify.com',
  'disney-plus': 'www.disneyplus.com',
  'youtube': 'www.youtube.com',
  'steam': 'store.steampowered.com',
  'playstation': 'www.playstation.com',
  'nintendo': 'www.nintendo.co.uk',
  'audible': 'www.audible.co.uk',
  'vodafone': 'www.vodafone.co.uk',
  'ee': 'ee.co.uk',
  'o2': 'www.o2.co.uk',
  'three': 'www.three.co.uk',
  'bt': 'www.bt.com',
  'sky': 'www.sky.com',
  'virgin-media': 'www.virginmedia.com',
  'octopus-energy': 'octopus.energy',
  'british-gas': 'www.britishgas.co.uk',
  'thames-water': 'www.thameswater.co.uk',
  'tv-licensing': 'www.tvlicensing.co.uk',
  'puregym': 'www.puregym.com',
  'thegym': 'www.thegymgroup.com',
  'nhs': 'www.nhs.uk',
  'royal-mail': 'www.royalmail.com',
}

// Alias slug to canonical slug. Mirror of the alias columns in
// src/lib/finance/merchant-directory.ts -- same hand-maintained-copy rule.
const MERCHANT_ALIASES: Record<string, string> = {
  'tesco-stores': 'tesco', 'tesco-express': 'tesco', 'tesco-metro': 'tesco',
  'tesco-superstore': 'tesco',
  'sainsbury-s': 'sainsburys', 'sainsburys-s-mkt': 'sainsburys',
  'sainsburys-local': 'sainsburys',
  'asda-stores': 'asda', 'asda-superstore': 'asda',
  'wm-morrisons': 'morrisons', 'morrisons-daily': 'morrisons',
  'aldi-stores': 'aldi', 'lidl-gb': 'lidl', 'waitrose-partners': 'waitrose',
  'co-op-group': 'co-op', 'coop': 'co-op', 'the-co-operative': 'co-op',
  'co-op-food': 'co-op',
  'm-s': 'marks-and-spencer', 'marks-spencer': 'marks-and-spencer',
  'm-s-simply-food': 'marks-and-spencer',
  'iceland-foods': 'iceland',
  'amazon-co-uk': 'amazon', 'amznmktplace': 'amazon',
  'amazon-mktplace': 'amazon', 'amazon-marketplace': 'amazon',
  'amzn-mktp': 'amazon',
  'johnlewis': 'john-lewis', 'boots-uk': 'boots', 'b-and-q': 'b-q',
  'currys-pc-world': 'currys', 'h-and-m': 'h-m', 'hennes-mauritz': 'h-m',
  'apple-store': 'apple', 'apple-bill': 'apple',
  'justeat': 'just-eat', 'ubereats': 'uber-eats',
  'uber-trip': 'uber', 'uber-bv': 'uber', 'bolt-eu': 'bolt',
  'mcdonald-s': 'mcdonalds', 'mc-donalds': 'mcdonalds',
  'pret': 'pret-a-manger', 'costa-coffee': 'costa',
  'starbucks-coffee': 'starbucks', 'nando-s': 'nandos',
  'tfl-travel': 'tfl', 'tfl-travel-ch': 'tfl', 'transport-for-london': 'tfl',
  'thetrainline': 'trainline', 'great-western-railway': 'gwr',
  'britishairways': 'british-airways',
  'netflix-com': 'netflix', 'spotify-uk': 'spotify',
  'disneyplus': 'disney-plus', 'disney': 'disney-plus',
  'google-youtube': 'youtube', 'youtube-premium': 'youtube',
  'steam-games': 'steam', 'valve': 'steam',
  'playstation-network': 'playstation', 'sony-playstation': 'playstation',
  'ee-limited': 'ee', 'o2-uk': 'o2', 'telefonica-o2': 'o2', 'h3g-uk': 'three',
  'bt-group': 'bt', 'sky-uk': 'sky', 'sky-digital': 'sky',
  'virginmedia': 'virgin-media', 'octopus': 'octopus-energy',
  'britishgas': 'british-gas', 'tv-licence': 'tv-licensing',
  'pure-gym': 'puregym', 'the-gym-group': 'thegym',
  'nhs-prescription': 'nhs', 'royalmail': 'royal-mail',
}

// Where a brand's square mark usually sits. Apple's touch icon is the one
// convention that is square, sizeable and near-universal; a favicon is 16px
// and looks like grit at 32.
const ICON_PATHS = [
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
]

const MAX_BYTES = 256 * 1024

/**
 * Content sniffing by magic bytes, not by the Content-Type header.
 *
 * The header is the remote host's claim about its own file. This decides what
 * actually goes into a public bucket, so it reads the file.
 */
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  const b = bytes
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  const ascii = (i: number, s: string) =>
    s.split('').every((c, k) => b[i + k] === c.charCodeAt(0))
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/**
 * Fetch one icon from one allowlisted host.
 *
 * Redirects are followed by hand and only to another allowlisted host: an
 * automatic follow is the classic way an allowlist is escaped, since the first
 * hop passes the check and the second goes wherever it likes.
 */
async function fetchIcon(
  domain: string,
  path: string,
  allowedHosts: Set<string>,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  let url = `https://${domain}${path}`

  for (let hop = 0; hop < 3; hop++) {
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { 'Accept': 'image/*' },
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      return null
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel()
      if (!location) return null
      let next: URL
      try {
        next = new URL(location, url)
      } catch {
        return null
      }
      if (next.protocol !== 'https:' || !allowedHosts.has(next.hostname)) return null
      url = next.toString()
      continue
    }

    if (!res.ok) {
      await res.body?.cancel()
      return null
    }

    const declared = Number(res.headers.get('content-length') || '0')
    if (declared > MAX_BYTES) {
      await res.body?.cancel()
      return null
    }

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null

    const bytes = new Uint8Array(buffer)
    const contentType = sniffImage(bytes)
    if (!contentType) return null
    return { bytes, contentType }
  }

  return null
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // `refresh` re-resolves merchants already recorded as misses. Without it a
    // brand that moved its icon stays missing forever; with it as the default,
    // every run would re-walk the whole long tail.
    const body = await req.json().catch(() => ({}))
    const refresh = body?.refresh === true

    // Which merchants the ledger actually contains. Nothing is fetched for a
    // brand nobody here has paid.
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('finance_transactions')
      .select('merchant')
      .not('merchant', 'is', null)
    if (rowsError) {
      return new Response(JSON.stringify({ error: 'Failed to read merchants' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const wanted = new Set<string>()
    for (const row of rows ?? []) {
      const raw = (row as { merchant: string | null }).merchant
      if (!raw) continue
      const alias = merchantSlug(raw)
      const slug = MERCHANT_ALIASES[alias] ?? alias
      if (MERCHANT_DOMAINS[slug]) wanted.add(slug)
    }

    const { data: known } = await supabaseAdmin
      .from('finance_merchant_logos')
      .select('slug, storage_path')

    const skip = new Set<string>()
    for (const row of known ?? []) {
      const r = row as { slug: string; storage_path: string | null }
      if (r.storage_path || !refresh) skip.add(r.slug)
    }

    const allowedHosts = new Set(Object.values(MERCHANT_DOMAINS))
    const todo = [...wanted].filter(slug => !skip.has(slug))

    let cached = 0
    let missed = 0

    for (const slug of todo) {
      const domain = MERCHANT_DOMAINS[slug]
      let found: { bytes: Uint8Array; contentType: string } | null = null
      for (const path of ICON_PATHS) {
        found = await fetchIcon(domain, path, allowedHosts)
        if (found) break
      }

      if (!found) {
        // A recorded miss, so the next run does not walk this host again.
        await supabaseAdmin.from('finance_merchant_logos').upsert({
          slug,
          storage_path: null,
          source_domain: domain,
          resolved_at: new Date().toISOString(),
        }, { onConflict: 'slug' })
        missed++
        continue
      }

      const storagePath = `${slug}.${EXTENSIONS[found.contentType]}`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('merchant-logos')
        .upload(storagePath, found.bytes, {
          contentType: found.contentType,
          upsert: true,
          cacheControl: '604800',
        })

      if (uploadError) {
        missed++
        continue
      }

      await supabaseAdmin.from('finance_merchant_logos').upsert({
        slug,
        storage_path: storagePath,
        source_domain: domain,
        resolved_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
      cached++
    }

    return new Response(JSON.stringify({
      success: true,
      merchants_seen: wanted.size,
      attempted: todo.length,
      cached,
      missed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (_error) {
    // Generic on the wire, detail in the function logs.
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
