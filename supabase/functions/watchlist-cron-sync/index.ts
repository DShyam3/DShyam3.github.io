import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// Server-side port of the sync logic in src/contexts/WatchlistContext.tsx
// (syncWatchlist). That version only runs while an admin has the Watchlist
// page open in a browser -- this function does the same work on a schedule
// (see supabase/20260725_schedule_watchlist_sync.sql), so the data stays
// fresh even if nobody opens the page for days.
//
// Keep this in sync with WatchlistContext.tsx's syncWatchlist by hand --
// there is no shared module between the Deno edge runtime and the browser
// bundle, so this is a deliberate, maintained duplicate, not a mistake.

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

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ ...params, api_key: TMDB_API_KEY || '' })
  const res = await fetch(`${TMDB_BASE_URL}/${endpoint}?${query.toString()}`, {
    signal: AbortSignal.timeout(15000),
  })
  return res.json() as Promise<T>
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

  // This function writes to admin-only tables and burns TMDB quota, so it
  // must not be publicly callable. pg_cron authenticates with the service
  // role key (see the scheduling migration); reject anything else.
  const authHeader = req.headers.get('Authorization') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const startTime = Date.now()
  let itemsSynced = 0
  const failedTitles: string[] = []

  try {
    // --- Fetch current state ---
    // This deliberately still selects '*', unlike WatchlistContext's fetchData,
    // which drops `overview` to keep the browser payload small. Running
    // server-side there is no payload to save, and having the real overview in
    // hand is what makes the `!item.description` check below correct here.
    // The browser has to ask which rows are null instead -- see needsOverview
    // in WatchlistContext.syncWatchlist.
    const [moviesResult, showsResult] = await Promise.all([
      supabaseAdmin.from('movies').select('*'),
      supabaseAdmin.from('tv_shows').select('*, tv_show_seasons (*, tv_show_episodes (*))'),
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

    // Same chunking as the client version, parallelized within each chunk.
    const chunkSize = 50
    const MAX_EXECUTION_TIME_MS = 120_000

    for (let i = 0; i < itemsToSync.length; i += chunkSize) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn(
          `[Cron Sync] Reached 120s ceiling (${((Date.now() - startTime) / 1000).toFixed(1)}s). Stopping early at ${itemsSynced}/${itemsToSync.length} items to record sync log.`
        )
        break
      }
      const chunk = itemsToSync.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const tmdbType = item.category === 'TV Shows' ? 'tv' : 'movie'
            const data = await fetchTMDB<TMDBDetails>(`${tmdbType}/${item.tmdb_id}`, { append_to_response: 'watch/providers' })
            if (!data.id) return

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
              await supabaseAdmin.from('movies').update(movieUpdates).eq('id', parseInt(item.id))
            } else {
              const tvUpdates = { ...commonUpdates, status: data.status }
              await supabaseAdmin.from('tv_shows').update(tvUpdates).eq('id', parseInt(item.id))

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
                  await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localSeason0.id)
                }
              }

              if (data.seasons) {
                await Promise.all(
                  data.seasons.map(async (s) => {
                    if (s.season_number === 0) return

                    if (s.episode_count === 0) {
                      const localEmptySeason = item.seasons?.find((ls) => ls.season_number === s.season_number)
                      if (localEmptySeason && localEmptySeason.episodes.length === 0) {
                        await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localEmptySeason.id)
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
                      if (sErr || !dbS) return

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
                        const validEpisodes = (sDetails.episodes || []).filter(hasAirDate)

                        if (validEpisodes.length > 0) {
                          const { data: existingEps } = await supabaseAdmin
                            .from('tv_show_episodes')
                            .select('episode_number, watched')
                            .eq('season_id', dbS.id)
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
                          await supabaseAdmin.from('tv_show_episodes').upsert(eps, { onConflict: 'season_id,episode_number' })

                          const validEpisodeNumbers = validEpisodes.map((v) => v.episode_number)
                          const { data: existingEpisodes } = await supabaseAdmin
                            .from('tv_show_episodes')
                            .select('id, episode_number')
                            .eq('season_id', dbS.id)
                          const toDelete = ((existingEpisodes || []) as EpisodeRow[]).filter((e) => !validEpisodeNumbers.includes(e.episode_number))
                          if (toDelete.length > 0) {
                            await supabaseAdmin.from('tv_show_episodes').delete().in('id', toDelete.map((e) => e.id))
                          }
                        } else {
                          const localS = item.seasons?.find((ls) => ls.season_number === s.season_number)
                          const hasWatched = localS?.episodes.some((ep) => watchedEpisodes.has(`${item.id}-s${s.season_number}-e${ep.episode_number}`))
                          if (!hasWatched) {
                            await supabaseAdmin.from('tv_show_seasons').delete().eq('id', dbS.id)
                          }
                        }
                      }
                    } catch (e) {
                      console.error(`Failed to sync season ${s.season_number} for "${item.title}":`, e)
                    }
                  }),
                )

                const localSeasons = item.seasons?.filter((s) => s.season_number !== 0) || []
                for (const localSeason of localSeasons) {
                  const existsInTmdb = data.seasons.some((ts) => ts.season_number === localSeason.season_number)
                  if (!existsInTmdb) {
                    const hasWatchedEps = localSeason.episodes.some((ep) => watchedEpisodes.has(`${item.id}-s${localSeason.season_number}-e${ep.episode_number}`))
                    if (!hasWatchedEps) {
                      await supabaseAdmin.from('tv_show_seasons').delete().eq('id', localSeason.id)
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
    const hitCeiling = durationMs >= MAX_EXECUTION_TIME_MS && itemsSynced < itemsToSync.length
    await supabaseAdmin.from('sync_log').insert({
      sync_type: 'auto',
      status: failedTitles.length > 0 || hitCeiling ? 'error' : 'success',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: hitCeiling
        ? `Reached 120s ceiling (${itemsSynced}/${itemsToSync.length} synced)${failedTitles.length > 0 ? `, ${failedTitles.length} failed: ${failedTitles.join(', ')}` : ''}`
        : failedTitles.length > 0
          ? `${failedTitles.length} item(s) failed: ${failedTitles.join(', ')}`
          : null,
    })
    // Keep last 50 log rows, same as the client-side logSync
    const { data: oldLogs } = await supabaseAdmin.from('sync_log').select('id').order('synced_at', { ascending: false }).range(50, 1000)
    if (oldLogs && oldLogs.length > 0) {
      await supabaseAdmin.from('sync_log').delete().in('id', oldLogs.map((l: { id: number }) => l.id))
    }

    console.log(`[Cron Sync] Completed. ${itemsSynced}/${itemsToSync.length} synced in ${(durationMs / 1000).toFixed(1)}s. ${failedTitles.length} failed.`)

    return new Response(
      JSON.stringify({ success: true, itemsSynced, failed: failedTitles.length, durationMs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    await supabaseAdmin.from('sync_log').insert({
      sync_type: 'auto',
      status: 'error',
      items_synced: itemsSynced,
      duration_ms: durationMs,
      error_message: errorMsg,
    })
    console.error('[Cron Sync] Failed:', error)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
