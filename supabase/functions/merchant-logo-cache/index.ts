import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'

// Route C of the transaction-logo work: resolve a merchant's mark ONCE,
// server-side, and cache it in our own bucket.
//
// The version of this that lives in the browser -- <img src="logohost/tesco">
// -- is the one to avoid. It hands a third party a live feed of where this
// user shops, with their IP and a referrer, one request per rendered row.
// Spend history is precisely what the project's projection rules say never
// leaves the allowlist. Done here instead, an outside host learns only that
// somebody once asked about a brand, with no user attached and no repeat.
//
// What DOES leave this server is a merchant name, sent to Brandfetch's search
// endpoint to turn "tesco stores" into a domain. Two things bound it:
//
//   - only merchants seen MIN_OCCURRENCES times or more are ever looked up, so
//     a one-off purchase -- the kind that actually says something about a
//     person -- never leaves at all;
//   - the *normalised slug* is sent, never the bank's raw description, so till
//     references, store numbers and card fragments are stripped before the
//     request is built rather than after.
//
// SSRF: BRANDFETCH_HOSTS is the entire universe of hosts this function will
// touch. The domain that search returns is never fetched directly -- it is
// handed back to Brandfetch's own CDN as a path. Nothing in the request body
// names a host, a URL or a path; if it ever does, this becomes an open proxy
// sitting on the service role key.

function buildCorsHeaders(req: Request) {
  return {
    ...corsOriginHeader(req),
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
  'burgerking': 'burger-king', 'domino-s': 'dominos', 'dominos-pizza': 'dominos',
  'nhs-prescription': 'nhs', 'royalmail': 'royal-mail',
  'amex': 'american-express', 'americanexpress': 'american-express',
}

// Canonical slugs the directory knows. Needed here as well as in the aliases
// because a brand with no alternative spellings still has to be recognised at
// the front of a branch description. Mirror of the canonical column in
// src/lib/finance/merchant-directory.ts -- same hand-maintained-copy rule.
const MERCHANT_CANONICAL = new Set<string>([
  'tesco', 'sainsburys', 'asda', 'morrisons', 'aldi', 'lidl', 'waitrose',
  'co-op', 'marks-and-spencer', 'iceland', 'amazon', 'ebay', 'argos',
  'john-lewis', 'ikea', 'boots', 'screwfix', 'b-q', 'currys', 'zara', 'h-m',
  'uniqlo', 'apple', 'deliveroo', 'just-eat', 'uber-eats', 'uber', 'bolt',
  'mcdonalds', 'greggs', 'pret-a-manger', 'costa', 'starbucks', 'nandos',
  'wagamama', 'subway', 'kfc', 'burger-king', 'dominos', 'tfl', 'trainline',
  'national-rail', 'lner', 'gwr', 'shell', 'bp', 'esso', 'ryanair', 'easyjet',
  'british-airways', 'netflix', 'spotify', 'disney-plus', 'youtube', 'steam',
  'playstation', 'nintendo', 'audible', 'vodafone', 'ee', 'o2', 'three', 'bt',
  'sky', 'virgin-media', 'octopus-energy', 'british-gas', 'thames-water',
  'tv-licensing', 'puregym', 'thegym', 'nhs', 'royal-mail', 'american-express',
])

/**
 * Domains for brands whose NAME is ambiguous, searched or not.
 *
 * Brand search matches on a name and never says "no such brand", so a short or
 * ordinary word finds a confident stranger: `co op` returned a Kenyan bank,
 * and `iceland` is a country before it is a freezer shop. For these the domain
 * is the identity, so it is stated rather than guessed and search is skipped
 * entirely -- which also spends one request instead of two.
 *
 * Only ambiguous brands belong here. A name that identifies its brand on its
 * own is better left to search, which stays current as companies move domain.
 *
 * Server-side only: the browser resolves logos by slug and never needs a
 * domain, so unlike the alias table this is not mirrored in src/.
 */
const MERCHANT_DOMAIN_HINTS: Record<string, string> = {
  'co-op': 'coop.co.uk',
  'iceland': 'iceland.co.uk',
  'apple': 'apple.com',
  'bp': 'bp.com',
  'ee': 'ee.co.uk',
  'o2': 'o2.co.uk',
  'bt': 'bt.com',
  'three': 'three.co.uk',
  'sky': 'sky.com',
  'shell': 'shell.co.uk',
  'esso': 'esso.co.uk',
  'boots': 'boots.com',
  'lidl': 'lidl.co.uk',
  'aldi': 'aldi.co.uk',
  'asda': 'asda.com',
  'subway': 'subway.com',
  'nhs': 'nhs.uk',
  'steam': 'store.steampowered.com',
  'bolt': 'bolt.eu',
  'uber': 'uber.com',
}

/**
 * The canonical slug for a normalised merchant, matching on leading whole
 * words. Mirror of directoryEntryFor in src/lib/finance/merchant.ts -- the two
 * must agree or a logo caches under a key the browser never asks for.
 *
 * A real row reads `LIDL GB WOOLSTON LIDL GB WOOLS GB`. The brand is at the
 * front; branch, town and country follow. Whole words only, so `bps-garage`
 * is not BP.
 */
function canonicalSlug(slug: string): string | null {
  const direct = MERCHANT_ALIASES[slug] ?? (MERCHANT_CANONICAL.has(slug) ? slug : null)
  if (direct) return direct

  const words = slug.split('-').filter(Boolean)
  for (let take = words.length - 1; take > 0; take--) {
    const prefix = words.slice(0, take).join('-')
    const hit = MERCHANT_ALIASES[prefix] ?? (MERCHANT_CANONICAL.has(prefix) ? prefix : null)
    if (hit) return hit
  }
  return null
}

// The only hosts this function will talk to. Brandfetch's search turns a name
// into a domain and its CDN turns a domain into an image, so we never fetch a
// merchant's own site -- which means no walking redirects across the open web,
// and an allowlist with two entries rather than seventy.
const BRANDFETCH_SEARCH_HOST = 'api.brandfetch.io'
const BRANDFETCH_CDN_HOST = 'cdn.brandfetch.io'
const BRANDFETCH_HOSTS = new Set([BRANDFETCH_SEARCH_HOST, BRANDFETCH_CDN_HOST])

/**
 * How often a merchant must appear before it is looked up.
 *
 * This used to be the privacy control, set at three so a one-off purchase
 * never left the server. It is not any more: only merchants the directory
 * already names are looked up at all, and that list is public brand names
 * sitting in our own source. Nothing personal can leave by construction, which
 * is a far better guarantee than a frequency threshold -- a transfer labelled
 * with a person's name recurs happily and sailed straight through the old one.
 *
 * So this is now only about not spending requests on nothing, and one sighting
 * of a brand we already know is reason enough.
 */
const MIN_OCCURRENCES = 1

/**
 * Brandfetch allows 200 requests per 5 minutes per IP, and edge functions
 * share an egress IP with whatever else is running. Each merchant costs up to
 * two requests, so 40 per run stays under a quarter of that window's budget
 * and finishes well inside the function's wall clock. Whatever is left over is
 * reported back and picked up by the next run.
 */
const MAX_LOOKUPS_PER_RUN = 40
const SPACING_MS = 250

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Raised when Brandfetch rate-limits us, so the run stops instead of
 *  recording a wall of misses that are not misses. */
class RateLimited extends Error {}

/**
 * A merchant name to a brand domain, via Brandfetch's search.
 *
 * Returns the domain and, when search supplied one, the icon URL it already
 * knows -- which saves the second request. `null` means the brand is genuinely
 * not in their index; a rate limit throws instead, because "ask again later"
 * and "no such brand" must not be recorded the same way.
 */
async function searchBrand(
  query: string,
  clientId: string,
): Promise<{ domain: string; icon: string | null } | null> {
  const url = `https://${BRANDFETCH_SEARCH_HOST}/v2/search/${encodeURIComponent(query)}?c=${encodeURIComponent(clientId)}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      // Never follow a redirect from the search API. The default ('follow')
      // would chase a 3xx to any host, from a function holding the service
      // role key -- the hole fetchImage closes by re-checking every hop. A
      // search has no reason to redirect, so a 3xx is treated like any other
      // failed search rather than followed.
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }

  if (res.status >= 300 && res.status <= 399) {
    await res.body?.cancel()
    return null
  }
  if (res.status === 429) {
    await res.body?.cancel()
    throw new RateLimited()
  }
  if (!res.ok) {
    await res.body?.cancel()
    return null
  }

  const results = await res.json().catch(() => null)
  if (!Array.isArray(results) || results.length === 0) return null

  // The first result is the best match. `domain` is the only non-nullable
  // field in their schema, so anything without one is unusable.
  const top = results[0] as { domain?: unknown; icon?: unknown }
  if (typeof top.domain !== 'string' || !top.domain) return null

  const icon = typeof top.icon === 'string' && top.icon ? top.icon : null
  return { domain: top.domain, icon }
}

/**
 * Fetch image bytes from a Brandfetch URL.
 *
 * The URL is either built here or taken from a search response, so it is
 * checked against the host allowlist before use either way -- a third party's
 * JSON is untrusted input, and `icon` is a field they control.
 *
 * Redirects are followed by hand, one hop at a time, because the allowlist has
 * to be re-checked on every one. `redirect: 'follow'` checks only the URL we
 * start from: a 302 from the CDN to 169.254.169.254 or 127.0.0.1 would then be
 * issued by this function, which holds the service role key, and the
 * magic-byte sniff would not stop it -- that bounds what gets *stored*, not
 * what gets *requested*, and the request is the whole of an SSRF. AGENTS.md
 * requires the host check before the request, which means before each of them.
 */
const MAX_IMAGE_REDIRECTS = 3

/** https, and a host on the allowlist. The only URLs this function may fetch. */
const allowedImageUrl = (candidate: string, base?: URL): URL | null => {
  let url: URL
  try {
    url = base ? new URL(candidate, base) : new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !BRANDFETCH_HOSTS.has(url.hostname)) return null
  return url
}

async function fetchImage(
  rawUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  let url = allowedImageUrl(rawUrl)
  if (!url) return null

  let res: Response
  let hops = 0
  for (;;) {
    try {
      res = await fetch(url.toString(), {
        headers: { 'Accept': 'image/*' },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      return null
    }

    if (res.status < 300 || res.status > 399) break

    // A redirect: re-validate the target before following it, and never
    // follow more than a few -- a loop inside the allowlist is still a loop.
    await res.body?.cancel()
    if (hops >= MAX_IMAGE_REDIRECTS) return null
    const location = res.headers.get('location')
    if (!location) return null
    const next = allowedImageUrl(location, url)
    if (!next) return null
    url = next
    hops += 1
  }

  if (res.status === 429) {
    await res.body?.cancel()
    throw new RateLimited()
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
  // Magic bytes, not their Content-Type header, and deliberately no SVG: an
  // SVG served from our own storage origin can execute script if a person
  // opens it directly, which is not a trade worth a sharper logo.
  const contentType = sniffImage(bytes)
  if (!contentType) return null
  return { bytes, contentType }
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

    // Asks public.is_admin() through the caller's own JWT, so this function and
    // every RLS policy agree on who an administrator is.
    const denial = await requireAdmin(userClient)
    if (denial) {
      return new Response(JSON.stringify({ error: denial.error }), {
        status: denial.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // A run can spend up to 2 x MAX_LOOKUPS_PER_RUN of Brandfetch's 200 per
    // five minutes. Two runs a window stays under it however the function is
    // called; after a bank sync, which has its own cooldown, it never binds.
    const { data: overLimit, error: limitError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: 'merchant-logo-cache',
      p_limit: 2,
      p_window_seconds: 300,
    })
    if (limitError) console.error('logo cache limit check failed, allowing request:', limitError.message)
    if (overLimit === true) {
      return new Response(JSON.stringify({ error: 'Too many requests', retry_after: 300 }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '300' },
      })
    }

    const clientId = Deno.env.get('BRANDFETCH_CLIENT_ID')
    if (!clientId) {
      console.error('BRANDFETCH_CLIENT_ID is not set; cannot resolve logos')
      return new Response(JSON.stringify({ error: 'Something went wrong' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // `refresh` re-resolves merchants already recorded as misses. Without it a
    // brand that arrives in the index later stays missing forever; with it as
    // the default, every run would re-walk the whole long tail.
    const body = await req.json().catch(() => ({}))
    const refresh = body?.refresh === true

    // Which merchants the ledger actually contains. Nothing is looked up for a
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

    // Counted per canonical slug, so five spellings of one supermarket are one
    // merchant seen five times rather than five merchants seen once.
    const occurrences = new Map<string, number>()
    for (const row of rows ?? []) {
      const raw = (row as { merchant: string | null }).merchant
      if (!raw) continue
      const alias = merchantSlug(raw)
      if (!alias) continue
      // Unrecognised merchants are not counted, not queried and never sent.
      // Brand search is fuzzy and never answers "no such brand" -- asked about
      // a person's name it returns a real company with real confidence, which
      // is how an account transfer ended up wearing a stranger's logo. The
      // directory is the allowlist.
      const slug = canonicalSlug(alias)
      if (!slug) continue
      occurrences.set(slug, (occurrences.get(slug) ?? 0) + 1)
    }

    const { data: known } = await supabaseAdmin
      .from('finance_merchant_logos')
      .select('slug, storage_path')

    // Reconcile first: anything cached under a slug the directory no longer
    // names is removed, index row and stored object together.
    //
    // This exists because an earlier version queried every merchant, not just
    // known ones, and brand search answered confidently every time -- a
    // transfer labelled with the account holder's name resolved to an
    // unrelated company, whose logo then sat on the row. Those rows have to go
    // rather than linger until something happens to overwrite them, and making
    // it part of the normal run means the cache converges on whatever the
    // directory currently says instead of accumulating.
    const stale = (known ?? [])
      .map(row => row as { slug: string; storage_path: string | null })
      .filter(row => !MERCHANT_CANONICAL.has(row.slug))

    let purged = 0
    if (stale.length > 0) {
      const paths = stale
        .map(row => row.storage_path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
      if (paths.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage
          .from('merchant-logos')
          .remove(paths)
        if (removeError) console.warn('Could not remove stale logos:', removeError.message)
      }

      const { error: deleteError } = await supabaseAdmin
        .from('finance_merchant_logos')
        .delete()
        .in('slug', stale.map(row => row.slug))
      if (deleteError) {
        console.warn('Could not clear stale logo rows:', deleteError.message)
      } else {
        purged = stale.length
      }
    }

    const staleSlugs = new Set(stale.map(row => row.slug))
    const skip = new Set<string>()
    for (const row of known ?? []) {
      const r = row as { slug: string; storage_path: string | null }
      if (staleSlugs.has(r.slug)) continue
      if (r.storage_path || !refresh) skip.add(r.slug)
    }

    const eligible = [...occurrences.entries()]
      .filter(([slug, count]) => count >= MIN_OCCURRENCES && !skip.has(slug))
      // Most-seen first, so a capped run spends its budget where the logo will
      // be looked at most.
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug)

    const todo = eligible.slice(0, MAX_LOOKUPS_PER_RUN)

    let cached = 0
    let missed = 0
    let rateLimited = false

    for (const [index, slug] of todo.entries()) {
      if (index > 0) await sleep(SPACING_MS)

      // Always a canonical slug, so this is a brand name out of our own
      // directory with the branch, town and store number already gone.
      const query = slug.replace(/-/g, ' ')

      let resolved: { domain: string; icon: string | null } | null = null
      let image: { bytes: Uint8Array; contentType: string } | null = null

      try {
        // A hinted brand skips search: its domain is already known, and asking
        // by name is exactly what goes wrong for these.
        const hinted = MERCHANT_DOMAIN_HINTS[slug]
        resolved = hinted ? { domain: hinted, icon: null } : await searchBrand(query, clientId)
        if (resolved) {
          const iconUrl = resolved.icon
            ?? `https://${BRANDFETCH_CDN_HOST}/${encodeURIComponent(resolved.domain)}?c=${encodeURIComponent(clientId)}`
          image = await fetchImage(iconUrl)
        }
      } catch (err) {
        if (err instanceof RateLimited) {
          // Stop cleanly. Nothing is recorded for this merchant, so the next
          // run retries it rather than treating a throttle as "no such brand".
          rateLimited = true
          break
        }
        throw err
      }

      if (!image) {
        // A recorded miss, so the next run does not ask about this one again.
        await supabaseAdmin.from('finance_merchant_logos').upsert({
          slug,
          storage_path: null,
          source_domain: resolved?.domain ?? null,
          resolved_at: new Date().toISOString(),
        }, { onConflict: 'slug' })
        missed++
        continue
      }

      const storagePath = `${slug}.${EXTENSIONS[image.contentType]}`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('merchant-logos')
        .upload(storagePath, image.bytes, {
          contentType: image.contentType,
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
        source_domain: resolved?.domain ?? null,
        resolved_at: new Date().toISOString(),
      }, { onConflict: 'slug' })
      cached++
    }

    return new Response(JSON.stringify({
      success: true,
      merchants_seen: occurrences.size,
      eligible: eligible.length,
      purged,
      attempted: cached + missed,
      cached,
      missed,
      rate_limited: rateLimited,
      remaining: eligible.length - cached - missed,
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
