import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin } from '../_shared/require-admin.ts'
import { claimCooldown, cooldownResponse, releaseCooldown } from '../_shared/cooldown.ts'
import { corsOriginHeader } from '../_shared/site-origins.ts'

// The one watchlist sync. pg_cron calls it nightly with the service role key
// (see the scheduling migrations); the Watchlist page's Sync buttons call it
// with the admin's own session.
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
interface TMDBSeasonDetails {
  episodes?: TMDBEpisode[]
}
interface TMDBDetails {
  id?: number
  overview?: string
  poster_path?: string | null
  release_date?: string | null
  first_air_date?: string | null
  runtime?: number | null
  episode_run_time?: number[]
  genres?: { name: string }[]
  status?: string
  seasons?: TMDBSeasonSummary[]
  'watch/providers'?: { results?: Record<string, TMDBRegionProviders | undefined> }
}

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
  overview: string | null
  genre: string | null
  release_year: number | null
}
interface EpisodeRow {
  id?: number
  episode_number: number
  watched: boolean | null
}
interface SeasonRow {
  id: number
  season_number: number
  release_date: string | null
  tv_show_episodes: EpisodeRow[] | null
}
interface ShowRow {
  id: number
  title: string
  tmdb_id: number | null
  poster: string | null
  overview: string | null
  genre: string | null
  status: string | null
  tv_show_seasons: SeasonRow[] | null
}

/** One season of an item as this function holds it in memory. */
interface SyncSeason {
  id: number
  season_number: number
  release_date?: string
  episodes: { episode_number: number; watched: boolean | null }[]
}

/** A movie or show being synced. `seasons` is TV-only. */
interface SyncItem {
  id: string
  title: string
  category: 'Movies' | 'TV Shows'
  tmdb_id?: number
  image_url?: string
  description?: string
  genres: string[]
  year?: number
  series_status?: string | null
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
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
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
 * Throws a write's error. Every write below goes through this, so a write
 * that fails fails its title instead of the title counting as synced.
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
  ]
  for (const a of allowed) {
    if (available.some((p) => a.tmdbNames.some((name) => p.provider_name?.toLowerCase() === name.toLowerCase()))) {
      return a.displayName
    }
  }
  return 'Online'
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
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`
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
  const body = await req.json().catch(() => ({}))
  const target = parseItemTarget(body)
  if (target === 'invalid') {
    return new Response(JSON.stringify({ error: 'Invalid sync target' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const syncType = isServiceRole ? 'auto' : 'manual'
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
    // Selects '*', unlike WatchlistContext's fetchData, which drops `overview`
    // to keep the browser payload small. Here there is no payload to save,
    // and having the real overview in hand is what makes the
    // `!item.description` check below correct.
    // A single-title resync reads only that title's row and skips the other
    // table outright.
    const moviesQuery = supabaseAdmin.from('movies').select('*')
    const showsQuery = supabaseAdmin.from('tv_shows').select('*, tv_show_seasons (*, tv_show_episodes (*))')
    const none = { data: [], error: null }
    const [moviesResult, showsResult] = await Promise.all([
      !target ? moviesQuery : target.category === 'Movies' ? moviesQuery.eq('id', target.id) : none,
      !target ? showsQuery : target.category === 'TV Shows' ? showsQuery.eq('id', target.id) : none,
    ])
    if (moviesResult.error) throw moviesResult.error
    if (showsResult.error) throw showsResult.error

    const movies: SyncItem[] = ((moviesResult.data || []) as MovieRow[]).map((m) => ({
      id: String(m.id),
      title: m.title,
      category: 'Movies' as const,
      tmdb_id: m.tmdb_id || undefined,
      image_url: m.poster || undefined,
      description: m.overview || undefined,
      genres: m.genre ? m.genre.split(',').map((g: string) => g.trim()) : [],
      year: m.release_year || undefined,
    }))

    const shows: SyncItem[] = ((showsResult.data || []) as ShowRow[]).map((s) => ({
      id: String(s.id),
      title: s.title,
      category: 'TV Shows' as const,
      tmdb_id: s.tmdb_id || undefined,
      image_url: s.poster || undefined,
      description: s.overview || undefined,
      genres: s.genre ? s.genre.split(',').map((g: string) => g.trim()) : [],
      series_status: s.status,
      seasons: (s.tv_show_seasons || []).map((season) => ({
        id: season.id,
        season_number: season.season_number,
        release_date: season.release_date || undefined,
        episodes: (season.tv_show_episodes || []).map((ep) => ({
          episode_number: ep.episode_number,
          watched: ep.watched,
        })),
      })),
    }))

    // showId-sSeason-eEpisode -> watched, used to avoid deleting seasons
    // that the admin has already marked as watched.
    const watchedEpisodes = new Set<string>()
    shows.forEach((show) => {
      show.seasons?.forEach((season) => {
        season.episodes.forEach((ep) => {
          if (ep.watched) watchedEpisodes.add(`${show.id}-s${season.season_number}-e${ep.episode_number}`)
        })
      })
    })

    const itemsToSync = [...movies, ...shows].filter((item) => item.tmdb_id)

    // Parallel within a chunk. The ceiling is checked between chunks, and a
    // chunk can take up to ~30s when calls time out, so it sits 50s under the
    // platform's 150s request limit rather than at it: a run cut off by the
    // gateway would never write its sync_log row or answer the button.
    const chunkSize = 50
    const MAX_EXECUTION_TIME_MS = 100_000
    let hitCeiling = false
    loopStarted = true

    for (let i = 0; i < itemsToSync.length; i += chunkSize) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn(
          `[Sync ${syncType}] Reached ${MAX_EXECUTION_TIME_MS / 1000}s ceiling (${((Date.now() - startTime) / 1000).toFixed(1)}s). Stopping early at ${itemsSynced}/${itemsToSync.length} items to record sync log.`
        )
        hitCeiling = true
        break
      }
      const chunk = itemsToSync.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const tmdbType = item.category === 'TV Shows' ? 'tv' : 'movie'
            const data = await fetchTMDB<TMDBDetails>(`${tmdbType}/${item.tmdb_id}`, { append_to_response: 'watch/providers' })
            if (!data?.id) return

            const commonUpdates: Record<string, unknown> = {}
            if (!item.image_url && data.poster_path) commonUpdates.poster = `https://image.tmdb.org/t/p/w500${data.poster_path}`
            if (!item.description && data.overview) commonUpdates.overview = data.overview
            if (data.release_date || data.first_air_date) commonUpdates.release_date = data.release_date || data.first_air_date
            if (!item.genres?.length && data.genres) commonUpdates.genre = data.genres.map((g) => g.name).join(', ')
            commonUpdates.platform = getPlatform(data['watch/providers']?.results?.GB)

            if (item.category === 'Movies') {
              const movieUpdates = { ...commonUpdates }
              const airDate = data.release_date || data.first_air_date
              if (!item.year && airDate) {
                movieUpdates.release_year = new Date(airDate).getFullYear()
              }
              if (data.runtime) movieUpdates.runtime = data.runtime
              check(await supabaseAdmin.from('movies').update(movieUpdates).eq('id', parseInt(item.id)))
            } else {
              if (data.status && item.series_status && data.status !== item.series_status) {
                changes.push(`${item.title}: status → ${data.status}`)
              }
              const tvUpdates = { ...commonUpdates, status: data.status }
              check(await supabaseAdmin.from('tv_shows').update(tvUpdates).eq('id', parseInt(item.id)))

              // Season 0 cleanup (specials that TMDB removed or that duplicate a real season)
              const tmdbSeason0 = data.seasons?.find((s) => s.season_number === 0)
              const localSeason0 = item.seasons?.find((s) => s.season_number === 0)
              if (localSeason0) {
                let shouldDelete = !tmdbSeason0 || tmdbSeason0.episode_count === 0
                if (!shouldDelete && localSeason0.release_date) {
                  const otherSeasons = item.seasons?.filter((s) => s.season_number !== 0) || []
                  shouldDelete = otherSeasons.some((s) => s.release_date && s.release_date === localSeason0.release_date)
                }
                if (shouldDelete) {
                  check(await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localSeason0.id))
                }
              }

              if (data.seasons) {
                // A season that fails fails its title: counted as synced, the
                // show would sit with stale episodes under a green log row.
                let seasonFailed = false
                await Promise.all(
                  data.seasons.map(async (s) => {
                    if (s.season_number === 0) return

                    if (s.episode_count === 0) {
                      const localEmptySeason = item.seasons?.find((ls) => ls.season_number === s.season_number)
                      if (localEmptySeason && localEmptySeason.episodes.length === 0) {
                        check(await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localEmptySeason.id))
                      }
                      return
                    }

                    try {
                      const { data: dbS, error: sErr } = await supabaseAdmin
                        .from('tv_show_seasons')
                        .upsert(
                          { tv_show_id: parseInt(item.id), season_number: s.season_number, release_date: s.air_date || null },
                          { onConflict: 'tv_show_id,season_number' },
                        )
                        .select()
                        .single()
                      if (sErr || !dbS) throw sErr ?? new Error(`season ${s.season_number} upsert returned no row`)

                      const now = new Date()
                      now.setHours(0, 0, 0, 0)
                      const seasonReleaseDate = s.air_date ? new Date(s.air_date) : null
                      const ninetyDaysAgo = new Date(now)
                      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                      const isShowCurrentlyAiring = data.status === 'Returning Series' || data.status === 'In Production'
                      const localSeason = item.seasons?.find((ls) => ls.season_number === s.season_number)
                      const localEpisodeCount = localSeason?.episodes?.length || 0
                      const hasEpisodeCountChanged = localEpisodeCount !== s.episode_count
                      const shouldUpdateEpisodes = !seasonReleaseDate || seasonReleaseDate >= ninetyDaysAgo || isShowCurrentlyAiring || hasEpisodeCountChanged

                      if (shouldUpdateEpisodes) {
                        const sDetails = await fetchTMDB<TMDBSeasonDetails>(`tv/${item.tmdb_id}/season/${s.season_number}`)
                        const validEpisodes = (sDetails?.episodes || []).filter(hasAirDate)

                        if (validEpisodes.length > 0) {
                          if (validEpisodes.length > localEpisodeCount) {
                            changes.push(
                              `${item.title}: +${validEpisodes.length - localEpisodeCount} new episode(s) (S${s.season_number})`,
                            )
                          }
                          // Checked: an unread watched map would upsert every
                          // episode back to unwatched.
                          const { data: existingEps } = check(await supabaseAdmin
                            .from('tv_show_episodes')
                            .select('episode_number, watched')
                            .eq('season_id', dbS.id))
                          const watchedMap = new Map<number, boolean>(
                            ((existingEps || []) as EpisodeRow[]).map((e) => [e.episode_number, e.watched ?? false]),
                          )

                          const eps = validEpisodes.map((v) => ({
                            season_id: dbS.id,
                            episode_number: v.episode_number,
                            title: v.name || `Episode ${v.episode_number}`,
                            runtime: v.runtime || data.episode_run_time?.[0] || null,
                            release_date: v.air_date,
                            watched: watchedMap.get(v.episode_number) ?? false,
                          }))
                          check(await supabaseAdmin.from('tv_show_episodes').upsert(eps, { onConflict: 'season_id,episode_number' }))

                          const validEpisodeNumbers = validEpisodes.map((v) => v.episode_number)
                          const { data: existingEpisodes } = check(await supabaseAdmin
                            .from('tv_show_episodes')
                            .select('id, episode_number')
                            .eq('season_id', dbS.id))
                          const toDelete = ((existingEpisodes || []) as EpisodeRow[]).filter((e) => !validEpisodeNumbers.includes(e.episode_number))
                          if (toDelete.length > 0) {
                            check(await supabaseAdmin.from('tv_show_episodes').delete().in('id', toDelete.map((e) => e.id)))
                          }
                        } else {
                          const localS = item.seasons?.find((ls) => ls.season_number === s.season_number)
                          const hasWatched = localS?.episodes.some((ep) => watchedEpisodes.has(`${item.id}-s${s.season_number}-e${ep.episode_number}`))
                          if (!hasWatched) {
                            check(await supabaseAdmin.from('tv_show_seasons').delete().eq('id', dbS.id))
                          }
                        }
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
                    if (!hasWatchedEps) {
                      check(await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localSeason.id))
                    }
                  }
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

    const durationMs = Date.now() - startTime
    await supabaseAdmin.from('sync_log').insert({
      sync_type: syncType,
      status: failedTitles.length > 0 || hitCeiling ? 'error' : 'success',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: hitCeiling
        ? `Reached ${MAX_EXECUTION_TIME_MS / 1000}s ceiling (${itemsSynced}/${itemsToSync.length} synced)${failedTitles.length > 0 ? `, ${failedTitles.length} failed: ${failedTitles.join(', ')}` : ''}`
        : failedTitles.length > 0
          ? `${failedTitles.length} item(s) failed: ${failedTitles.join(', ')}`
          : null,
    })
    // Keep the last 50 log rows
    const { data: oldLogs } = await supabaseAdmin.from('sync_log').select('id').order('synced_at', { ascending: false }).range(50, 1000)
    if (oldLogs && oldLogs.length > 0) {
      await supabaseAdmin.from('sync_log').delete().in('id', oldLogs.map((l: { id: number }) => l.id))
    }

    console.log(`[Sync ${syncType}] Completed. ${itemsSynced}/${itemsToSync.length} synced in ${(durationMs / 1000).toFixed(1)}s. ${failedTitles.length} failed.`)

    return new Response(
      JSON.stringify({
        success: true,
        itemsSynced,
        itemsTotal: itemsToSync.length,
        failedTitles,
        changes,
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
    await supabaseAdmin.from('sync_log').insert({
      sync_type: syncType,
      status: 'error',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: errorMsg,
    })
    console.error(`[Sync ${syncType}] Failed:`, error)
    // The detail is in sync_log and the function log; the caller gets the
    // generic message, since it can carry a query or an upstream URL.
    return new Response(JSON.stringify({ error: 'Sync failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
