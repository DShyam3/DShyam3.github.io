class MediaUpdateService {
    constructor() {
        this.lastUpdate = localStorage.getItem('lastUpdateTime');
    }

    async checkForUpdates(force = false) {
        const now = new Date();
        const lastUpdate = new Date(this.lastUpdate);
        
        // Check if update is needed
        if (!force && this.lastUpdate) {
            const isSameDay = now.toDateString() === lastUpdate.toDateString();
            const isPast6AM = now.getHours() >= 6;
            const wasBeforeSixAM = lastUpdate.getHours() < 6;
            
            if (isSameDay && (!isPast6AM || !wasBeforeSixAM)) {
                return null;
            }
        }

        const changes = [];
        
        // Update TV Shows
        const { data: tvShows } = await supabase
            .from('tv_shows')
            .select('*, tv_show_seasons(*)');

        if (tvShows) {
            for (const show of tvShows) {
                const updates = await this.checkTVShowUpdates(show);
                if (updates) changes.push(updates);
            }
        }
        
        // Update Movies
        const { data: movies } = await supabase.from('movies').select('*');
        if (movies) {
            for (const movie of movies) {
                const updates = await this.checkMovieUpdates(movie);
                if (updates) changes.push(updates);
            }
        }

        // Store update time
        this.lastUpdate = now.toISOString();
        localStorage.setItem('lastUpdateTime', this.lastUpdate);

        return changes;
    }

    async checkTVShowUpdates(show) {
        if (!show.tmdb_id) {
            console.warn(`No TMDB ID found for show: ${show.title}`);
            return null;
        }

        const response = await fetch(
            `https://api.themoviedb.org/3/tv/${show.tmdb_id}?api_key=${TMDB_API_KEY}`
        );
        const tmdbShow = await response.json();
        
        const changes = [];
        
        // Check status changes
        if (tmdbShow.status !== show.status) {
            changes.push({
                type: 'status',
                old: show.status,
                new: tmdbShow.status
            });
        }
        
        // Check for new seasons
        const newSeasons = tmdbShow.seasons.filter(s => 
            !show.tv_show_seasons.some(existing => 
                existing.season_number === s.season_number
            )
        );
        
        if (newSeasons.length > 0) {
            changes.push({
                type: 'seasons',
                new: newSeasons
            });
            
            // Add new seasons to database
            await this.addNewSeasons(show.id, newSeasons);
        }
        
        // Check platform changes
        const providers = await fetch(
            `https://api.themoviedb.org/3/tv/${show.tmdb_id}/watch/providers?api_key=${TMDB_API_KEY}`
        ).then(res => res.json());
        
        const newPlatform = getBestPlatform(providers);
        if (newPlatform !== show.platform) {
            changes.push({
                type: 'platform',
                old: show.platform,
                new: newPlatform
            });
            
            // Update platform in database
            await supabase
                .from('tv_shows')
                .update({ platform: newPlatform })
                .eq('id', show.id);
        }
        
        return changes.length > 0 ? { id: show.id, title: show.title, changes } : null;
    }

    async checkMovieUpdates(movie) {
        const response = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${TMDB_API_KEY}`
        );
        const tmdbMovie = await response.json();
        
        const changes = [];
        
        // Check platform changes
        const providers = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.tmdb_id}/watch/providers?api_key=${TMDB_API_KEY}`
        ).then(res => res.json());
        
        const newPlatform = getBestPlatform(providers);
        if (newPlatform !== movie.platform) {
            changes.push({
                type: 'platform',
                old: movie.platform,
                new: newPlatform
            });
            
            // Update platform in database
            await supabase
                .from('movies')
                .update({ platform: newPlatform })
                .eq('id', movie.id);
        }
        
        return changes.length > 0 ? { id: movie.id, title: movie.title, changes } : null;
    }

    async addNewSeasons(showId, seasons) {
        for (const season of seasons) {
            const { data: insertedSeason } = await supabase
                .from('tv_show_seasons')
                .insert([{
                    tv_show_id: showId,
                    season_number: season.season_number,
                    release_year: season.air_date ? new Date(season.air_date).getFullYear() : null,
                    watched: false
                }])
                .select()
                .single();
            
            // Fetch and add episodes
            const episodesResponse = await fetch(
                `https://api.themoviedb.org/3/tv/${show.tmdb_id}/season/${season.season_number}?api_key=${TMDB_API_KEY}`
            );
            const seasonDetails = await episodesResponse.json();
            
            const episodesData = seasonDetails.episodes.map(episode => ({
                season_id: insertedSeason.id,
                episode_number: episode.episode_number,
                release_date: episode.air_date,
                watched: false
            }));
            
            await supabase
                .from('tv_show_episodes')
                .insert(episodesData);
        }
    }
} 
