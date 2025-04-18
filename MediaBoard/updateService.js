class MediaUpdateService {
    constructor() {
        this.lastUpdate = localStorage.getItem('lastUpdateTime');
        this.updateInterval = 1000 * 60 * 60; // 1 hour in milliseconds
    }

    async checkForUpdates(forceCheck = false, checkPlatforms = false, onProgress = null) {
        try {
            const now = new Date();
            const lastUpdate = new Date(localStorage.getItem('lastUpdateCheck') || 0);
            const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);

            if (!forceCheck && hoursSinceLastUpdate < this.updateInterval) {
                console.log(`Skipping update check - last check was ${hoursSinceLastUpdate.toFixed(1)} hours ago`);
                return [];
            }

            console.log('Checking for updates...');
            let changes = [];
            let itemsChecked = 0;

            // Check TV shows first
            const tvShowChanges = await this.checkTVShowUpdates(checkPlatforms, (progress) => {
                if (onProgress) onProgress(itemsChecked + progress);
            });
            changes = changes.concat(tvShowChanges);
            itemsChecked += tvShowChanges.length;

            // Then check movies
            const movieChanges = await this.checkMovieUpdates(checkPlatforms, (progress) => {
                if (onProgress) onProgress(itemsChecked + progress);
            });
            changes = changes.concat(movieChanges);

            // Update last check time
            localStorage.setItem('lastUpdateCheck', now.toISOString());
            console.log('Update check complete');

            return changes;
        } catch (error) {
            console.error('Error checking for updates:', error);
            throw error;
        }
    }

    async checkTVShowUpdates(checkPlatforms = false, onProgress = null) {
        const changes = [];
        const { data: shows } = await this.supabase.from('tv_shows').select('*');
        
        for (let i = 0; i < shows.length; i++) {
            const show = shows[i];
            if (onProgress) onProgress(i);
            
            try {
                // Get current details from TMDB
                const response = await fetch(
                    `${this.tmdbBaseUrl}/tv/${show.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=watch/providers`
                );
                const currentDetails = await response.json();

                // Check status changes
                if (currentDetails.status !== show.status) {
                    await this.supabase
                        .from('tv_shows')
                        .update({ status: currentDetails.status })
                        .eq('id', show.id);
                    changes.push({
                        type: 'tv_show',
                        id: show.id,
                        name: show.name,
                        change: 'status',
                        old: show.status,
                        new: currentDetails.status
                    });
                }

                // Check platform changes if requested
                if (checkPlatforms) {
                    const currentPlatform = this.getBestPlatform(currentDetails['watch/providers']?.results?.GB);
                    if (currentPlatform && currentPlatform !== show.platform) {
                        await this.supabase
                            .from('tv_shows')
                            .update({ platform: currentPlatform })
                            .eq('id', show.id);
                        changes.push({
                            type: 'tv_show',
                            id: show.id,
                            name: show.name,
                            change: 'platform',
                            old: show.platform,
                            new: currentPlatform
                        });
                    }
                }
            } catch (error) {
                console.error(`Error checking updates for TV show ${show.name}:`, error);
            }
        }
        return changes;
    }

    async checkMovieUpdates(checkPlatforms = false, onProgress = null) {
        const changes = [];
        const { data: movies } = await this.supabase.from('movies').select('*');
        
        for (let i = 0; i < movies.length; i++) {
            const movie = movies[i];
            if (onProgress) onProgress(i);
            
            try {
                // Get current details from TMDB
                const response = await fetch(
                    `${this.tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=watch/providers`
                );
                const currentDetails = await response.json();

                // Check platform changes if requested
                if (checkPlatforms) {
                    const currentPlatform = this.getBestPlatform(currentDetails['watch/providers']?.results?.GB);
                    if (currentPlatform && currentPlatform !== movie.platform) {
                        await this.supabase
                            .from('movies')
                            .update({ platform: currentPlatform })
                            .eq('id', movie.id);
                        changes.push({
                            type: 'movie',
                            id: movie.id,
                            name: movie.title,
                            change: 'platform',
                            old: movie.platform,
                            new: currentPlatform
                        });
                    }
                }
            } catch (error) {
                console.error(`Error checking updates for movie ${movie.title}:`, error);
            }
        }
        return changes;
    }

    async searchTMDBID(title, year = null) {
        try {
            // Construct search query
            let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
            if (year) {
                searchUrl += `&year=${year}`;
            }

            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                // Return the first result's ID
                return data.results[0].id;
            }

            return null;
        } catch (error) {
            console.error(`Error searching TMDB for ${title}:`, error);
            return null;
        }
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

    getBestPlatform(providers) {
        try {
            // Log the providers data for debugging
            console.log('Providers data:', providers);

            // Define allowed streaming platforms for UK (matching app.js PLATFORMS)
            const allowedPlatforms = {
                'Netflix': 'Netflix',
                'Disney Plus': 'Disney+',
                'Amazon Prime Video': 'Prime Video',
                'Apple TV': 'Apple TV+',
                'Apple TV Plus': 'Apple TV+',
                'BBC iPlayer': 'BBC iPlayer',
                'BBC Player': 'BBC iPlayer',
                'ITV Hub': 'ITVX',
                'ITVX': 'ITVX'
            };

            // Check UK providers first
            const ukProviders = providers.results?.GB;
            if (!ukProviders) {
                console.log('No UK providers found');
                return 'Online';
            }

            // Combine free and flatrate providers
            const allProviders = [
                ...(ukProviders.free || []),
                ...(ukProviders.flatrate || [])
            ];

            console.log('All UK providers:', allProviders);

            // Check all providers (both free and subscription)
            for (const provider of allProviders) {
                const platformName = allowedPlatforms[provider.provider_name];
                if (platformName) {
                    console.log(`Found matching platform: ${provider.provider_name} -> ${platformName}`);
                    return platformName;
                }
            }

            // If no allowed streaming platforms found, return Online
            console.log('No allowed UK platforms found, defaulting to Online');
            return 'Online';
        } catch (error) {
            console.error('Error in getBestPlatform:', error);
            return 'Online';
        }
    }
} 
