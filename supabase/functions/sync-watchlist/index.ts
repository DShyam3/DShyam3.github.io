import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    // Check for service role key to secure the function
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const tmdbKey = Deno.env.get('TMDB_API_KEY') ?? ''
    const tmdbBaseUrl = 'https://api.themoviedb.org/3'
    const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w500'

    if (!tmdbKey) {
        return new Response(JSON.stringify({ error: 'TMDB_API_KEY secret is not set' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
        // 1. Fetch movies and TV shows that have TMDB IDs
        const { data: movies, error: mErr } = await supabase.from('movies').select('*').not('tmdb_id', 'is', null)
        const { data: tvShows, error: tErr } = await supabase.from('tv_shows').select('*').not('tmdb_id', 'is', null)

        if (mErr) throw mErr
        if (tErr) throw tErr

        console.log(`Starting sync for ${movies?.length || 0} movies and ${tvShows?.length || 0} TV shows...`)

        // Helper: TMDB Platform detection (matching frontend logic)
        const getPlatform = (providers: any) => {
            if (!providers) return 'Online'
            const available = [
                ...(providers.flatrate || []),
                ...(providers.free || []),
                ...(providers.ads || [])
            ]
            const allowed = [
                { tmdbName: 'netflix', displayName: 'Netflix' },
                { tmdbName: 'disney plus', displayName: 'Disney+' },
                { tmdbName: 'amazon prime video', displayName: 'Prime Video' },
                { tmdbName: 'apple tv plus', displayName: 'Apple TV+' },
                { tmdbName: 'bbc iplayer', displayName: 'BBC iPlayer' },
            ]
            for (const a of allowed) {
                if (available.some((p: any) => p.provider_name?.toLowerCase() === a.tmdbName)) {
                    return a.displayName
                }
            }
            return 'Online'
        }

        // 2. Sync Movies
        if (movies) {
            for (const movie of movies) {
                try {
                    const url = `${tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${tmdbKey}&append_to_response=watch/providers`
                    const res = await fetch(url)
                    const data = await res.json()
                    if (!data.id) continue

                    const updates: any = {
                        release_date: data.release_date || null,
                        release_year: data.release_date ? new Date(data.release_date).getFullYear() : movie.release_year,
                        platform: getPlatform(data['watch/providers']?.results?.GB),
                        runtime: data.runtime || movie.runtime,
                        overview: data.overview || movie.overview,
                        genre: data.genres?.map((g: any) => g.name).join(', ') || movie.genre
                    }
                    if (data.poster_path) updates.poster = `${tmdbImageBaseUrl}${data.poster_path}`

                    await supabase.from('movies').update(updates).eq('id', movie.id)
                } catch (e) {
                    console.error(`Error syncing movie ${movie.title}:`, e)
                }
            }
        }

        // 3. Sync TV Shows
        if (tvShows) {
            for (const show of tvShows) {
                try {
                    const url = `${tmdbBaseUrl}/tv/${show.tmdb_id}?api_key=${tmdbKey}&append_to_response=watch/providers`
                    const res = await fetch(url)
                    const data = await res.json()
                    if (!data.id) continue

                    const updates: any = {
                        status: data.status,
                        release_date: data.first_air_date || null,
                        platform: getPlatform(data['watch/providers']?.results?.GB),
                        overview: data.overview || show.overview,
                        genre: data.genres?.map((g: any) => g.name).join(', ') || show.genre,
                        runtime: data.episode_run_time?.[0] || show.runtime
                    }
                    if (data.poster_path) updates.poster = `${tmdbImageBaseUrl}${data.poster_path}`

                    await supabase.from('tv_shows').update(updates).eq('id', show.id)

                    // Sync Seasons
                    if (data.seasons) {
                        for (const s of data.seasons) {
                            if (s.season_number === 0 || s.episode_count === 0) continue

                            const { data: dbSeason } = await supabase
                                .from('tv_show_seasons')
                                .upsert(
                                    { tv_show_id: show.id, season_number: s.season_number, release_date: s.air_date || null },
                                    { onConflict: 'tv_show_id,season_number' }
                                )
                                .select()
                                .single()

                            if (dbSeason) {
                                const sUrl = `${tmdbBaseUrl}/tv/${show.tmdb_id}/season/${s.season_number}?api_key=${tmdbKey}`
                                const sRes = await fetch(sUrl)
                                const sData = await sRes.json()
                                if (sData.episodes && sData.episodes.length > 0) {
                                    const eps = sData.episodes.map((v: any) => ({
                                        season_id: dbSeason.id,
                                        episode_number: v.episode_number,
                                        title: v.name,
                                        runtime: v.runtime || data.episode_run_time?.[0] || null,
                                        release_date: v.air_date || null
                                    }))
                                    await supabase.from('tv_show_episodes').upsert(eps, { onConflict: 'season_id,episode_number' })
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error syncing show ${show.title}:`, e)
                }
            }
        }

        console.log('Sync completed successfully')
        return new Response(JSON.stringify({ success: true, message: 'Watchlist sync completed' }), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Critical sync error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
