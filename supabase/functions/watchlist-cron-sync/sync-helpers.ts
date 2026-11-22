/**
 * Pure helper functions for `watchlist-cron-sync`.
 *
 * Extracted from `index.ts` so they can be unit-tested directly under Deno
 * without booting the HTTP server or touching Supabase/TMDB/OMDb.
 */

// Mirror of src/features/watchlist/tmdb-types.ts. Deno cannot import from
// src/, so these are hand-maintained copies -- change both together.
export interface TMDBProvider {
  provider_name?: string
}
export interface TMDBRegionProviders {
  flatrate?: TMDBProvider[]
  free?: TMDBProvider[]
  ads?: TMDBProvider[]
}
export interface TMDBEpisode {
  episode_number: number
  name?: string
  air_date?: string | null
  runtime?: number | null
}
export interface TMDBVideo {
  key?: string
  site?: string
  type?: string
  official?: boolean
  iso_639_1?: string | null
  published_at?: string
}
export interface TMDBCastMember {
  name?: string
  order?: number
  total_episode_count?: number
}
export interface TMDBCrewMember {
  name?: string
  job?: string
}

/** A TMDB episode that survived the "has an air date" filter. */
export type AiredEpisode = TMDBEpisode & { air_date: string }
export const hasAirDate = (v: TMDBEpisode): v is AiredEpisode => Boolean(v.air_date)

/**
 * Which one title to resync, null for the whole library, or 'invalid' for a
 * body that names a title badly. Only a body naming nothing is a full sync:
 * a typo must not quietly become the most expensive request there is.
 */
export function parseItemTarget(body: unknown): { category: 'Movies' | 'TV Shows'; id: number } | null | 'invalid' {
  if (!body || typeof body !== 'object') return null
  const { category, id } = body as { category?: unknown; id?: unknown }
  if (category === undefined && id === undefined) return null
  const numericId = typeof id === 'string' ? Number(id) : id
  if ((category !== 'Movies' && category !== 'TV Shows') || !Number.isSafeInteger(numericId)) return 'invalid'
  return { category, id: numericId as number }
}

/**
 * Which part of the library a scheduled run covers, null for all of it, or
 * 'invalid'. pg_cron splits the nightly run into parts a few minutes apart:
 * the whole library in one request used up to the platform's 2s CPU budget,
 * and a request killed for CPU dies without writing its sync_log row. A part
 * takes every title whose id is congruent to `shard` modulo `shards`.
 */
export function parseShard(body: unknown): { index: number; count: number } | null | 'invalid' {
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

// Mirror of src/features/watchlist/sync-logic.ts. Deno cannot import from
// src/, so this is a hand-maintained copy -- change both together.
export function getPlatform(providers: TMDBRegionProviders | undefined): string {
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
export function pickTrailerKey(videos: TMDBVideo[] | undefined | null): string | null {
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
export function pickCollection(
  data: { belongs_to_collection?: { id?: number; name?: string } | null },
): { collection_id: number | null; collection_name: string | null } | undefined {
  if (!('belongs_to_collection' in data)) return undefined
  const c = data.belongs_to_collection
  if (!c || typeof c.id !== 'number' || c.id <= 0) return { collection_id: null, collection_name: null }
  return { collection_id: c.id, collection_name: c.name?.trim() || null }
}

// Mirror of src/features/watchlist/omdb-scores.ts -- change both together.
// Deno cannot import from src/, so this is a hand-maintained copy.
export interface OmdbScores {
  imdb_rating: number | null
  imdb_votes: number | null
  rt_score: number | null
  metascore: number | null
}
export type OmdbOutcome =
  | { kind: 'scores'; scores: OmdbScores }
  | { kind: 'not-found' }
  | { kind: 'limit' }
  | { kind: 'error'; message: string }

const IMDB_ID = /^tt\d{7,10}$/
const OMDB_DECIMAL = /^\d+(\.\d+)?$/
const OMDB_INTEGER = /^\d+$/

export function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && IMDB_ID.test(value)
}
export function omdbText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}
export function omdbDecimal(text: string | null): number | null {
  if (text === null || !OMDB_DECIMAL.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
export function omdbPercent(text: string | null): number | null {
  const n = omdbDecimal(text)
  if (n === null || n > 100) return null
  return Math.round(n)
}
export function omdbRatingValue(ratings: unknown, source: string): string | null {
  if (!Array.isArray(ratings)) return null
  for (const entry of ratings) {
    if (entry && typeof entry === 'object' && (entry as { Source?: unknown }).Source === source) {
      return omdbText((entry as { Value?: unknown }).Value)
    }
  }
  return null
}
export function omdbImdbRating(text: string | null): number | null {
  const n = omdbDecimal(text)
  if (n === null) return null
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10
}
export function omdbVotes(text: string | null): number | null {
  if (text === null) return null
  const digits = text.replace(/,/g, '')
  if (!OMDB_INTEGER.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}
export function parseOmdbResponse(json: unknown): OmdbOutcome {
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
export function uniqueNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  for (const raw of names) {
    const name = raw?.trim()
    if (name) seen.add(name)
  }
  return [...seen]
}
export function pickDirectors(crew: TMDBCrewMember[] | undefined | null): string[] {
  return uniqueNames((crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name))
}
export function pickCreators(createdBy: { name?: string }[] | undefined | null): string[] {
  return uniqueNames((createdBy ?? []).map((c) => c.name))
}
export function pickTopCast(cast: TMDBCastMember[] | undefined | null): string[] {
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

/**
 * True when PostgREST (PGRST202) or Postgres (42883) reports that an RPC
 * function does not exist yet — used to fall back cleanly if the Edge Function
 * is deployed ahead of its migration.
 */
export function isMissingRpcError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42883' || error?.code === 'PGRST202'
}
