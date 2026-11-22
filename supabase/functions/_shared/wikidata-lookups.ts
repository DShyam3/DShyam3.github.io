/**
 * The two Wikidata lookups behind Discover and Franchises: TV spin-off links
 * for a seed list of TV shows, and the films of the shared universes in the
 * registry below. tmdb-proxy answers them live (`wikidata/tv-spinoffs`,
 * `wikidata/film-universes`); watchlist-cron-sync answers them nightly for
 * the seed list a signed-out visitor sends and stores the answer in
 * `watchlist_wikidata_cache`, which the browser reads before asking the
 * proxy. One copy of the code, so the stored answer is the one the proxy
 * would give for the same seeds.
 *
 * Each function bundles its own copy of this file when it is deployed, so
 * a change here ships to tmdb-proxy and watchlist-cron-sync together.
 * Deployed to the proxy alone, the cron keeps storing the old answer, and
 * browsers read that ahead of the proxy.
 *
 * No Deno global is read here and nothing is imported: a vitest, type-checked
 * by tsc, imports this file to run the cron's half of the cache through the
 * browser's half.
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const WIKIDATA_HEADERS = {
    'Accept': 'application/sparql-results+json',
    'User-Agent': 'DShyamWatchlist/1.0 (https://dshyam3.github.io)',
}

/** The most seeds one spin-off lookup reads; the rest of the list is dropped. */
const MAX_SPINOFF_SEEDS = 400

/** What a lookup needs from its caller. */
export interface WikidataLookupOptions {
    /** TMDB key for posters and dates. Without it a spin-off answer is never complete. */
    tmdbApiKey?: string
    /**
     * Ends every request the lookup makes. The proxy passes none; the cron
     * passes the time its run has left.
     */
    signal?: AbortSignal
}

/** `signal` joined with a per-request timeout, as the proxy has always used alone. */
function within(signal: AbortSignal | undefined, timeoutMs?: number): AbortSignal | undefined {
    const timeout = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs)
    if (!signal) return timeout
    if (!timeout) return signal
    return AbortSignal.any([signal, timeout])
}

// --- TV spin-offs ---------------------------------------------------------

/**
 * The seeds a spin-off lookup reads from the ids it was sent: positive
 * integers, first copy kept, in the order sent, at most 400.
 */
export function spinoffSeedIds(ids: readonly unknown[]): number[] {
    const clean = ids.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    return [...new Set(clean)].slice(0, MAX_SPINOFF_SEEDS)
}

/** The proxy's `ids` query parameter, read as `spinoffSeedIds` reads a list. */
export function parseSpinoffSeedIds(raw: string | null): number[] {
    if (!raw) return []
    return spinoffSeedIds(raw.split(',').map((part) => Number(part.trim())))
}

/** A library TV show as the visitor seed list reads it. */
export interface SeedShow {
    tmdb_id?: number | null
    library_state?: string | null
}

/**
 * The ids a signed-out visitor's browser sends for spin-offs: every TV show
 * not hidden or stopped that has a TMDB id, each once, smallest first. The
 * browser builds the same list in useDiscovery / WatchlistFranchises
 * (`tvSeedIds`) and getTvSpinoffs; a vitest holds the two together.
 */
export function visitorTvSeedIds(shows: readonly SeedShow[]): number[] {
    const ids = new Set<number>()
    for (const show of shows) {
        if (show.library_state === 'hidden' || show.library_state === 'stopped') continue
        const id = show.tmdb_id
        if (typeof id === 'number' && Number.isInteger(id) && id > 0) ids.add(id)
    }
    return [...ids].sort((a, b) => a - b)
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

export interface TvSpinoffLink {
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

export interface TvSpinoffLookup {
    links: TvSpinoffLink[]
    /**
     * A TMDB answer (a 404 counts) for every poster and date looked up, with
     * a key to ask. A link left without its date is dropped from the groups,
     * so the proxy sends an incomplete answer as it always has; the cron does
     * not store one, since every visitor would read it for a day.
     */
    complete: boolean
    /**
     * The best-effort sibling-franchise query: 'failed' on an error or its 8s
     * timeout, which nearly every call has hit since it shipped (the proxy
     * then answers without siblings). Not part of `complete`, so the cron
     * stores the answer visitors already get.
     */
    siblings: 'answered' | 'failed' | 'not asked'
}

export async function fetchTvSpinoffs(seedIds: number[], options: WikidataLookupOptions = {}): Promise<TvSpinoffLookup> {
    const { tmdbApiKey, signal } = options
    if (seedIds.length === 0) return { links: [], complete: true, siblings: 'not asked' }
    let complete = true
    let siblings: TvSpinoffLookup['siblings'] = 'not asked'
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
        headers: WIKIDATA_HEADERS,
        signal: within(signal),
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

    // Best-effort second pass: for franchises discovered via P2512 spin-offs,
    // pull sibling TV series sharing the same Wikidata franchise (P8345 / P179)
    // so shared TV universes like the MCU include non-spinoff sibling shows too.
    const franchiseSeeds = new Map<string, { seedTmdbId: number; seedTitle: string; franchiseName: string | null }>()
    for (const l of links) {
        if (l.franchiseId && /^Q\d+$/.test(l.franchiseId) && !franchiseSeeds.has(l.franchiseId)) {
            franchiseSeeds.set(l.franchiseId, {
                seedTmdbId: l.seedTmdbId,
                seedTitle: l.seedTitle,
                franchiseName: l.franchiseName,
            })
        }
    }
    if (franchiseSeeds.size > 0) {
        const franchiseValues = [...franchiseSeeds.keys()].slice(0, 15).map((id) => `wd:${id}`).join(' ')
        const siblingSparql = `SELECT DISTINCT ?franchise ?relatedLabel ?relatedTvTmdb ?relDate WHERE {
  VALUES ?franchise { ${franchiseValues} }
  { ?related wdt:P8345 ?franchise . }
  UNION {
    ?related p:P179 ?stmt .
    ?stmt ps:P179 ?franchise .
    FILTER NOT EXISTS { ?stmt wikibase:rank wikibase:DeprecatedRank }
  }
  ?related wdt:P4983 ?relatedTvTmdb .
  OPTIONAL { ?related wdt:P580 ?startTime . }
  OPTIONAL { ?related wdt:P577 ?pubDate . }
  BIND(COALESCE(?startTime, ?pubDate) AS ?relDate)
  ?related rdfs:label ?relatedLabel . FILTER(LANG(?relatedLabel) = "en")
}`
        try {
            const sibUrl = new URL('https://query.wikidata.org/sparql')
            sibUrl.searchParams.set('query', siblingSparql)
            const sibRes = await fetch(sibUrl.toString(), {
                headers: WIKIDATA_HEADERS,
                signal: within(signal, 8000),
            })
            siblings = sibRes.ok ? 'answered' : 'failed'
            if (sibRes.ok) {
                const sibPayload = (await sibRes.json()) as {
                    results?: {
                        bindings?: {
                            franchise?: { value?: string }
                            relatedLabel?: { value?: string }
                            relatedTvTmdb?: { value?: string }
                            relDate?: { value?: string }
                        }[]
                    }
                }
                for (const row of sibPayload.results?.bindings ?? []) {
                    const fId = row.franchise?.value?.split('/').pop()?.trim() || ''
                    const anchor = franchiseSeeds.get(fId)
                    const relatedTmdbId = row.relatedTvTmdb?.value ? Number(row.relatedTvTmdb.value) : null
                    const relatedTitle = row.relatedLabel?.value?.trim()
                    if (
                        !anchor ||
                        !relatedTitle ||
                        !relatedTmdbId ||
                        !Number.isInteger(relatedTmdbId) ||
                        relatedTmdbId <= 0 ||
                        relatedTmdbId === anchor.seedTmdbId
                    ) continue
                    const key = `${anchor.seedTmdbId}->tv:${relatedTmdbId}`
                    if (seen.has(key)) continue
                    seen.add(key)
                    const rawDate = row.relDate?.value?.slice(0, 10) ?? null
                    links.push({
                        seedTmdbId: anchor.seedTmdbId,
                        seedTitle: anchor.seedTitle,
                        franchiseId: fId,
                        franchiseName: anchor.franchiseName,
                        relatedMediaType: 'tv',
                        relatedTmdbId,
                        relatedTitle,
                        releaseDate: rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null,
                        posterPath: null,
                    })
                }
            }
        } catch (err) {
            siblings = 'failed'
            console.warn('Wikidata sibling TV franchise lookup failed (non-fatal):', err)
        }
    }

    // Enrich unique related targets with TMDB poster_path and release_date using
    // a bounded worker pool (concurrency 10) so not-in-library spin-offs render
    // posters without bursting TMDB or requiring extra browser requests.
    if (!tmdbApiKey && links.length > 0) complete = false
    if (tmdbApiKey && links.length > 0) {
        const targets = new Map<string, { media: 'tv' | 'movie'; id: number }>()
        for (const l of links) {
            const k = `${l.relatedMediaType}:${l.relatedTmdbId}`
            if (!targets.has(k)) targets.set(k, { media: l.relatedMediaType, id: l.relatedTmdbId })
        }
        const meta = new Map<string, { posterPath: string | null; releaseDate: string | null }>()
        const queue = [...targets.entries()].slice(0, 60)
        let cursor = 0
        await Promise.all(
            Array.from({ length: Math.min(10, queue.length) }, async () => {
                while (cursor < queue.length) {
                    const [k, t] = queue[cursor++]
                    try {
                        const res = await fetch(`${TMDB_BASE_URL}/${t.media}/${t.id}?api_key=${tmdbApiKey}&language=en-GB`, {
                            signal: within(signal, 10000),
                        })
                        if (!res.ok) {
                            // A 404 is TMDB not having the title, the same answer every time.
                            if (res.status !== 404) complete = false
                            continue
                        }
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
                    } catch {
                        // Ignore per-target timeout/network errors so the batch succeeds.
                        complete = false
                    }
                }
            }),
        )
        for (const l of links) {
            const hit = meta.get(`${l.relatedMediaType}:${l.relatedTmdbId}`)
            if (!hit) continue
            if (hit.posterPath) l.posterPath = hit.posterPath
            if (!l.releaseDate && hit.releaseDate) l.releaseDate = hit.releaseDate
        }
    }

    return { links, complete, siblings }
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

interface FilmUniverseBinding {
    universe?: { value?: string }
    tmdb?: { value?: string }
    label?: { value?: string }
    date?: { value?: string }
}

export interface FilmUniverseMember {
    universeId: string
    universeName: string
    tmdbId: number
    title: string | null
    releaseDate: string | null
    posterPath: string | null
}

/**
 * Where a lookup reports each TMDB call: `createUsageBatcher` in
 * _shared/api-usage.ts, whose event this is a part of.
 */
export interface UsageRecorder {
    record(event: {
        provider: string
        endpoint: string
        statusCode?: number | null
        outcome?: 'ok' | 'rate_limited' | 'error'
        durationMs?: number | null
    }): void
}

const isoDay = (raw: string | null | undefined): string | null => {
    const day = raw?.slice(0, 10) ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/**
 * Every universe film, or thrown: no answer is returned that is short of
 * films or titles, so whatever this returns is complete when a TMDB key was
 * given.
 */
export async function fetchFilmUniverses(usage: UsageRecorder, options: WikidataLookupOptions = {}): Promise<FilmUniverseMember[]> {
    const { tmdbApiKey, signal } = options
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
        headers: WIKIDATA_HEADERS,
        signal: within(signal),
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
    if (tmdbApiKey) {
        const ids = [...new Set(list.map((m) => m.tmdbId))]
        const meta = new Map<number, { title: string | null; posterPath: string | null; releaseDate: string | null }>()
        let failed = 0
        for (let start = 0; start < ids.length; start += UNIVERSE_DETAIL_CONCURRENCY) {
            await Promise.all(ids.slice(start, start + UNIVERSE_DETAIL_CONCURRENCY).map(async (id) => {
                const startedAt = Date.now()
                try {
                    const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${tmdbApiKey}&language=en-GB`, {
                        signal: within(signal),
                    })
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

// --- The nightly cache ----------------------------------------------------

export type WikidataCacheLookup = 'tv-spinoffs' | 'film-universes'

/** One row of `watchlist_wikidata_cache`. */
export interface WikidataCacheRow {
    lookup: WikidataCacheLookup
    /** The ids the browser sends, whole: the lookup itself reads the first 400. */
    seed_ids: number[]
    results: TvSpinoffLink[] | FilmUniverseMember[]
    synced_at: string
}

/** The spin-off answer for a visitor's seed list, as its cache row. */
export function tvSpinoffCacheRow(seedIds: number[], links: TvSpinoffLink[], syncedAt: string): WikidataCacheRow {
    return { lookup: 'tv-spinoffs', seed_ids: [...seedIds], results: links, synced_at: syncedAt }
}

/** The universe answer, as its cache row. It takes no seeds. */
export function filmUniverseCacheRow(members: FilmUniverseMember[], syncedAt: string): WikidataCacheRow {
    return { lookup: 'film-universes', seed_ids: [], results: members, synced_at: syncedAt }
}
