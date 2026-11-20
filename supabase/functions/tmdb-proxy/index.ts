import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { addressBlock, clientAddress } from '../_shared/client-address.ts'
import { createUsageBatcher, recordApiUsage } from '../_shared/api-usage.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// This proxy is intentionally reachable without a Supabase session, since it
// backs the public Watchlist page. To stop it being abused as a free,
// unlimited generic TMDB proxy (which would burn the shared API key's
// quota), only known endpoint shapes actually used by the app are allowed.
const ALLOWED_ENDPOINT_PATTERNS = [
    /^search\/(movie|tv|person)$/,
    /^discover\/(movie|tv)$/,
    /^(movie|tv)\/\d+\/recommendations$/,
    /^movie\/\d+$/,
    /^tv\/\d+$/,
    /^tv\/\d+\/season\/\d+$/,
    // A film collection's parts, for Franchises: which films a collection
    // holds is the one thing the library's own rows cannot answer.
    /^collection\/\d+$/,
    /^person\/\d+\/combined_credits$/,
]

function buildCorsHeaders(req: Request) {
    return {
        ...corsOriginHeader(req),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    }
}

// --- Rate limiting -------------------------------------------------------
//
// The origin allowlist above is enforced by *browsers*. curl ignores it, so
// without this the endpoint allowlist bounds what can be proxied but not how
// much: a loop could burn the whole TMDB quota and leave the public Watchlist
// with nothing to show.
//
// The counter lives in Postgres, not in this module. An in-memory Map was the
// obvious cheap answer and it does nothing here -- the Edge Runtime does not
// reuse an isolate between requests at this traffic level, so module state is
// empty on every call. Measured: 90 requests in 2 seconds all passed, with a
// diagnostic header reporting a map size of 0 every time.
const WINDOW_SECONDS = 60
const MAX_REQUESTS_PER_WINDOW = 60

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * The limiter key: the visitor's address (see _shared/client-address.ts). This
 * limiter only protects shared API quota; it is not an authentication or
 * authorization boundary.
 *
 * Prefixed, because `rate_limits` also holds the admin cooldowns
 * (`truelayer-sync:manual`, `watchlist-sync:full`, ...). A bare header value
 * could otherwise name one of those keys and hold a manual sync off.
 */
function callerKey(req: Request): string {
    const address = clientAddress(req)
    return `tmdb-proxy:${address ? addressBlock(address) : 'unknown'}`
}

/**
 * Counts the hit and reports whether the caller is over the limit.
 *
 * Fails open. If the database is unreachable the visitor still gets their
 * page: a rate limiter that takes the site down when it breaks is worse than
 * the abuse it prevents, and what is being protected here is a free API
 * quota rather than data.
 */
async function isRateLimited(
    key: string,
    limit = MAX_REQUESTS_PER_WINDOW,
    windowSeconds = WINDOW_SECONDS,
): Promise<boolean> {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
                p_key: key,
                p_limit: limit,
                p_window_seconds: windowSeconds,
            }),
        })
        if (!response.ok) return false
        return (await response.json()) === true
    } catch (error) {
        console.error('rate limit check failed, allowing request:', error)
        return false
    }
}

function parseSpinoffSeedIds(raw: string | null): number[] {
    if (!raw) return []
    const ids = raw
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isInteger(id) && id > 0)
    return [...new Set(ids)].slice(0, 400)
}

interface WikidataBinding {
    seedTmdb?: { value?: string }
    seedLabel?: { value?: string }
    franchiseId?: { value?: string }
    franchiseLabel?: { value?: string }
    relatedLabel?: { value?: string }
    relatedTvTmdb?: { value?: string }
    relatedMovieTmdb?: { value?: string }
    relDate?: { value?: string }
}

interface TvSpinoffLink {
    seedTmdbId: number
    seedTitle: string
    franchiseId: string | null
    franchiseName: string | null
    relatedMediaType: 'tv' | 'movie'
    relatedTmdbId: number
    relatedTitle: string
    releaseDate: string | null
    posterPath: string | null
}

async function fetchTvSpinoffs(seedIds: number[]): Promise<TvSpinoffLink[]> {
    if (seedIds.length === 0) return []
    const values = seedIds.map((id) => `"${id}"`).join(' ')
    const sparql = `SELECT DISTINCT ?seedTmdb ?seedLabel ?franchiseId ?franchiseLabel ?relatedLabel ?relatedTvTmdb ?relatedMovieTmdb ?relDate WHERE {
  VALUES ?seedTmdb { ${values} }
  ?seed wdt:P4983 ?seedTmdb .
  { ?seed wdt:P2512 ?related . }
  UNION { ?related wdt:P2512 ?seed . }
  FILTER(?seed != ?related)
  OPTIONAL {
    ?seed wdt:P8345 ?franchise .
    BIND(STRAFTER(STR(?franchise), "entity/") AS ?franchiseId)
    ?franchise rdfs:label ?franchiseLabel .
    FILTER(LANG(?franchiseLabel) = "en")
  }
  OPTIONAL { ?related wdt:P4983 ?relatedTvTmdb . }
  OPTIONAL { ?related wdt:P4947 ?relatedMovieTmdb . }
  OPTIONAL { ?related wdt:P580 ?startTime . }
  OPTIONAL { ?related wdt:P577 ?pubDate . }
  BIND(COALESCE(?startTime, ?pubDate) AS ?relDate)
  FILTER(BOUND(?relatedTvTmdb) || BOUND(?relatedMovieTmdb))
  ?seed rdfs:label ?seedLabel . FILTER(LANG(?seedLabel) = "en")
  ?related rdfs:label ?relatedLabel . FILTER(LANG(?relatedLabel) = "en")
}`
    const url = new URL('https://query.wikidata.org/sparql')
    url.searchParams.set('query', sparql)
    const response = await fetch(url.toString(), {
        headers: {
            'Accept': 'application/sparql-results+json',
            'User-Agent': 'DShyamWatchlist/1.0 (https://dshyam3.github.io)',
        },
    })
    if (!response.ok) throw new Error(`Wikidata returned ${response.status}`)
    const payload = (await response.json()) as { results?: { bindings?: WikidataBinding[] } }
    const links: TvSpinoffLink[] = []
    const seen = new Set<string>()
    for (const row of payload.results?.bindings ?? []) {
        const seedTmdbId = Number(row.seedTmdb?.value)
        const seedTitle = row.seedLabel?.value?.trim()
        const relatedTitle = row.relatedLabel?.value?.trim()
        const tvId = row.relatedTvTmdb?.value ? Number(row.relatedTvTmdb.value) : null
        const movieId = !tvId && row.relatedMovieTmdb?.value ? Number(row.relatedMovieTmdb.value) : null
        const relatedMediaType = tvId ? 'tv' : movieId ? 'movie' : null
        const relatedTmdbId = tvId ?? movieId
        if (
            !Number.isInteger(seedTmdbId) ||
            seedTmdbId <= 0 ||
            !seedTitle ||
            !relatedTitle ||
            !relatedMediaType ||
            !relatedTmdbId ||
            !Number.isInteger(relatedTmdbId) ||
            relatedTmdbId <= 0
        ) continue
        const key = `${seedTmdbId}->${relatedMediaType}:${relatedTmdbId}`
        if (seen.has(key)) continue
        seen.add(key)
        const rawDate = row.relDate?.value?.slice(0, 10) ?? null
        links.push({
            seedTmdbId,
            seedTitle,
            franchiseId: row.franchiseId?.value?.trim() || null,
            franchiseName: row.franchiseLabel?.value?.trim() || null,
            relatedMediaType,
            relatedTmdbId,
            relatedTitle,
            releaseDate: rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null,
            posterPath: null,
        })
    }

    // Enrich unique related targets with TMDB poster_path and release_date in parallel
    // so not-in-library spin-offs render posters without extra browser requests.
    if (TMDB_API_KEY && links.length > 0) {
        const targets = new Map<string, { media: 'tv' | 'movie'; id: number }>()
        for (const l of links) {
            const k = `${l.relatedMediaType}:${l.relatedTmdbId}`
            if (!targets.has(k)) targets.set(k, { media: l.relatedMediaType, id: l.relatedTmdbId })
        }
        const meta = new Map<string, { posterPath: string | null; releaseDate: string | null }>()
        await Promise.allSettled(
            [...targets.entries()].slice(0, 40).map(async ([k, t]) => {
                const res = await fetch(`${TMDB_BASE_URL}/${t.media}/${t.id}?api_key=${TMDB_API_KEY}&language=en-GB`)
                if (!res.ok) return
                const detail = (await res.json()) as {
                    poster_path?: string | null
                    release_date?: string | null
                    first_air_date?: string | null
                }
                const d = (detail.release_date || detail.first_air_date || '').slice(0, 10)
                meta.set(k, {
                    posterPath: detail.poster_path ?? null,
                    releaseDate: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
                })
            }),
        )
        for (const l of links) {
            const hit = meta.get(`${l.relatedMediaType}:${l.relatedTmdbId}`)
            if (!hit) continue
            if (hit.posterPath) l.posterPath = hit.posterPath
            if (!l.releaseDate && hit.releaseDate) l.releaseDate = hit.releaseDate
        }
    }

    return links
}

// --- Shared film universes ------------------------------------------------
//
// TMDB groups films by collection only, which splits a shared universe into
// small ones ("The Avengers Collection", "Iron Man Collection"). Wikidata has
// the universe as a series: each film carries "part of the series" (P179)
// pointing at it, and its TMDB id as P4947. P179 is read across every rank but
// deprecated, since a film's universe statement is not always its preferred
// one. Media franchise (P8345) is not used: for the MCU it holds only shorts
// and TV specials.
//
// A fixed registry rather than an id the caller names, so the endpoint stays
// a known shape like the rest of the allowlist. Adding a universe is a row.
const FILM_UNIVERSES: { id: string; name: string }[] = [
    { id: 'Q642878', name: 'Marvel Cinematic Universe' },
]

/** Film and film project: no shorts or TV specials. An extended cut shares its film's TMDB id. */
const FILM_TYPES = ['Q11424', 'Q18011172']

/**
 * Per universe, earliest first. A universe film needs one TMDB details call
 * for its title and poster, and the MCU has about 45.
 */
const MAX_UNIVERSE_FILMS = 80
/** Details calls in flight at once, so the lookup does not 429 itself. */
const UNIVERSE_DETAIL_CONCURRENCY = 10

// One call here costs one SPARQL query and a details call per film, and
// every caller rebuilds the same answer. The client asks once a day per
// browser, so a second, tighter limit bounds what a loop can spend.
const UNIVERSE_LIMIT = 6
const UNIVERSE_WINDOW_SECONDS = 600

interface FilmUniverseBinding {
    universe?: { value?: string }
    tmdb?: { value?: string }
    label?: { value?: string }
    date?: { value?: string }
}

interface FilmUniverseMember {
    universeId: string
    universeName: string
    tmdbId: number
    title: string | null
    releaseDate: string | null
    posterPath: string | null
}

const isoDay = (raw: string | null | undefined): string | null => {
    const day = raw?.slice(0, 10) ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

async function fetchFilmUniverses(usage: ReturnType<typeof createUsageBatcher>): Promise<FilmUniverseMember[]> {
    const names = new Map(FILM_UNIVERSES.map((u) => [u.id, u.name]))
    const sparql = `SELECT ?universe ?tmdb ?label ?date WHERE {
  VALUES ?universe { ${FILM_UNIVERSES.map((u) => `wd:${u.id}`).join(' ')} }
  ?film p:P179 ?statement .
  ?statement ps:P179 ?universe .
  FILTER NOT EXISTS { ?statement wikibase:rank wikibase:DeprecatedRank }
  ?film wdt:P31 ?type .
  VALUES ?type { ${FILM_TYPES.map((id) => `wd:${id}`).join(' ')} }
  ?film wdt:P4947 ?tmdb .
  OPTIONAL { ?film wdt:P577 ?date . }
  OPTIONAL { ?film rdfs:label ?label . FILTER(LANG(?label) = "en") }
}`
    const url = new URL('https://query.wikidata.org/sparql')
    url.searchParams.set('query', sparql)
    const response = await fetch(url.toString(), {
        headers: {
            'Accept': 'application/sparql-results+json',
            'User-Agent': 'DShyamWatchlist/1.0 (https://dshyam3.github.io)',
        },
    })
    if (!response.ok) throw new Error(`Wikidata returned ${response.status}`)
    const payload = (await response.json()) as { results?: { bindings?: FilmUniverseBinding[] } }

    // One row per date and type, so a film arrives several times: keep its
    // earliest date, and its English label as a fallback title.
    const members = new Map<string, FilmUniverseMember>()
    for (const row of payload.results?.bindings ?? []) {
        const universeId = row.universe?.value?.split('/').pop() ?? ''
        const universeName = names.get(universeId)
        const tmdbId = Number(row.tmdb?.value)
        if (!universeName || !Number.isInteger(tmdbId) || tmdbId <= 0) continue
        const key = `${universeId}:${tmdbId}`
        const member = members.get(key) ?? {
            universeId,
            universeName,
            tmdbId,
            title: null,
            releaseDate: null,
            posterPath: null,
        }
        const date = isoDay(row.date?.value)
        if (date && (!member.releaseDate || date < member.releaseDate)) member.releaseDate = date
        const label = row.label?.value?.trim()
        if (label && !member.title) member.title = label
        members.set(key, member)
    }
    // The registry is never empty, so no rows is a failed query rather than
    // an answer, and must not be cached as one.
    if (members.size === 0) throw new Error('Wikidata returned no universe films')

    const byUniverse = new Map<string, FilmUniverseMember[]>()
    for (const member of members.values()) {
        const films = byUniverse.get(member.universeId) ?? []
        films.push(member)
        byUniverse.set(member.universeId, films)
    }
    const list: FilmUniverseMember[] = []
    for (const [universeId, films] of byUniverse) {
        films.sort((a, b) => (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999'))
        if (films.length > MAX_UNIVERSE_FILMS) {
            console.warn(`film universe ${universeId}: ${films.length} films, keeping the earliest ${MAX_UNIVERSE_FILMS}`)
        }
        list.push(...films.slice(0, MAX_UNIVERSE_FILMS))
    }

    // TMDB's own title, poster and release date. Wikidata's English labels
    // come back missing for some films, and its dates are world premieres
    // where TMDB's are the primary release the library already uses.
    if (TMDB_API_KEY) {
        const ids = [...new Set(list.map((m) => m.tmdbId))]
        const meta = new Map<number, { title: string | null; posterPath: string | null; releaseDate: string | null }>()
        let failed = 0
        for (let start = 0; start < ids.length; start += UNIVERSE_DETAIL_CONCURRENCY) {
            await Promise.all(ids.slice(start, start + UNIVERSE_DETAIL_CONCURRENCY).map(async (id) => {
                const startedAt = Date.now()
                try {
                    const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-GB`)
                    usage.record({ provider: 'tmdb', endpoint: 'movie/:id', statusCode: res.status, durationMs: Date.now() - startedAt })
                    // A 404 is TMDB not having the film: left to the Wikidata label.
                    if (res.status === 404) return
                    if (!res.ok) { failed++; return }
                    const detail = (await res.json()) as {
                        title?: string | null
                        poster_path?: string | null
                        release_date?: string | null
                    }
                    meta.set(id, {
                        title: detail.title?.trim() || null,
                        posterPath: detail.poster_path ?? null,
                        releaseDate: isoDay(detail.release_date),
                    })
                } catch {
                    usage.record({ provider: 'tmdb', endpoint: 'movie/:id', statusCode: null, outcome: 'error', durationMs: Date.now() - startedAt })
                    failed++
                }
            }))
        }
        // Any other failure (a 429, an outage) would leave the card short of
        // films, or untitled, for the day the client keeps it: fail instead.
        if (failed > 0) throw new Error(`TMDB details failed for ${failed} universe films`)
        for (const m of list) {
            const hit = meta.get(m.tmdbId)
            if (!hit) continue
            if (hit.title) m.title = hit.title
            if (hit.posterPath) m.posterPath = hit.posterPath
            if (hit.releaseDate) m.releaseDate = hit.releaseDate
        }
    }

    return list
}

/** As /dev lists it: a Wikidata lookup under its own name, as on success. */
const usageEndpoint = (endpoint: string) =>
    endpoint.startsWith('wikidata/') ? endpoint.slice('wikidata/'.length) : endpoint

function cacheControlFor(endpoint: string): string {
    if (
        endpoint === 'wikidata/tv-spinoffs' ||
        endpoint === 'wikidata/film-universes' ||
        endpoint.startsWith('collection/') ||
        endpoint.startsWith('person/') ||
        endpoint.startsWith('movie/') ||
        /^tv\/\d+\/season\/\d+$/.test(endpoint)
    ) {
        return 'public, max-age=3600, s-maxage=86400'
    }
    return 'public, max-age=900, s-maxage=3600'
}

serve(async (req) => {
    const startedAt = Date.now()
    const corsHeaders = buildCorsHeaders(req)

    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const reqEndpoint = new URL(req.url).searchParams.get('endpoint') || 'unknown'

    if (await isRateLimited(callerKey(req))) {
        void recordApiUsage({
            provider: reqEndpoint.startsWith('wikidata/') ? 'wikidata' : 'tmdb',
            endpoint: usageEndpoint(reqEndpoint),
            statusCode: 429,
            outcome: 'rate_limited',
            durationMs: Date.now() - startedAt,
        })
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(WINDOW_SECONDS),
            },
        })
    }

    try {
        const { searchParams } = new URL(req.url)
        const endpoint = searchParams.get('endpoint')

        if (!endpoint) {
            return new Response(JSON.stringify({ error: 'Endpoint is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (endpoint === 'wikidata/tv-spinoffs') {
            const ids = parseSpinoffSeedIds(searchParams.get('ids'))
            const results = await fetchTvSpinoffs(ids)
            void recordApiUsage({
                provider: 'wikidata',
                endpoint: 'tv-spinoffs',
                statusCode: 200,
                outcome: 'ok',
                durationMs: Date.now() - startedAt,
            })
            return new Response(JSON.stringify({ results }), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': cacheControlFor(endpoint),
                },
            })
        }

        if (endpoint === 'wikidata/film-universes') {
            if (await isRateLimited(`${callerKey(req)}:film-universes`, UNIVERSE_LIMIT, UNIVERSE_WINDOW_SECONDS)) {
                void recordApiUsage({
                    provider: 'wikidata',
                    endpoint: 'film-universes',
                    statusCode: 429,
                    outcome: 'rate_limited',
                    durationMs: Date.now() - startedAt,
                })
                return new Response(JSON.stringify({ error: 'Too many requests' }), {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Retry-After': String(UNIVERSE_WINDOW_SECONDS),
                    },
                })
            }
            const usage = createUsageBatcher()
            try {
                const results = await fetchFilmUniverses(usage)
                void recordApiUsage({
                    provider: 'wikidata',
                    endpoint: 'film-universes',
                    statusCode: 200,
                    outcome: 'ok',
                    durationMs: Date.now() - startedAt,
                })
                return new Response(JSON.stringify({ results }), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Cache-Control': cacheControlFor(endpoint),
                    },
                })
            } finally {
                void usage.flush()
            }
        }

        if (!ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint))) {
            return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Filter out restricted search params and build the TMDB URL
        const tmdbParams = new URLSearchParams()
        searchParams.forEach((value, key) => {
            if (key !== 'endpoint') {
                tmdbParams.append(key, value)
            }
        })
        tmdbParams.append('api_key', TMDB_API_KEY || '')

        const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${tmdbParams.toString()}`)
        const data = await response.json()
        void recordApiUsage({
            provider: 'tmdb',
            endpoint,
            statusCode: response.status,
            durationMs: Date.now() - startedAt,
        })

        // TMDB's own status, not a blanket 200. Its 404 and 429 bodies carry
        // no `id`, and a caller told "OK" reads that as "nothing changed"
        // rather than as a failure it should report.
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                ...(response.ok ? { 'Cache-Control': cacheControlFor(endpoint) } : {}),
            },
        })
    } catch (error) {
        void recordApiUsage({
            provider: reqEndpoint.startsWith('wikidata/') ? 'wikidata' : 'tmdb',
            endpoint: usageEndpoint(reqEndpoint),
            statusCode: 502,
            outcome: 'error',
            durationMs: Date.now() - startedAt,
        })
        // Detail goes to the function log, not to the caller: `error.message`
        // here can carry the upstream URL, which has the TMDB key in it.
        console.error('tmdb-proxy failed:', error)
        return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
