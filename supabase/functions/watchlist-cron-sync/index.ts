import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { isServiceRoleRequest } from '../_shared/service-role.ts'
import { claimCooldown, cooldownResponse, releaseCooldown } from '../_shared/cooldown.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'
import { selectAllPages } from '../_shared/select-all-pages.ts'
import { ratedEpisodes, seasonsToKeep, UNWATCHED_ONLY } from '../_shared/owner-data.ts'
import { createUsageBatcher } from '../_shared/api-usage.ts'
import { collectionPartRows, type CollectionPartRow } from '../_shared/collection-parts.ts'
import {
  fetchFilmUniverses,
  fetchTvSpinoffs,
  filmUniverseCacheRow,
  spinoffSeedIds,
  tvSpinoffCacheRow,
  visitorTvSeedIds,
  type WikidataCacheRow,
} from '../_shared/wikidata-lookups.ts'

let activeUsage = createUsageBatcher('cron')

// The one watchlist sync. pg_cron calls it nightly with the service role key,
// in parts a few minutes apart (see parseShard and the scheduling
// migrations); the Watchlist page's Sync buttons call it with the admin's own
// session, for the whole library or one title.
//
// The browser used to run its own copy of this loop through tmdb-proxy. That
// proxy allows 60 requests a minute per IP and a full sync makes well over a
// thousand, so a manual sync failed most of the library by construction. Run
// here, the calls go straight to TMDB and the library finishes in about a
// minute.

/** Gap enforced between two manual full syncs. The nightly cron is exempt. */
const FULL_SYNC_COOLDOWN_SECONDS = 10 * 60
const FULL_SYNC_COOLDOWN_KEY = 'watchlist-sync:full'
/**
 * A single-title resync costs one call plus one per recent season. The cap
 * is generous for clicking through titles and stops a loop of them.
 */
const ITEM_RESYNC_LIMIT = 20
const ITEM_RESYNC_WINDOW_SECONDS = 60

/**
 * Which one title to resync, null for the whole library, or 'invalid' for a
 * body that names a title badly. Only a body naming nothing is a full sync:
 * a typo must not quietly become the most expensive request there is.
 */
function parseItemTarget(body: unknown): { category: 'Movies' | 'TV Shows'; id: number } | null | 'invalid' {
  if (!body || typeof body !== 'object') return null
  const { category, id } = body as { category?: unknown; id?: unknown }
  if (category === undefined && id === undefined) return null
  const numericId = typeof id === 'string' ? Number(id) : id
  if ((category !== 'Movies' && category !== 'TV Shows') || !Number.isSafeInteger(numericId)) return 'invalid'
  return { category, id: numericId as number }
}

/** Every key a request body may carry; see the body check in the handler. */
const KNOWN_BODY_KEYS = new Set(['category', 'id', 'shard', 'shards'])

/**
 * Which part of the library a scheduled run covers, null for all of it, or
 * 'invalid'. pg_cron splits the nightly run into parts a few minutes apart:
 * the whole library in one request used up to the platform's 2s CPU budget,
 * and a request killed for CPU dies without writing its sync_log row. A part
 * takes every title whose id is congruent to `shard` modulo `shards`.
 */
function parseShard(body: unknown): { index: number; count: number } | null | 'invalid' {
  if (!body || typeof body !== 'object') return null
  const { shard, shards } = body as { shard?: unknown; shards?: unknown }
  if (shard === undefined && shards === undefined) return null
  if (
    !Number.isSafeInteger(shard) || !Number.isSafeInteger(shards) ||
    (shards as number) < 1 || (shards as number) > 10 ||
    (shard as number) < 0 || (shard as number) >= (shards as number)
  ) return 'invalid'
  return { index: shard as number, count: shards as number }
}

// Mirror of src/features/watchlist/tmdb-types.ts. Deno cannot import from
// src/, so these are hand-maintained copies -- change both together.
interface TMDBProvider {
  provider_name?: string
}
interface TMDBRegionProviders {
  flatrate?: TMDBProvider[]
  free?: TMDBProvider[]
  ads?: TMDBProvider[]
}
interface TMDBSeasonSummary {
  season_number: number
  episode_count?: number
  air_date?: string | null
}
interface TMDBEpisode {
  episode_number: number
  name?: string
  air_date?: string | null
  runtime?: number | null
}
interface TMDBVideo {
  key?: string
  site?: string
  type?: string
  official?: boolean
  iso_639_1?: string | null
  published_at?: string
}
interface TMDBVideos {
  results?: TMDBVideo[]
}
interface TMDBSeasonDetails {
  episodes?: TMDBEpisode[]
  videos?: TMDBVideos
}
interface TMDBCastMember {
  name?: string
  order?: number
  total_episode_count?: number
}
interface TMDBCrewMember {
  name?: string
  job?: string
}
interface TMDBCredits {
  cast?: TMDBCastMember[]
  crew?: TMDBCrewMember[]
}
interface TMDBDetails {
  id?: number
  original_language?: string
  origin_country?: string[]
  production_countries?: { iso_3166_1: string }[]
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string | null
  first_air_date?: string | null
  runtime?: number | null
  episode_run_time?: number[]
  genres?: { id?: number; name: string }[]
  status?: string
  seasons?: TMDBSeasonSummary[]
  'watch/providers'?: { results?: Record<string, TMDBRegionProviders | undefined> }
  videos?: TMDBVideos
  credits?: TMDBCredits
  aggregate_credits?: TMDBCredits
  created_by?: { name?: string }[]
  imdb_id?: string | null
  external_ids?: { imdb_id?: string | null }
  belongs_to_collection?: { id?: number; name?: string } | null
  vote_average?: number
  vote_count?: number
}

/**
 * Trailers come from TMDB's `videos`, English and language-less ones only. A
 * title with only, say, a Japanese trailer gets none: the embed is for
 * watching, and an untranslated trailer is a worse result than a blank.
 * Mirror of TRAILER_VIDEO_PARAMS in src/features/watchlist/trailer.ts.
 */
const VIDEO_PARAMS = { include_video_language: 'en,null' }
/**
 * A settled season is never re-read, so one never asked for its videos is
 * asked once through `season/{n}/videos` -- a few hundred bytes, not the
 * episode payload. Queued during the sync and drained after it (see the end
 * of the handler), at most this many per run, this many at a time: a pool
 * keeps the backfill out of the sync's parallel burst and under TMDB's rate
 * limit. Shard and single-title runs only; a whole-library manual run is
 * already near the CPU budget (see parseShard). A nightly shard holds ~240
 * seasons, so the whole library fills on the first night; anything the time
 * ceiling cuts off stays unchecked for the next.
 */
const MAX_TRAILER_BACKFILL_PER_RUN = 300
const TRAILER_BACKFILL_CONCURRENCY = 8

/**
 * Credits (director or creators, and the top cast) are appended to the detail
 * call a title already makes, but the block is large -- a film's whole crew, a
 * long-running show's aggregate_credits -- and parsing it is CPU the function
 * is short of. So it is asked for once per title (`top_cast` still null), at
 * most this many per run, on shard runs only, and again whenever the admin
 * resyncs that one title. Three nightly shards fill the library in about three
 * nights. An empty cast is stored as [] rather than null, so titles with no
 * cast are not asked again every run and do not use up this allowance.
 */
const MAX_CREDITS_BACKFILL_PER_RUN = 150

/**
 * The least run time the Wikidata pass starts with. The spin-off lookup took
 * ~17s when the browser asked for it; the universes run beside it. With less
 * left the pass is skipped: a row for tonight's seed list stands, any other
 * spin-off row is deleted.
 */
const WIKIDATA_PASS_MIN_MS = 30_000

/**
 * IMDb, Rotten Tomatoes and Metacritic scores come from OMDb after the TMDB
 * pass, for titles whose scores were never read or are over a week old. OMDb's
 * free tier allows 1,000 requests a day; three nightly shards of at most this
 * many stay under it. A one-title resync always asks for its target.
 */
const OMDB_MAX_PER_RUN = 300
const OMDB_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const OMDB_REQUEST_GAP_MS = 100
const OMDB_MAX_CONSECUTIVE_ERRORS = 5

/** A TMDB episode that survived the "has an air date" filter. */
type AiredEpisode = TMDBEpisode & { air_date: string }
const hasAirDate = (v: TMDBEpisode): v is AiredEpisode => Boolean(v.air_date)

// The rows this function selects. The Deno client is untyped (there are no
// generated Database types to import here), so the shapes are spelled out.
interface MovieRow {
  id: number
  title: string
  tmdb_id: number | null
  poster: string | null
  backdrop: string | null
  overview: string | null
  genre: string | null
  genre_ids?: number[] | null
  original_language?: string | null
  origin_country?: string[] | null
  release_year: number | null
  release_date: string | null
  platform: string | null
  trailer_key: string | null
  runtime: number | null
  collection_id: number | null
  collection_name: string | null
  library_state: string | null
  top_cast: string[] | null
  imdb_id: string | null
  tmdb_rating: number | null
  tmdb_votes: number | null
  scores_checked_at: string | null
}
interface EpisodeRow {
  id: number
  episode_number: number
  title: string | null
  runtime: number | null
  release_date: string | null
  watched: boolean | null
}
interface SeasonRow {
  id: number
  season_number: number
  release_date: string | null
  trailer_key: string | null
  trailer_checked_at: string | null
  tv_show_episodes: EpisodeRow[] | null
}
interface ShowRow {
  id: number
  title: string
  tmdb_id: number | null
  poster: string | null
  backdrop: string | null
  overview: string | null
  genre: string | null
  genre_ids?: number[] | null
  original_language?: string | null
  origin_country?: string[] | null
  status: string | null
  release_date: string | null
  platform: string | null
  trailer_key: string | null
  library_state: string | null
  top_cast: string[] | null
  imdb_id: string | null
  tmdb_rating: number | null
  tmdb_votes: number | null
  scores_checked_at: string | null
  tv_show_seasons: SeasonRow[] | null
}

/** One season of an item as this function holds it in memory. */
interface SyncSeason {
  id: number
  season_number: number
  release_date?: string
  trailer_key?: string
  /** When TMDB was last asked for this season's videos; unset means never. */
  trailer_checked_at?: string
  episodes: {
    id: number
    episode_number: number
    title: string | null
    runtime: number | null
    release_date: string | null
    watched: boolean | null
  }[]
}

/** A movie or show being synced. `seasons` is TV-only. */
interface SyncItem {
  id: string
  title: string
  category: 'Movies' | 'TV Shows'
  tmdb_id?: number
  library_state?: string | null
  image_url?: string
  backdrop?: string
  description?: string
  genres: string[]
  genre_ids?: number[] | null
  original_language?: string | null
  origin_country?: string[] | null
  year?: number
  release_date?: string | null
  platform?: string | null
  trailer_key?: string | null
  runtime?: number | null
  collection_id?: number | null
  collection_name?: string | null
  series_status?: string | null
  /** True once `top_cast` is stored; false asks TMDB for credits. */
  has_credits: boolean
  /** Stored IMDb id; the OMDb pass only asks for titles that have one. */
  imdb_id?: string
  tmdb_rating?: number | null
  tmdb_votes?: number | null
  /** When OMDb was last asked; unset means never. */
  scores_checked_at?: string
  seasons?: SyncSeason[]
}

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

function buildCorsHeaders(req: Request) {
  return {
    ...corsOriginHeader(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

/**
 * One TMDB call. Null means TMDB has no such title or season any more -- a
 * fact about the title, not a failure of the run, so it is skipped as it
 * always was rather than failing every night forever. A 429 waits out its
 * Retry-After once. Anything else throws, and fails the title.
 */
async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const query = new URLSearchParams({ ...params, api_key: TMDB_API_KEY || '' })
  const url = `${TMDB_BASE_URL}/${endpoint}?${query.toString()}`
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now()
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    activeUsage.record({
      provider: 'tmdb',
      endpoint,
      statusCode: res.status,
      durationMs: Date.now() - t0,
    })
    if (res.ok) return res.json() as Promise<T>
    await res.body?.cancel()
    if (res.status === 404) {
      console.warn(`TMDB has no ${endpoint}; skipped`)
      return null
    }
    if (res.status === 429 && attempt === 0) {
      const waitSeconds = Math.min(Number(res.headers.get('Retry-After')) || 1, 10)
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
      continue
    }
    throw new Error(`TMDB ${res.status} for ${endpoint}`)
  }
}

/**
 * Throws a query's error. Writes, and the reads a delete depends on, go
 * through this, so a failure fails its title instead of the title counting
 * as synced. Best-effort writes (season trailers) deliberately do not.
 */
function check<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error
  return result
}

// Mirror of src/features/watchlist/sync-logic.ts. Deno cannot import from
// src/, so this is a hand-maintained copy -- change both together.
function getPlatform(providers: TMDBRegionProviders | undefined): string {
  if (!providers) return 'Online'
  const available = [
    ...(providers.flatrate || []),
    ...(providers.free || []),
    ...(providers.ads || []),
  ]
  const allowed = [
    { tmdbNames: ['Netflix'], displayName: 'Netflix' },
    { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
    { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
    { tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], displayName: 'Apple TV+' },
    { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
    { tmdbNames: ['ITVX'], displayName: 'ITVX' },
    { tmdbNames: ['NOW', 'Now TV', 'Sky Go'], displayName: 'NOW' },
    { tmdbNames: ['Paramount Plus', 'Paramount+', 'Paramount Plus Apple TV Channel', 'Paramount+ Amazon Channel'], displayName: 'Paramount+' },
    { tmdbNames: ['Channel 4', 'All 4'], displayName: 'Channel 4' },
    { tmdbNames: ['Crunchyroll', 'Crunchyroll Amazon Channel'], displayName: 'Crunchyroll' },
  ]
  for (const a of allowed) {
    if (available.some((p) => a.tmdbNames.some((name) => p.provider_name?.toLowerCase() === name.toLowerCase()))) {
      return a.displayName
    }
  }
  return 'Online'
}

// Mirror of src/features/watchlist/trailer.ts. Deno cannot import from src/,
// so this is a hand-maintained copy -- change both together.
const YOUTUBE_KEY = /^[A-Za-z0-9_-]{6,20}$/
const TRAILER_TYPE_RANK: Record<string, number> = { Trailer: 2, Teaser: 1 }
function pickTrailerKey(videos: TMDBVideo[] | undefined | null): string | null {
  let best: TMDBVideo | null = null
  let bestScore: number[] = []
  for (const video of videos ?? []) {
    if (video.site !== 'YouTube' || typeof video.key !== 'string' || !YOUTUBE_KEY.test(video.key)) continue
    const typeRank = TRAILER_TYPE_RANK[video.type ?? '']
    if (!typeRank) continue
    const published = Date.parse(video.published_at ?? '')
    const score = [
      typeRank,
      video.official ? 1 : 0,
      video.iso_639_1 === 'en' ? 1 : 0,
      Number.isNaN(published) ? 0 : published,
    ]
    const better = !best || (() => {
      for (let i = 0; i < score.length; i++) {
        if (score[i] !== bestScore[i]) return score[i] > bestScore[i]
      }
      return false
    })()
    if (better) {
      best = video
      bestScore = score
    }
  }
  return best?.key ?? null
}

// Mirror of src/features/watchlist/tmdb-score.ts. Deno cannot import from
// src/, so this is a hand-maintained copy -- change both together.
//
function pickCollection(
  data: { belongs_to_collection?: { id?: number; name?: string } | null },
): { collection_id: number | null; collection_name: string | null } | undefined {
  if (!('belongs_to_collection' in data)) return undefined
  const c = data.belongs_to_collection
  if (!c || typeof c.id !== 'number' || c.id <= 0) return { collection_id: null, collection_name: null }
  return { collection_id: c.id, collection_name: c.name?.trim() || null }
}

// Mirror of src/features/watchlist/omdb-scores.ts -- change both together.
// Deno cannot import from src/, so this is a hand-maintained copy.
interface OmdbScores {
  imdb_rating: number | null
  imdb_votes: number | null
  rt_score: number | null
  metascore: number | null
}
type OmdbOutcome =
  | { kind: 'scores'; scores: OmdbScores }
  | { kind: 'not-found' }
  | { kind: 'limit' }
  | { kind: 'error'; message: string }

const IMDB_ID = /^tt\d{7,10}$/
const OMDB_DECIMAL = /^\d+(\.\d+)?$/
const OMDB_INTEGER = /^\d+$/
function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && IMDB_ID.test(value)
}
function omdbText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}
function omdbDecimal(text: string | null): number | null {
  if (text === null || !OMDB_DECIMAL.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
function omdbPercent(text: string | null): number | null {
  const n = omdbDecimal(text)
  if (n === null || n > 100) return null
  return Math.round(n)
}
function omdbRatingValue(ratings: unknown, source: string): string | null {
  if (!Array.isArray(ratings)) return null
  for (const entry of ratings) {
    if (entry && typeof entry === 'object' && (entry as { Source?: unknown }).Source === source) {
      return omdbText((entry as { Value?: unknown }).Value)
    }
  }
  return null
}
function omdbImdbRating(text: string | null): number | null {
  const n = omdbDecimal(text)
  if (n === null) return null
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10
}
function omdbVotes(text: string | null): number | null {
  if (text === null) return null
  const digits = text.replace(/,/g, '')
  if (!OMDB_INTEGER.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}
function parseOmdbResponse(json: unknown): OmdbOutcome {
  if (!json || typeof json !== 'object') return { kind: 'error', message: 'OMDb returned no JSON object' }
  const data = json as Record<string, unknown>
  if (data.Response === 'False') {
    const message = omdbText(data.Error) || 'OMDb returned an error'
    const lower = message.toLowerCase()
    if (lower.includes('limit')) return { kind: 'limit' }
    if (lower.includes('not found') || lower.includes('incorrect imdb id')) return { kind: 'not-found' }
    return { kind: 'error', message }
  }
  if (data.Response !== 'True') return { kind: 'error', message: 'OMDb response had no Response flag' }
  const imdbText = omdbText(data.imdbRating)
  const imdbFromRatings = omdbRatingValue(data.Ratings, 'Internet Movie Database')?.split('/')[0] ?? null
  const metacriticFromRatings = omdbRatingValue(data.Ratings, 'Metacritic')?.split('/')[0] ?? null
  const rtText = omdbRatingValue(data.Ratings, 'Rotten Tomatoes')
  return {
    kind: 'scores',
    scores: {
      imdb_rating: omdbImdbRating(imdbText) ?? omdbImdbRating(imdbFromRatings),
      imdb_votes: omdbVotes(omdbText(data.imdbVotes)),
      rt_score: rtText?.endsWith('%') ? omdbPercent(rtText.slice(0, -1)) : null,
      metascore: omdbPercent(omdbText(data.Metascore)) ?? omdbPercent(metacriticFromRatings),
    },
  }
}

// Mirror of src/features/watchlist/credits.ts. Deno cannot import from src/,
// so this is a hand-maintained copy -- change both together.
const TOP_CAST_SIZE = 3
function uniqueNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  for (const raw of names) {
    const name = raw?.trim()
    if (name) seen.add(name)
  }
  return [...seen]
}
function pickDirectors(crew: TMDBCrewMember[] | undefined | null): string[] {
  return uniqueNames((crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name))
}
function pickCreators(createdBy: { name?: string }[] | undefined | null): string[] {
  return uniqueNames((createdBy ?? []).map((c) => c.name))
}
function pickTopCast(cast: TMDBCastMember[] | undefined | null): string[] {
  const ranked = (cast ?? [])
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.name?.trim())
    .sort((a, b) => {
      const episodes = (b.member.total_episode_count ?? 0) - (a.member.total_episode_count ?? 0)
      if (episodes) return episodes
      const order = (a.member.order ?? Infinity) - (b.member.order ?? Infinity)
      return order || a.index - b.index
    })
  return uniqueNames(ranked.map(({ member }) => member.name)).slice(0, TOP_CAST_SIZE)
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // This function writes to admin-only tables and spends TMDB calls, so it
  // must not be publicly callable. pg_cron authenticates with the service
  // role key; the Sync buttons with an admin session. Reject anything else.
  const authHeader = req.headers.get('Authorization') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const isServiceRole = isServiceRoleRequest(authHeader, serviceRoleKey)
  activeUsage = createUsageBatcher(isServiceRole ? 'cron' : 'edge')
  if (!isServiceRole) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  // No body at all is a whole-library run. A body that does not parse to an
  // object, or names a key nothing reads, is malformed rather than read as
  // one: a misspelt part in a cron body would otherwise run the whole library
  // nightly -- the run that outgrew the CPU limit -- and log it as complete.
  const rawBody = await req.text()
  let body: unknown = {}
  let bodyMalformed = false
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      bodyMalformed = true
    }
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) bodyMalformed = true
  else if (Object.keys(body).some((key) => !KNOWN_BODY_KEYS.has(key))) bodyMalformed = true
  const target = parseItemTarget(body)
  const shard = parseShard(body)
  // A part of the library and a single title are different requests; a body
  // naming both is malformed rather than one or the other.
  if (bodyMalformed || target === 'invalid' || shard === 'invalid' || (target && shard)) {
    return new Response(JSON.stringify({ error: 'Invalid sync target' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const syncType = isServiceRole ? 'auto' : 'manual'
  const runLabel = shard ? `${syncType} ${shard.index + 1}/${shard.count}` : syncType
  const holdsCooldown = !isServiceRole && !target

  // The schedule is trusted; a person pressing a button is rate-limited here
  // rather than by the button, which only stops a double click.
  if (!isServiceRole && target) {
    const { data: overLimit, error: limitError } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: 'watchlist-sync:item',
      p_limit: ITEM_RESYNC_LIMIT,
      p_window_seconds: ITEM_RESYNC_WINDOW_SECONDS,
    })
    if (limitError) console.error('item resync limit check failed, allowing request:', limitError.message)
    if (overLimit === true) {
      return new Response(JSON.stringify({ error: 'Too many resyncs. Try again in a minute.', retry_after: ITEM_RESYNC_WINDOW_SECONDS }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(ITEM_RESYNC_WINDOW_SECONDS) },
      })
    }
  } else if (holdsCooldown) {
    const wait = await claimCooldown(supabaseAdmin, FULL_SYNC_COOLDOWN_KEY, FULL_SYNC_COOLDOWN_SECONDS)
    if (wait > 0) return cooldownResponse(wait, 'A full sync', corsHeaders)
  }

  const startTime = Date.now()
  let itemsSynced = 0
  // Set once the first TMDB call can have gone out; see the catch at the end.
  let loopStarted = false
  const failedTitles: string[] = []
  // What changed, for the Sync button's toast: status moves and new episodes.
  const changes: string[] = []

  try {
    // --- Fetch current state ---
    // Names exactly the columns read below. `overview` stays in the lists,
    // unlike WatchlistContext's fetchData, which drops it to keep the browser
    // payload small: here there is no payload to save, and having the real
    // overview in hand is what makes the `!item.description` check below
    // correct.
    // A whole-library read pages through the table: one plain select stops at
    // the Data API's 1,000-row max_rows without saying so, and the rest of the
    // library would go unsynced under a green log row. Paging is on the
    // top-level rows; seasons and episodes stay embedded. A single-title
    // resync reads only that title's row and skips the other table outright.
    const MOVIE_COLUMNS = 'id, title, tmdb_id, poster, backdrop, overview, genre, genre_ids, original_language, origin_country, release_year, release_date, platform, trailer_key, runtime, collection_id, collection_name, library_state, top_cast, imdb_id, tmdb_rating, tmdb_votes, scores_checked_at'
    const SHOW_COLUMNS = 'id, title, tmdb_id, poster, backdrop, overview, genre, genre_ids, original_language, origin_country, status, release_date, platform, trailer_key, library_state, top_cast, imdb_id, tmdb_rating, tmdb_votes, scores_checked_at, tv_show_seasons (id, season_number, release_date, trailer_key, trailer_checked_at, tv_show_episodes (id, episode_number, title, runtime, release_date, watched))'
    const none = { data: [], error: null }
    const [moviesResult, showsResult] = await Promise.all([
      !target
        ? selectAllPages<MovieRow>(
          (from, to) => supabaseAdmin.from('movies').select(MOVIE_COLUMNS, { count: 'exact' }).order('id').range(from, to),
          (row) => String(row.id),
        )
        : target.category === 'Movies'
          ? supabaseAdmin.from('movies').select(MOVIE_COLUMNS).eq('id', target.id)
          : none,
      !target
        ? selectAllPages<ShowRow>(
          (from, to) => supabaseAdmin.from('tv_shows').select(SHOW_COLUMNS, { count: 'exact' }).order('id').range(from, to),
          (row) => String(row.id),
        )
        : target.category === 'TV Shows'
          ? supabaseAdmin.from('tv_shows').select(SHOW_COLUMNS).eq('id', target.id)
          : none,
    ])
    // Read errors are plain objects; as an Error their message reaches sync_log.
    if (moviesResult.error) throw new Error(moviesResult.error.message)
    if (showsResult.error) throw new Error(showsResult.error.message)

    const movies: SyncItem[] = ((moviesResult.data || []) as MovieRow[]).map((m) => ({
      id: String(m.id),
      title: m.title,
      category: 'Movies' as const,
      tmdb_id: m.tmdb_id || undefined,
      library_state: m.library_state,
      image_url: m.poster || undefined,
      backdrop: m.backdrop || undefined,
      description: m.overview || undefined,
      genres: m.genre ? m.genre.split(',').map((g: string) => g.trim()) : [],
      genre_ids: m.genre_ids ?? null,
      original_language: m.original_language ?? null,
      origin_country: m.origin_country ?? null,
      year: m.release_year || undefined,
      release_date: m.release_date ?? null,
      platform: m.platform ?? null,
      trailer_key: m.trailer_key ?? null,
      runtime: m.runtime ?? null,
      collection_id: m.collection_id ?? null,
      collection_name: m.collection_name ?? null,
      has_credits: m.top_cast !== null,
      imdb_id: isImdbId(m.imdb_id) ? m.imdb_id : undefined,
      tmdb_rating: m.tmdb_rating ?? null,
      tmdb_votes: m.tmdb_votes ?? null,
      scores_checked_at: m.scores_checked_at || undefined,
    }))

    const shows: SyncItem[] = ((showsResult.data || []) as ShowRow[]).map((s) => ({
      id: String(s.id),
      title: s.title,
      category: 'TV Shows' as const,
      tmdb_id: s.tmdb_id || undefined,
      library_state: s.library_state,
      image_url: s.poster || undefined,
      backdrop: s.backdrop || undefined,
      description: s.overview || undefined,
      genres: s.genre ? s.genre.split(',').map((g: string) => g.trim()) : [],
      genre_ids: s.genre_ids ?? null,
      original_language: s.original_language ?? null,
      origin_country: s.origin_country ?? null,
      release_date: s.release_date ?? null,
      platform: s.platform ?? null,
      trailer_key: s.trailer_key ?? null,
      series_status: s.status,
      has_credits: s.top_cast !== null,
      imdb_id: isImdbId(s.imdb_id) ? s.imdb_id : undefined,
      tmdb_rating: s.tmdb_rating ?? null,
      tmdb_votes: s.tmdb_votes ?? null,
      scores_checked_at: s.scores_checked_at || undefined,
      seasons: (s.tv_show_seasons || []).map((season) => ({
        id: season.id,
        season_number: season.season_number,
        release_date: season.release_date || undefined,
        trailer_key: season.trailer_key || undefined,
        trailer_checked_at: season.trailer_checked_at || undefined,
        episodes: (season.tv_show_episodes || []).map((ep) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          title: ep.title,
          runtime: ep.runtime,
          release_date: ep.release_date,
          watched: ep.watched,
        })),
      })),
    }))

    // showId-sSeason-eEpisode -> watched, from the start of the run. A
    // pre-filter only: a season already watched here is never queued for
    // deletion, which spares it the read before the delete. The guard that
    // counts is that read (seasonsToKeep), since the owner can watch or rate
    // mid-run.
    const watchedEpisodes = new Set<string>()
    shows.forEach((show) => {
      show.seasons?.forEach((season) => {
        season.episodes.forEach((ep) => {
          if (ep.watched) watchedEpisodes.add(`${show.id}-s${season.season_number}-e${ep.episode_number}`)
        })
      })
    })

    const isActiveInNightly = (item: SyncItem) =>
      Boolean(target) || (item.library_state !== 'hidden' && item.library_state !== 'stopped')

    const itemsToSync = [...movies, ...shows].filter(
      (item) => item.tmdb_id && isActiveInNightly(item) && (!shard || Number(item.id) % shard.count === shard.index),
    )

    // Parallel within a chunk. The ceiling is checked between chunks, and a
    // chunk can take up to ~30s when calls time out, so it sits 50s under the
    // platform's 150s request limit rather than at it: a run cut off by the
    // gateway would never write its sync_log row or answer the button.
    const chunkSize = 50
    const MAX_EXECUTION_TIME_MS = 100_000
    let hitCeiling = false
    const backfillTrailers = Boolean(shard || target)
    let creditsBackfillLeft = shard ? MAX_CREDITS_BACKFILL_PER_RUN : 0
    const trailerBackfill: { seasonId: number; tmdbId: number; seasonNumber: number; title: string }[] = []
    loopStarted = true

    for (let i = 0; i < itemsToSync.length; i += chunkSize) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn(
          `[Sync ${runLabel}] Reached ${MAX_EXECUTION_TIME_MS / 1000}s ceiling (${((Date.now() - startTime) / 1000).toFixed(1)}s). Stopping early at ${itemsSynced}/${itemsToSync.length} items to record sync log.`
        )
        hitCeiling = true
        break
      }
      const chunk = itemsToSync.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const tmdbType = item.category === 'TV Shows' ? 'tv' : 'movie'
            // See MAX_CREDITS_BACKFILL_PER_RUN. The allowance is taken before
            // the first await, so the chunk's parallel callbacks cannot
            // overspend it.
            const wantCredits = Boolean(target) || (!item.has_credits && creditsBackfillLeft > 0)
            if (wantCredits && !target) creditsBackfillLeft--
            const detailPath = `${tmdbType}/${item.tmdb_id}`
            const detailParams = (append: string) => ({ append_to_response: append, ...VIDEO_PARAMS })
            // A movie's details carry imdb_id; a show's need external_ids.
            const baseAppend = tmdbType === 'tv' ? 'watch/providers,videos,external_ids' : 'watch/providers,videos'
            let data: TMDBDetails | null
            if (wantCredits) {
              try {
                data = await fetchTMDB<TMDBDetails>(
                  detailPath,
                  detailParams(`${baseAppend},${tmdbType === 'tv' ? 'aggregate_credits' : 'credits'}`),
                )
              } catch (creditsError) {
                // Credits must never fail a title: the call without them is the
                // one every run made before credits were stored.
                console.warn(`Credits fetch failed for ${item.title}; retrying without`, creditsError)
                data = await fetchTMDB<TMDBDetails>(detailPath, detailParams(baseAppend))
              }
            } else {
              data = await fetchTMDB<TMDBDetails>(detailPath, detailParams(baseAppend))
            }
            if (!data?.id) return

            const commonUpdates: Record<string, unknown> = {}
            if (!item.image_url && data.poster_path) commonUpdates.poster = `https://image.tmdb.org/t/p/w500${data.poster_path}`
            if (!item.backdrop && data.backdrop_path) commonUpdates.backdrop = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
            if (!item.description && data.overview) commonUpdates.overview = data.overview
            if (data.release_date || data.first_air_date) commonUpdates.release_date = data.release_date || data.first_air_date
            if (!item.genres?.length && data.genres) commonUpdates.genre = data.genres.map((g) => g.name).join(', ')
            // Keep the source facts current so categories can be recomputed
            // locally when rules change. A missing field does not erase one.
            if (data.genres) commonUpdates.genre_ids = data.genres.map((g) => g.id).filter((id): id is number => typeof id === 'number')
            if (data.original_language) commonUpdates.original_language = data.original_language
            if (data.origin_country?.length || data.production_countries?.length) {
              commonUpdates.origin_country = data.origin_country?.length
                ? data.origin_country
                : data.production_countries?.map((country) => country.iso_3166_1)
            }
            commonUpdates.platform = getPlatform(data['watch/providers']?.results?.GB)
            // Rewritten every run, like platform: the append costs no extra
            // call, and a trailer TMDB has since removed should go too.
            commonUpdates.trailer_key = pickTrailerKey(data.videos?.results)
            // Only a well-formed id is written, so a response without one
            // never wipes a stored id. Movies carry it on the details, shows
            // under external_ids.
            const imdbId = item.category === 'Movies' ? data.imdb_id : data.external_ids?.imdb_id
            if (isImdbId(imdbId)) {
              commonUpdates.imdb_id = imdbId
              item.imdb_id = imdbId
            }
            if (typeof data.vote_average === 'number' && data.vote_average > 0) {
              commonUpdates.tmdb_rating = Math.round(data.vote_average * 10) / 10
            }
            if (typeof data.vote_count === 'number' && data.vote_count >= 0) {
              commonUpdates.tmdb_votes = Math.round(data.vote_count)
            }

            const arrayEq = (a: unknown, b: unknown) =>
              Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, idx) => v === b[idx])
            const sameVal = (next: unknown, prev: unknown) =>
              Array.isArray(next) ? arrayEq(next, prev) : (next ?? null) === (prev ?? null)

            if (item.category === 'Movies') {
              const movieUpdates: Record<string, unknown> = { ...commonUpdates }
              const airDate = data.release_date || data.first_air_date
              if (!item.year && airDate) {
                movieUpdates.release_year = new Date(airDate).getFullYear()
              }
              if (data.runtime) movieUpdates.runtime = data.runtime
              const collection = pickCollection(data)
              if (collection) {
                Object.assign(movieUpdates, collection)
                item.collection_id = collection.collection_id
                item.collection_name = collection.collection_name
              }
              // Written only when the block came back, so a response without
              // it never wipes what is stored.
              if (data.credits) {
                movieUpdates.directors = pickDirectors(data.credits.crew)
                movieUpdates.top_cast = pickTopCast(data.credits.cast)
              }
              const storedMovie: Record<string, unknown> = {
                poster: item.image_url ?? null,
                backdrop: item.backdrop ?? null,
                overview: item.description ?? null,
                release_date: item.release_date ?? null,
                genre: item.genres.length ? item.genres.join(', ') : null,
                genre_ids: item.genre_ids ?? null,
                original_language: item.original_language ?? null,
                origin_country: item.origin_country ?? null,
                platform: item.platform ?? null,
                trailer_key: item.trailer_key ?? null,
                imdb_id: item.imdb_id ?? null,
                release_year: item.year ?? null,
                runtime: item.runtime ?? null,
                collection_id: item.collection_id ?? null,
                collection_name: item.collection_name ?? null,
              }
              const movieDirty = Object.entries(movieUpdates).some(
                ([k, v]) => !(k in storedMovie) || !sameVal(v, storedMovie[k]),
              )
              if (movieDirty) {
                const movieUpdate = await supabaseAdmin.from('movies').update(movieUpdates).eq('id', parseInt(item.id))
                if (movieUpdate.error && /(?:genre_ids|original_language|origin_country)/.test(movieUpdate.error.message) && /(?:does not exist|could not find)/i.test(movieUpdate.error.message)) {
                  delete movieUpdates.genre_ids
                  delete movieUpdates.original_language
                  delete movieUpdates.origin_country
                  check(await supabaseAdmin.from('movies').update(movieUpdates).eq('id', parseInt(item.id)))
                } else check(movieUpdate)
              }
            } else {
              if (data.status && item.series_status && data.status !== item.series_status) {
                changes.push(`${item.title}: status → ${data.status}`)
              }
              const tvUpdates: Record<string, unknown> = { ...commonUpdates, status: data.status }
              if (data.aggregate_credits) {
                tvUpdates.creators = pickCreators(data.created_by)
                tvUpdates.top_cast = pickTopCast(data.aggregate_credits.cast)
              }
              const storedShow: Record<string, unknown> = {
                poster: item.image_url ?? null,
                backdrop: item.backdrop ?? null,
                overview: item.description ?? null,
                release_date: item.release_date ?? null,
                genre: item.genres.length ? item.genres.join(', ') : null,
                genre_ids: item.genre_ids ?? null,
                original_language: item.original_language ?? null,
                origin_country: item.origin_country ?? null,
                platform: item.platform ?? null,
                trailer_key: item.trailer_key ?? null,
                imdb_id: item.imdb_id ?? null,
                status: item.series_status ?? null,
              }
              const tvDirty = Object.entries(tvUpdates).some(
                ([k, v]) => !(k in storedShow) || !sameVal(v, storedShow[k]),
              )
              if (tvDirty) {
                const tvUpdate = await supabaseAdmin.from('tv_shows').update(tvUpdates).eq('id', parseInt(item.id))
                if (tvUpdate.error && /(?:genre_ids|original_language|origin_country)/.test(tvUpdate.error.message) && /(?:does not exist|could not find)/i.test(tvUpdate.error.message)) {
                  delete tvUpdates.genre_ids
                  delete tvUpdates.original_language
                  delete tvUpdates.origin_country
                  check(await supabaseAdmin.from('tv_shows').update(tvUpdates).eq('id', parseInt(item.id)))
                } else check(tvUpdate)
              }

              // Seasons TMDB no longer lists or has emptied, and stale Season 0
              // specials. Deleted only if they hold nothing of the owner's,
              // checked against the tables just before the delete below.
              const seasonDeleteCandidates: number[] = []
              // Season 0 cleanup (specials that TMDB removed or that duplicate a real season)
              const tmdbSeason0 = data.seasons?.find((s) => s.season_number === 0)
              const localSeason0 = item.seasons?.find((s) => s.season_number === 0)
              if (localSeason0) {
                let shouldDelete = !tmdbSeason0 || tmdbSeason0.episode_count === 0
                if (!shouldDelete && localSeason0.release_date) {
                  const otherSeasons = item.seasons?.filter((s) => s.season_number !== 0) || []
                  shouldDelete = otherSeasons.some((s) => s.release_date && s.release_date === localSeason0.release_date)
                }
                if (shouldDelete) seasonDeleteCandidates.push(localSeason0.id)
              }

              if (data.seasons) {
                // A season that fails fails its title: counted as synced, the
                // show would sit with stale episodes under a green log row.
                let seasonFailed = false
                const maxLocalSeasonNumber = Math.max(0, ...(item.seasons?.map((ls) => ls.season_number) ?? [0]))
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                const ninetyDaysAgo = new Date(now)
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                const isShowCurrentlyAiring = data.status === 'Returning Series' || data.status === 'In Production'
                const isShowSettled = data.status === 'Ended' || data.status === 'Canceled'

                await Promise.all(
                  data.seasons.map(async (s) => {
                    if (s.season_number === 0) return

                    const localSeason = item.seasons?.find((ls) => ls.season_number === s.season_number)
                    if (s.episode_count === 0) {
                      if (localSeason && localSeason.episodes.length === 0) {
                        seasonDeleteCandidates.push(localSeason.id)
                      }
                      return
                    }

                    try {
                      const seasonReleaseDate = s.air_date ? new Date(s.air_date) : null
                      const localEpisodeCount = localSeason?.episodes?.length || 0
                      const hasEpisodeCountChanged = localEpisodeCount !== s.episode_count
                      // Settled seasons on Ended/Canceled shows >90 days old with
                      // aired episodes already stored don't need nightly re-reads
                      // just because TMDB counts air-date-less specials/TBA rows.
                      const settledWithTbaMismatch =
                        !target &&
                        isShowSettled &&
                        Boolean(localSeason?.trailer_checked_at) &&
                        localEpisodeCount > 0 &&
                        seasonReleaseDate != null &&
                        seasonReleaseDate < ninetyDaysAgo
                      const isRecentOrActiveSeason =
                        !localSeason ||
                        !seasonReleaseDate ||
                        seasonReleaseDate >= ninetyDaysAgo ||
                        (isShowCurrentlyAiring && s.season_number >= maxLocalSeasonNumber - 1)
                      const shouldUpdateEpisodes =
                        Boolean(target) ||
                        isRecentOrActiveSeason ||
                        (!settledWithTbaMismatch && hasEpisodeCountChanged)

                      if (!shouldUpdateEpisodes) {
                        // Still update release_date if TMDB's changed, and queue
                        // trailer backfill if unchecked.
                        if (localSeason && (localSeason.release_date ?? null) !== (s.air_date || null)) {
                          check(await supabaseAdmin
                            .from('tv_show_seasons')
                            .update({ release_date: s.air_date || null })
                            .eq('id', localSeason.id))
                        }
                        if (
                          backfillTrailers && item.tmdb_id && localSeason && !localSeason.trailer_checked_at &&
                          trailerBackfill.length < MAX_TRAILER_BACKFILL_PER_RUN
                        ) {
                          trailerBackfill.push({ seasonId: localSeason.id, tmdbId: item.tmdb_id, seasonNumber: s.season_number, title: item.title })
                        }
                        return
                      }

                      // Re-read for its episodes anyway, so the season's
                      // trailer rides along on the same call.
                      const sDetails = await fetchTMDB<TMDBSeasonDetails>(
                        `tv/${item.tmdb_id}/season/${s.season_number}`,
                        { append_to_response: 'videos', ...VIDEO_PARAMS },
                      )
                      const validEpisodes = (sDetails?.episodes || []).filter(hasAirDate)

                      if (validEpisodes.length > 0) {
                        let seasonId = localSeason?.id
                        if (!seasonId) {
                          const { data: insertedSeason, error: sErr } = await supabaseAdmin
                            .from('tv_show_seasons')
                            .upsert(
                              {
                                tv_show_id: parseInt(item.id),
                                season_number: s.season_number,
                                release_date: s.air_date || null,
                              },
                              { onConflict: 'tv_show_id,season_number' },
                            )
                            .select('id')
                            .single()
                          if (sErr || !insertedSeason) throw sErr ?? new Error(`season ${s.season_number} upsert returned no row`)
                          seasonId = insertedSeason.id
                        } else if (localSeason && (localSeason.release_date ?? null) !== (s.air_date || null)) {
                          check(await supabaseAdmin
                            .from('tv_show_seasons')
                            .update({ release_date: s.air_date || null })
                            .eq('id', seasonId))
                        }

                        if (validEpisodes.length > localEpisodeCount) {
                          changes.push(
                            `${item.title}: +${validEpisodes.length - localEpisodeCount} new episode(s) (S${s.season_number})`,
                          )
                        }
                        const existingByNumber = new Map(
                          (localSeason?.episodes ?? []).map((e) => [e.episode_number, e]),
                        )
                        const epsToUpsert = validEpisodes.flatMap((v) => {
                          const title = v.name || `Episode ${v.episode_number}`
                          const runtime = v.runtime || data.episode_run_time?.[0] || null
                          const releaseDate = v.air_date
                          const existing = existingByNumber.get(v.episode_number)
                          if (
                            existing &&
                            (existing.title ?? null) === title &&
                            (existing.runtime ?? null) === runtime &&
                            (existing.release_date ?? null) === releaseDate
                          ) {
                            return []
                          }
                          // No `watched`: the upsert's SET list is exactly the
                          // keys sent, so leaving it out keeps the owner's
                          // value. Sending the copy read at the start of the
                          // run reverted any episode marked watched since,
                          // cleared its watched_at and fired the watch
                          // triggers as if the owner had unwatched it. A new
                          // episode takes the column default, unwatched.
                          return [{
                            season_id: seasonId,
                            episode_number: v.episode_number,
                            title,
                            runtime,
                            release_date: releaseDate,
                          }]
                        })
                        if (epsToUpsert.length > 0) {
                          check(await supabaseAdmin.from('tv_show_episodes').upsert(epsToUpsert, { onConflict: 'season_id,episode_number' }))
                        }

                        const validNumberSet = new Set(validEpisodes.map((v) => v.episode_number))
                        const toDeleteIds = (localSeason?.episodes ?? [])
                          .filter((e) => !validNumberSet.has(e.episode_number))
                          .map((e) => e.id)
                        if (toDeleteIds.length > 0) {
                          // Episodes TMDB no longer lists, or whose air date it
                          // has blanked. A rated one stays, and the filter on
                          // the delete keeps a watched one: see owner-data.ts.
                          const rated = await ratedEpisodes(supabaseAdmin, toDeleteIds)
                          if (!rated) console.warn(`Kept ${toDeleteIds.length} episode(s) of "${item.title}" S${s.season_number} TMDB no longer lists: the ratings read was incomplete`)
                          const doomed = rated ? toDeleteIds.filter((id) => !rated.has(id)) : []
                          if (doomed.length > 0) {
                            check(await supabaseAdmin.from('tv_show_episodes').delete().in('id', doomed).or(UNWATCHED_ONLY))
                          }
                        }

                        const nextTrailerKey = pickTrailerKey(sDetails?.videos?.results) ?? null
                        if (
                          !localSeason?.trailer_checked_at ||
                          (localSeason?.trailer_key ?? null) !== nextTrailerKey
                        ) {
                          // After the episodes and unchecked: a failed trailer
                          // write must not fail a title whose episodes are fine.
                          const { error: trailerError } = await supabaseAdmin
                            .from('tv_show_seasons')
                            .update({ trailer_key: nextTrailerKey, trailer_checked_at: new Date().toISOString() })
                            .eq('id', seasonId)
                          if (trailerError) console.warn(`Trailer write failed for "${item.title}" S${s.season_number}:`, trailerError)
                        }
                      } else if (localSeason) {
                        const hasWatched = localSeason.episodes.some((ep) => watchedEpisodes.has(`${item.id}-s${s.season_number}-e${ep.episode_number}`))
                        if (!hasWatched) seasonDeleteCandidates.push(localSeason.id)
                      }
                    } catch (e) {
                      console.error(`Failed to sync season ${s.season_number} for "${item.title}":`, e)
                      seasonFailed = true
                    }
                  }),
                )
                // Before the cleanup below, which deletes local seasons TMDB
                // lacks and should not run on a half-read show.
                if (seasonFailed) throw new Error('one or more seasons failed to sync')

                const localSeasons = item.seasons?.filter((s) => s.season_number !== 0) || []
                for (const localSeason of localSeasons) {
                  const existsInTmdb = data.seasons.some((ts) => ts.season_number === localSeason.season_number)
                  if (!existsInTmdb) {
                    const hasWatchedEps = localSeason.episodes.some((ep) => watchedEpisodes.has(`${item.id}-s${localSeason.season_number}-e${ep.episode_number}`))
                    if (!hasWatchedEps) seasonDeleteCandidates.push(localSeason.id)
                  }
                }
              }

              if (seasonDeleteCandidates.length > 0) {
                // `watchedEpisodes` is from the start of the run and knows
                // nothing of ratings; see owner-data.ts.
                const keep = await seasonsToKeep(supabaseAdmin, seasonDeleteCandidates)
                if (!keep) console.warn(`Kept ${seasonDeleteCandidates.length} season(s) of "${item.title}" queued for deletion: the episode or ratings read was incomplete`)
                const doomed = keep ? seasonDeleteCandidates.filter((id) => !keep.has(id)) : []
                if (doomed.length > 0) {
                  check(await supabaseAdmin.from('tv_show_seasons').delete().in('id', doomed))
                }
              }
            }
            itemsSynced++
          } catch (itemError) {
            console.error(`Error syncing item ${item.title}:`, itemError)
            failedTitles.push(item.title)
          }
        }),
      )
    }

    // Wikidata pass: the last nightly part answers tmdb-proxy's two Wikidata
    // lookups with the proxy's own code (_shared/wikidata-lookups.ts) and
    // stores them in watchlist_wikidata_cache, which Discover and Franchises
    // read before asking the proxy. Spin-offs are answered for the seed list
    // a signed-out visitor sends, so a hidden or stopped show is never a seed;
    // a browser with another list (the owner, or the library changed since)
    // asks the proxy as before. Only a complete answer is stored (every TMDB
    // poster and date answered; the sibling-franchise query may have failed,
    // as it does for the proxy on nearly every call). Otherwise a
    // row for tonight's seed list stays (the browser stops trusting it after
    // 48 hours), and a row for any other list is deleted: it can no longer
    // match a visitor, and it may name a show hidden or stopped since.
    //
    // It starts once the titles are synced and runs beside the best-effort
    // passes below, which can each run to the ceiling, so they cannot starve
    // it; it is awaited before the run logs. Its calls are network waits.
    const runWikidataPass = async (): Promise<void> => {
      const seeds = visitorTvSeedIds(shows.map((show) => ({ tmdb_id: show.tmdb_id, library_state: show.library_state })))
      const clearOtherSeedLists = async () => {
        const { error } = await supabaseAdmin
          .from('watchlist_wikidata_cache')
          .delete()
          .eq('lookup', 'tv-spinoffs')
          .neq('seed_ids', `{${seeds.join(',')}}`)
        if (error) console.warn(`[Sync ${runLabel}] Wikidata cache clear failed for tv-spinoffs:`, error.message)
      }
      const remainingMs = MAX_EXECUTION_TIME_MS - (Date.now() - startTime)
      if (remainingMs < WIKIDATA_PASS_MIN_MS) {
        console.warn(`[Sync ${runLabel}] Wikidata cache skipped: ${Math.round(remainingMs / 1000)}s left.`)
        await clearOtherSeedLists()
        return
      }
      const signal = AbortSignal.timeout(remainingMs)
      const storeLookup = async (row: WikidataCacheRow): Promise<boolean> => {
        const { error } = await supabaseAdmin.from('watchlist_wikidata_cache').upsert(row, { onConflict: 'lookup' })
        if (error) console.warn(`[Sync ${runLabel}] Wikidata cache upsert failed for ${row.lookup}:`, error.message)
        return !error
      }
      const timed = async <T>(endpoint: string, run: () => Promise<T>): Promise<T | null> => {
        const startedAt = Date.now()
        try {
          const answer = await run()
          activeUsage.record({ provider: 'wikidata', endpoint, statusCode: 200, outcome: 'ok', durationMs: Date.now() - startedAt })
          return answer
        } catch (error) {
          activeUsage.record({ provider: 'wikidata', endpoint, statusCode: null, outcome: 'error', durationMs: Date.now() - startedAt })
          console.warn(`[Sync ${runLabel}] Wikidata ${endpoint} failed:`, error)
          return null
        }
      }
      const [spinoffs, universes] = await Promise.all([
        seeds.length === 0
          ? Promise.resolve(null)
          : timed('tv-spinoffs', () => fetchTvSpinoffs(spinoffSeedIds(seeds), { tmdbApiKey: TMDB_API_KEY, signal })),
        TMDB_API_KEY
          ? timed('film-universes', () => fetchFilmUniverses(activeUsage, { tmdbApiKey: TMDB_API_KEY, signal }))
          : Promise.resolve(null),
      ])
      const spinoffsStored = spinoffs?.complete === true &&
        await storeLookup(tvSpinoffCacheRow(seeds, spinoffs.links, new Date().toISOString()))
      if (!spinoffsStored) await clearOtherSeedLists()
      const universesStored = universes !== null &&
        await storeLookup(filmUniverseCacheRow(universes, new Date().toISOString()))
      const spinoffOutcome = !spinoffs
        ? (seeds.length === 0 ? 'no seeds' : 'failed')
        : `${spinoffs.links.length} links, siblings ${spinoffs.siblings}${spinoffs.complete ? '' : ', TMDB incomplete'}, ${spinoffsStored ? 'stored' : 'not stored'}`
      const universeOutcome = !TMDB_API_KEY
        ? 'no TMDB key'
        : !universes ? 'failed' : `${universes.length} films, ${universesStored ? 'stored' : 'not stored'}`
      console.log(`[Sync ${runLabel}] Wikidata cache: tv-spinoffs (${seeds.length} seeds) ${spinoffOutcome}; film-universes ${universeOutcome}.`)
    }
    const wikidataPass = shard && shard.index === shard.count - 1
      ? runWikidataPass().catch((error) => console.warn(`[Sync ${runLabel}] Wikidata pass failed:`, error))
      : Promise.resolve()

    // Season trailer backfill, after the sync proper so it can neither fail a
    // title nor spend the time a title needs. Best effort: a season that
    // fails here, or that the ceiling cuts off, stays unchecked for next run.
    let trailersBackfilled = 0
    let nextBackfill = 0
    await Promise.all(
      Array.from({ length: Math.min(TRAILER_BACKFILL_CONCURRENCY, trailerBackfill.length) }, async () => {
        while (nextBackfill < trailerBackfill.length && Date.now() - startTime < MAX_EXECUTION_TIME_MS) {
          const season = trailerBackfill[nextBackfill++]
          try {
            const videos = await fetchTMDB<TMDBVideos>(
              `tv/${season.tmdbId}/season/${season.seasonNumber}/videos`,
              VIDEO_PARAMS,
            )
            check(await supabaseAdmin
              .from('tv_show_seasons')
              .update({ trailer_key: pickTrailerKey(videos?.results), trailer_checked_at: new Date().toISOString() })
              .eq('id', season.seasonId))
            trailersBackfilled++
          } catch (e) {
            console.warn(`Trailer backfill failed for "${season.title}" S${season.seasonNumber}:`, e)
          }
        }
      }),
    )
    if (trailerBackfill.length > 0) {
      console.log(`[Sync ${runLabel}] Season trailers backfilled: ${trailersBackfilled}/${trailerBackfill.length}.`)
    }

    // OMDb score pass, after the TMDB work so it can neither fail a title nor
    // spend the time a title needs. Its failures are never the run's failures:
    // nothing here touches failedTitles. The key is read here and appears only
    // in the request URL; it is never logged or returned, and a fetch error is
    // logged as a fixed string because its message can carry the URL.
    const omdbStats = { asked: 0, updated: 0, notFound: 0, stoppedByLimit: false }
    const omdbKey = Deno.env.get('OMDB_API_KEY')
    // Nightly parts and one-title resyncs only, like the trailer and credits
    // backfills: an unsharded manual run already uses nearly all of the CPU
    // budget (see 20261006090000), and it would spend a third of OMDb's daily
    // 1,000 requests on every press.
    const runOmdb = Boolean(shard || target)
    if (!omdbKey) {
      console.warn(`[Sync ${runLabel}] OMDB_API_KEY is not set; skipping the OMDb score pass.`)
    } else if (!runOmdb) {
      console.log(`[Sync ${runLabel}] Full manual run; the OMDb score pass runs in the nightly parts.`)
    } else {
      const staleBefore = Date.now() - OMDB_STALE_AFTER_MS
      const queue = [...movies, ...shows]
        .filter((item) => item.imdb_id && isActiveInNightly(item) && (!shard || Number(item.id) % shard.count === shard.index))
        .filter((item) => Boolean(target) || !item.scores_checked_at || Date.parse(item.scores_checked_at) < staleBefore)
        .sort((a, b) => {
          const aTime = a.scores_checked_at ? Date.parse(a.scores_checked_at) : -Infinity
          const bTime = b.scores_checked_at ? Date.parse(b.scores_checked_at) : -Infinity
          return aTime === bTime ? 0 : aTime < bTime ? -1 : 1
        })
        .slice(0, OMDB_MAX_PER_RUN)
      let consecutiveErrors = 0
      for (const item of queue) {
        if (Date.now() - startTime >= MAX_EXECUTION_TIME_MS) break
        if (omdbStats.asked > 0) await new Promise((resolve) => setTimeout(resolve, OMDB_REQUEST_GAP_MS))
        omdbStats.asked++
        let outcome: OmdbOutcome
        const omdbT0 = Date.now()
        try {
          const res = await fetch(
            `https://www.omdbapi.com/?${new URLSearchParams({ i: item.imdb_id!, apikey: omdbKey })}`,
            { signal: AbortSignal.timeout(15000) },
          )
          // OMDb reports a bad key or a spent daily limit as a 401 with a JSON
          // body, so the body is read whatever the status.
          outcome = parseOmdbResponse(await res.json().catch(() => null))
          activeUsage.record({
            provider: 'omdb',
            endpoint: 'title-by-imdb',
            statusCode: res.status,
            outcome: outcome.kind === 'limit' ? 'rate_limited' : outcome.kind === 'error' ? 'error' : 'ok',
            durationMs: Date.now() - omdbT0,
          })
        } catch {
          activeUsage.record({
            provider: 'omdb',
            endpoint: 'title-by-imdb',
            statusCode: null,
            outcome: 'error',
            durationMs: Date.now() - omdbT0,
          })
          outcome = { kind: 'error', message: 'OMDb request failed' }
        }
        if (outcome.kind === 'limit') {
          omdbStats.stoppedByLimit = true
          break
        }
        if (outcome.kind === 'error') {
          console.warn(`[Sync ${runLabel}] OMDb error for "${item.title}": ${outcome.message}`)
          if (++consecutiveErrors >= OMDB_MAX_CONSECUTIVE_ERRORS) {
            console.warn(`[Sync ${runLabel}] ${OMDB_MAX_CONSECUTIVE_ERRORS} OMDb errors in a row; stopping the pass.`)
            break
          }
          continue
        }
        consecutiveErrors = 0
        const checkedAt = new Date().toISOString()
        const patch = outcome.kind === 'scores'
          ? { ...outcome.scores, scores_checked_at: checkedAt }
          : { scores_checked_at: checkedAt }
        const { error: omdbWriteError } = await supabaseAdmin
          .from(item.category === 'Movies' ? 'movies' : 'tv_shows')
          .update(patch)
          .eq('id', parseInt(item.id))
        if (omdbWriteError) {
          console.warn(`[Sync ${runLabel}] OMDb score write failed for "${item.title}":`, omdbWriteError.message)
          continue
        }
        if (outcome.kind === 'scores') omdbStats.updated++
        else omdbStats.notFound++
      }
      console.log(
        `[Sync ${runLabel}] OMDb: asked ${omdbStats.asked}, updated ${omdbStats.updated}, not found ${omdbStats.notFound}, stopped by limit ${omdbStats.stoppedByLimit ? 'yes' : 'no'}.`,
      )
    }

    // Collection pass: check each active film collection once a night
    // (sharded by collection_id % shard.count) or on a single-movie resync,
    // caching any dated future instalments in watchlist_collection_upcoming so
    // Discover's Coming soon catches newly announced sequels across every
    // franchise without hammering TMDB from the browser, and every part in
    // watchlist_collection_parts, which Discover's collection walk reads in
    // place of one tmdb-proxy call per collection. Best-effort only.
    if (shard || target) {
      const todayIso = new Date().toISOString().slice(0, 10)
      const allActiveCollectionIds = new Set<number>()
      const collectionsToCheck = new Map<number, string>()
      for (const movie of movies) {
        // Never cache collections for hidden or stopped movies (even on a
        // single-movie resync), since watchlist_collection_upcoming is public-read.
        if (movie.library_state === 'hidden' || movie.library_state === 'stopped' || !movie.collection_id) continue
        allActiveCollectionIds.add(movie.collection_id)
        if (target && (target.category !== 'Movies' || Number(movie.id) !== target.id)) continue
        if (shard && movie.collection_id % shard.count !== shard.index) continue
        if (!collectionsToCheck.has(movie.collection_id)) {
          collectionsToCheck.set(movie.collection_id, movie.collection_name || `Collection ${movie.collection_id}`)
        }
      }
      // Pre-read existing cached collection IDs once so we only issue DELETE
      // calls for collections that actually have cached rows, and prune any
      // orphaned collections whose movies were removed/hidden/stopped.
      const existingCachedCollectionIds = new Set<number>()
      const { data: existingCachedRows, error: existingCachedError } = await supabaseAdmin
        .from('watchlist_collection_upcoming')
        .select('collection_id')
      if (existingCachedError) {
        console.warn(`[Sync ${runLabel}] Collection upcoming pre-read failed:`, existingCachedError.message)
      } else {
        for (const row of existingCachedRows ?? []) {
          if (typeof row.collection_id === 'number') existingCachedCollectionIds.add(row.collection_id)
        }
      }
      if (!target && shard?.index === 0) {
        const { error: pruneError } = await supabaseAdmin
          .from('watchlist_collection_upcoming')
          .delete()
          .lte('release_date', todayIso)
        if (pruneError) {
          console.warn(`[Sync ${runLabel}] Collection upcoming prune failed:`, pruneError.message)
        }
        const orphanedIds = [...existingCachedCollectionIds].filter((id) => !allActiveCollectionIds.has(id))
        if (orphanedIds.length > 0) {
          const { error: orphanError } = await supabaseAdmin
            .from('watchlist_collection_upcoming')
            .delete()
            .in('collection_id', orphanedIds)
          if (orphanError) {
            console.warn(`[Sync ${runLabel}] Collection upcoming orphan prune failed:`, orphanError.message)
          }
        }
        // A collection whose last visible film was removed, hidden or stopped
        // leaves the public parts cache too. `movies` is the whole library on
        // a shard run, so every other collection is still active. Read in
        // pages (the table outgrows one response) and deleted by the orphans'
        // ids, which stay few, rather than by every active id.
        const cachedParts = await selectAllPages<{ collection_id: number; tmdb_id: number }>(
          (from, to) => supabaseAdmin
            .from('watchlist_collection_parts')
            .select('collection_id, tmdb_id', { count: 'exact' })
            .order('collection_id')
            .order('tmdb_id')
            .range(from, to),
          (row) => `${row.collection_id}:${row.tmdb_id}`,
        )
        if (cachedParts.error) {
          console.warn(`[Sync ${runLabel}] Collection parts pre-read failed:`, cachedParts.error.message)
        } else {
          const orphanedPartIds = [...new Set(cachedParts.data.map((row) => row.collection_id))]
            .filter((id) => !allActiveCollectionIds.has(id))
          for (let i = 0; i < orphanedPartIds.length; i += 100) {
            const { error: partsPruneError } = await supabaseAdmin
              .from('watchlist_collection_parts')
              .delete()
              .in('collection_id', orphanedPartIds.slice(i, i + 100))
            if (partsPruneError) {
              console.warn(`[Sync ${runLabel}] Collection parts orphan prune failed:`, partsPruneError.message)
            }
          }
        }
      }
      // Replaces one collection's cached parts. A collection with none to
      // keep (gone from TMDB, empty, or not storable exactly; see
      // collectionPartRows) has its rows removed, so the walk asks TMDB for
      // it. A failed upsert keeps the previous night's rows, which the walk
      // stops trusting after a week.
      let partsCollectionsStored = 0
      const storeCollectionParts = async (collectionId: number, rows: CollectionPartRow[] | null) => {
        const clear = supabaseAdmin.from('watchlist_collection_parts').delete().eq('collection_id', collectionId)
        if (!rows || rows.length === 0) {
          const { error } = await clear
          if (error) console.warn(`[Sync ${runLabel}] Collection parts clear failed for ${collectionId}:`, error.message)
          return
        }
        const { error: upsertError } = await supabaseAdmin
          .from('watchlist_collection_parts')
          .upsert(rows, { onConflict: 'collection_id,tmdb_id' })
        if (upsertError) {
          console.warn(`[Sync ${runLabel}] Collection parts upsert failed for ${collectionId}:`, upsertError.message)
          return
        }
        partsCollectionsStored++
        // Parts TMDB dropped. Left behind they are still ignored: the walk
        // reads only a collection's newest rows.
        const { error: cleanError } = await clear.not('tmdb_id', 'in', `(${rows.map((row) => row.tmdb_id).join(',')})`)
        if (cleanError) console.warn(`[Sync ${runLabel}] Collection parts cleanup failed for ${collectionId}:`, cleanError.message)
      }
      const collectionQueue = [...collectionsToCheck.entries()]
      let collectionCursor = 0
      let collectionsChecked = 0
      let upcomingUpserted = 0
      const COLLECTION_CONCURRENCY = 6
      await Promise.all(
        Array.from({ length: Math.min(COLLECTION_CONCURRENCY, collectionQueue.length) }, async () => {
          while (collectionCursor < collectionQueue.length) {
            if (Date.now() - startTime >= MAX_EXECUTION_TIME_MS) break
            const [collectionId, fallbackName] = collectionQueue[collectionCursor++]
            try {
              const col = await fetchTMDB<{
                id?: number
                name?: string
                parts?: { id?: number; title?: string; release_date?: string | null; poster_path?: string | null }[]
              }>(`collection/${collectionId}`)
              if (!col) {
                if (existingCachedCollectionIds.has(collectionId)) {
                  await supabaseAdmin.from('watchlist_collection_upcoming').delete().eq('collection_id', collectionId)
                }
                await storeCollectionParts(collectionId, null)
                continue
              }
              collectionsChecked++
              await storeCollectionParts(collectionId, collectionPartRows(collectionId, col.parts, new Date().toISOString()))
              const colName = col.name?.trim() || fallbackName
              const syncedAt = new Date().toISOString()
              const futureRows: {
                collection_id: number
                tmdb_id: number
                collection_name: string
                title: string
                release_date: string
                poster_path: string | null
                synced_at: string
              }[] = []
              const seenIds = new Set<number>()
              for (const part of col.parts ?? []) {
                const partId = part.id
                const title = part.title?.trim()
                const releaseDate = part.release_date?.trim()
                if (
                  typeof partId !== 'number' ||
                  !Number.isInteger(partId) ||
                  partId <= 0 ||
                  seenIds.has(partId) ||
                  !title ||
                  !releaseDate ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ||
                  releaseDate <= todayIso
                ) {
                  continue
                }
                seenIds.add(partId)
                futureRows.push({
                  collection_id: collectionId,
                  tmdb_id: partId,
                  collection_name: colName,
                  title,
                  release_date: releaseDate,
                  poster_path: part.poster_path || null,
                  synced_at: syncedAt,
                })
              }
              if (futureRows.length > 0) {
                const { error: upsertError } = await supabaseAdmin
                  .from('watchlist_collection_upcoming')
                  .upsert(futureRows, { onConflict: 'collection_id,tmdb_id' })
                if (upsertError) {
                  console.warn(`[Sync ${runLabel}] Collection upcoming upsert failed for ${collectionId}:`, upsertError.message)
                  continue
                }
                upcomingUpserted += futureRows.length
                if (existingCachedCollectionIds.has(collectionId)) {
                  const keepList = `(${futureRows.map((r) => r.tmdb_id).join(',')})`
                  const { error: cleanError } = await supabaseAdmin
                    .from('watchlist_collection_upcoming')
                    .delete()
                    .eq('collection_id', collectionId)
                    .not('tmdb_id', 'in', keepList)
                  if (cleanError) {
                    console.warn(`[Sync ${runLabel}] Collection upcoming cleanup failed for ${collectionId}:`, cleanError.message)
                  }
                }
              } else if (existingCachedCollectionIds.has(collectionId)) {
                const { error: clearError } = await supabaseAdmin
                  .from('watchlist_collection_upcoming')
                  .delete()
                  .eq('collection_id', collectionId)
                if (clearError) {
                  console.warn(`[Sync ${runLabel}] Collection upcoming clear failed for ${collectionId}:`, clearError.message)
                }
              }
            } catch (e) {
              console.warn(`[Sync ${runLabel}] Collection upcoming check failed for ${collectionId}:`, e)
            }
          }
        }),
      )
      if (collectionQueue.length > 0) {
        console.log(
          `[Sync ${runLabel}] Collection upcoming: checked ${collectionsChecked}/${collectionQueue.length}, future titles saved ${upcomingUpserted}, parts cached for ${partsCollectionsStored}.`,
        )
      }
    }

    await wikidataPass

    const durationMs = Date.now() - startTime
    const { error: logError } = await supabaseAdmin.from('sync_log').insert({
      sync_type: syncType,
      // Only a part sends these, so a whole-library row still writes against
      // a sync_log that predates the columns.
      ...(shard && { shard: shard.index, shard_count: shard.count }),
      status: failedTitles.length > 0 || hitCeiling ? 'error' : 'success',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: hitCeiling
        ? `Reached ${MAX_EXECUTION_TIME_MS / 1000}s ceiling (${itemsSynced}/${itemsToSync.length} synced)${failedTitles.length > 0 ? `, ${failedTitles.length} failed: ${failedTitles.join(', ')}` : ''}`
        : failedTitles.length > 0
          ? `${failedTitles.length} item(s) failed: ${failedTitles.join(', ')}`
          : null,
    })
    // A run that cannot log looks, in the history panel, like one that never
    // ran; say why in the function log at least.
    if (logError) console.error(`[Sync ${runLabel}] sync_log insert failed:`, logError.message)
    // Keep the last 50 log rows
    const { data: oldLogs } = await supabaseAdmin.from('sync_log').select('id').order('synced_at', { ascending: false }).range(50, 1000)
    if (oldLogs && oldLogs.length > 0) {
      await supabaseAdmin.from('sync_log').delete().in('id', oldLogs.map((l: { id: number }) => l.id))
    }

    console.log(`[Sync ${runLabel}] Completed. ${itemsSynced}/${itemsToSync.length} synced in ${(durationMs / 1000).toFixed(1)}s. ${failedTitles.length} failed.`)

    return new Response(
      JSON.stringify({
        success: true,
        itemsSynced,
        itemsTotal: itemsToSync.length,
        shard: shard ?? undefined,
        failedTitles,
        changes,
        omdb: omdbKey && runOmdb ? omdbStats : undefined,
        durationMs,
        // Stopped at the time ceiling: titles past the stopping point were
        // not reached, and are in neither count.
        truncated: hitCeiling,
        // Only a manual full sync holds the cooldown, so only it reports one.
        // The claim was made just before the run started.
        retry_after: holdsCooldown
          ? Math.max(0, FULL_SYNC_COOLDOWN_SECONDS - Math.floor(durationMs / 1000))
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    // Failed before any TMDB call could go out -- the initial read, say. The
    // cooldown protects TMDB, and nothing was spent, so give it back.
    if (holdsCooldown && !loopStarted) await releaseCooldown(supabaseAdmin, FULL_SYNC_COOLDOWN_KEY)
    const durationMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const { error: logError } = await supabaseAdmin.from('sync_log').insert({
      sync_type: syncType,
      ...(shard && { shard: shard.index, shard_count: shard.count }),
      status: 'error',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: errorMsg,
    })
    if (logError) console.error(`[Sync ${runLabel}] sync_log insert failed:`, logError.message)
    console.error(`[Sync ${runLabel}] Failed:`, error)
    // The detail is in sync_log and the function log; the caller gets the
    // generic message, since it can carry a query or an upstream URL.
    return new Response(JSON.stringify({ error: 'Sync failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    await activeUsage.flush()
  }
})
