class MediaUpdateService {
    constructor() {
        this.lastUpdate = localStorage.getItem('lastUpdateTime');
        this.updateInterval = 1000 * 60 * 60; // 1 hour in milliseconds
        
        // Initialize Supabase client
        this.supabase = supabase;
        
        // Initialize TMDB configuration
        this.tmdbBaseUrl = 'https://api.themoviedb.org/3';
        this.tmdbApiKey = TMDB_API_KEY;
        
        console.log('UpdateService initialized with configurations');
    }

    async checkForUpdates(forceCheck = false, checkPlatforms = false, onProgress = null) {
        try {
            console.log('Starting update check...');
            console.log('Current configuration:', {
                supabase: !!this.supabase,
                tmdbBaseUrl: this.tmdbBaseUrl,
                tmdbApiKey: this.tmdbApiKey ? 'Set' : 'Not set'
            });
            
            // Verify Supabase connection
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }
            
            // Verify TMDB configuration
            if (!this.tmdbBaseUrl || !this.tmdbApiKey) {
                throw new Error('TMDB configuration not set');
            }

            const now = new Date();
            const lastUpdate = new Date(localStorage.getItem('lastUpdateCheck') || 0);
            const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);

            if (!forceCheck && hoursSinceLastUpdate < this.updateInterval) {
                console.log(`Skipping update check - last check was ${hoursSinceLastUpdate.toFixed(1)} hours ago`);
                return [];
            }

            console.log('Checking for updates...');
            let itemsChecked = 0;

            // Check TV shows for new seasons and status changes
            console.log('Starting TV show updates check...');
            await this.checkTVShowUpdates(false, (progress) => {
                if (onProgress) onProgress(itemsChecked + progress);
            });
            itemsChecked += 1;

            // Check movies for platform changes only
            console.log('Starting movie platform updates check...');
            await this.checkMovieUpdates(true, (progress) => {
                if (onProgress) onProgress(itemsChecked + progress);
            });
            itemsChecked += 1;

            // Update coming soon panel
            console.log('Updating coming soon panel...');
            await this.updateComingSoonPanel();

            // Update last check time
            localStorage.setItem('lastUpdateCheck', now.toISOString());
            console.log('Update check complete');

            return [];
        } catch (error) {
            console.error('Error checking for updates:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                supabase: !!this.supabase,
                tmdbConfig: {
                    baseUrl: !!this.tmdbBaseUrl,
                    apiKey: !!this.tmdbApiKey
                }
            });
            throw error;
        }
    }

    async checkTVShowUpdates(checkPlatforms = false, onProgress = null) {
        const changes = [];
        try {
            // Get all TV shows from Supabase
            const { data: shows, error } = await this.supabase
                .from('tv_shows')
                .select('*');
            
            if (error) {
                console.error('Error fetching TV shows:', error);
                return changes;
            }
            
            if (!shows || shows.length === 0) {
                console.log('No TV shows found in database');
                return changes;
            }

            console.log(`Found ${shows.length} TV shows to check`);
            
            for (let i = 0; i < shows.length; i++) {
                const show = shows[i];
                if (onProgress) onProgress(i);
                
                try {
                    // If no tmdb_id, try to find and update it
                    if (!show.tmdb_id) {
                        console.log(`No TMDB ID found for ${show.title}, searching...`);
                        const tmdbId = await this.searchAndUpdateTMDBID(show);
                        if (!tmdbId) {
                            console.log(`Could not find TMDB ID for ${show.title}, skipping...`);
                            continue;
                        }
                        show.tmdb_id = tmdbId;
                    }

                    console.log(`Checking updates for ${show.title} (TMDB ID: ${show.tmdb_id})`);
                    
                    // Get current details from TMDB
                    const response = await fetch(
                        `${this.tmdbBaseUrl}/tv/${show.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=seasons`
                    );
                    
                    if (!response.ok) {
                        console.error(`TMDB API error for ${show.title}:`, response.status, response.statusText);
                        continue;
                    }
                    
                    const currentDetails = await response.json();

                    // Check status changes
                    if (currentDetails.status !== show.status) {
                        console.log(`Status change detected for ${show.title}: ${show.status} -> ${currentDetails.status}`);
                        await this.supabase
                            .from('tv_shows')
                            .update({ status: currentDetails.status })
                            .eq('id', show.id);
                        changes.push({
                            type: 'tv_show',
                            id: show.id,
                            name: show.title,
                            change: 'status',
                            old: show.status,
                            new: currentDetails.status
                        });
                    }

                    // Check for new seasons and missing episodes
                    if (currentDetails.seasons && currentDetails.seasons.length > 0) {
                        // Get existing seasons from database
                        const { data: existingSeasons } = await this.supabase
                            .from('tv_show_seasons')
                            .select('id, season_number')
                            .eq('tv_show_id', show.id);
                        
                        const existingSeasonNumbers = existingSeasons.map(s => s.season_number);
                        const newSeasons = currentDetails.seasons.filter(season => 
                            !existingSeasonNumbers.includes(season.season_number) && 
                            season.season_number > 0
                        );

                        // Add new seasons if any
                        if (newSeasons.length > 0) {
                            console.log(`Found ${newSeasons.length} new seasons for ${show.title}`);
                            await this.addNewSeasons(show.id, newSeasons, show);
                            changes.push({
                                type: 'tv_show',
                                id: show.id,
                                name: show.title,
                                change: 'new_seasons',
                                details: newSeasons.map(s => `Season ${s.season_number}`)
                            });
                        }

                        // Check for missing episodes in existing seasons
                        for (const season of currentDetails.seasons) {
                            if (season.season_number > 0 && existingSeasonNumbers.includes(season.season_number)) {
                                // Get existing episodes for this season
                                const seasonId = existingSeasons.find(s => s.season_number === season.season_number).id;
                                const { data: existingEpisodes } = await this.supabase
                                    .from('tv_show_episodes')
                                    .select('episode_number')
                                    .eq('season_id', seasonId);

                                const existingEpisodeNumbers = existingEpisodes.map(e => e.episode_number);
                                
                                // Fetch current season details from TMDB
                                const seasonResponse = await fetch(
                                    `${this.tmdbBaseUrl}/tv/${show.tmdb_id}/season/${season.season_number}?api_key=${this.tmdbApiKey}`
                                );
                                
                                if (!seasonResponse.ok) {
                                    console.error(`Error fetching season ${season.season_number} details:`, seasonResponse.status);
                                    continue;
                                }
                                
                                const seasonDetails = await seasonResponse.json();
                                
                                if (seasonDetails.episodes && seasonDetails.episodes.length > 0) {
                                    const missingEpisodes = seasonDetails.episodes.filter(episode => 
                                        !existingEpisodeNumbers.includes(episode.episode_number)
                                    );

                                    if (missingEpisodes.length > 0) {
                                        console.log(`Found ${missingEpisodes.length} missing episodes for ${show.title} Season ${season.season_number}`);
                                        
                                        // Add missing episodes
                                        const episodesData = missingEpisodes.map(episode => ({
                                            season_id: seasonId,
                                            episode_number: episode.episode_number,
                                            release_date: episode.air_date,
                                            watched: false
                                        }));

                                        const { error: episodesError } = await this.supabase
                                            .from('tv_show_episodes')
                                            .insert(episodesData);

                                        if (episodesError) {
                                            console.error(`Error adding missing episodes for season ${season.season_number}:`, episodesError);
                                        } else {
                                            changes.push({
                                                type: 'tv_show',
                                                id: show.id,
                                                name: show.title,
                                                change: 'new_episodes',
                                                details: [`Added ${missingEpisodes.length} episodes to Season ${season.season_number}`]
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error checking updates for TV show ${show.title}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in checkTVShowUpdates:', error);
        }
        return changes;
    }

    async checkMovieUpdates(checkPlatforms = false, onProgress = null) {
        const changes = [];
        try {
            // Get all movies from Supabase
            const { data: movies, error } = await this.supabase
                .from('movies')
                .select('*');
            
            if (error) {
                console.error('Error fetching movies:', error);
                return changes;
            }
            
            if (!movies || movies.length === 0) {
                console.log('No movies found in database');
                return changes;
            }

            console.log(`Found ${movies.length} movies to check`);
            
            for (let i = 0; i < movies.length; i++) {
                const movie = movies[i];
                if (onProgress) onProgress(i);
                
                try {
                    // If no tmdb_id, try to find and update it
                    if (!movie.tmdb_id) {
                        console.log(`No TMDB ID found for ${movie.title}, searching...`);
                        const tmdbId = await this.searchAndUpdateMovieTMDBID(movie);
                        if (!tmdbId) {
                            console.log(`Could not find TMDB ID for ${movie.title}, skipping...`);
                            continue;
                        }
                        movie.tmdb_id = tmdbId;
                        changes.push({
                            type: 'movie',
                            id: movie.id,
                            name: movie.title,
                            change: 'tmdb_id',
                            details: `Added TMDB ID: ${tmdbId}`
                        });
                    }

                    console.log(`Checking updates for ${movie.title} (TMDB ID: ${movie.tmdb_id})`);
                    
                    // Get current details from TMDB
                    const response = await fetch(
                        `${this.tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=watch/providers`
                    );
                    
                    if (!response.ok) {
                        console.error(`TMDB API error for ${movie.title}:`, response.status, response.statusText);
                        continue;
                    }
                    
                    const currentDetails = await response.json();

                    // Check platform changes if requested
                    if (checkPlatforms) {
                        try {
                            const currentPlatform = this.getBestPlatform(currentDetails['watch/providers']);
                            if (currentPlatform && currentPlatform !== movie.platform) {
                                console.log(`Platform change detected for ${movie.title}: ${movie.platform} -> ${currentPlatform}`);
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
                        } catch (platformError) {
                            console.error(`Error checking platform for ${movie.title}:`, platformError);
                        }
                    }
                } catch (error) {
                    console.error(`Error checking updates for movie ${movie.title}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in checkMovieUpdates:', error);
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

    async addNewSeasons(showId, seasons, show) {
        try {
            console.log(`Adding ${seasons.length} new seasons for show ID ${showId}`);
            
            for (const season of seasons) {
                // Get season details from TMDB to get the air date
                const seasonResponse = await fetch(
                    `${this.tmdbBaseUrl}/tv/${show.tmdb_id}/season/${season.season_number}?api_key=${this.tmdbApiKey}`
                );
                
                if (!seasonResponse.ok) {
                    console.error(`Error fetching season ${season.season_number} details:`, seasonResponse.status);
                    continue;
                }
                
                const seasonDetails = await seasonResponse.json();
                
                // Extract air date from season details
                const airDate = seasonDetails.air_date;
                const releaseYear = airDate ? new Date(airDate).getFullYear() : null;
                
                // First add the season
                const { data: insertedSeason, error: seasonError } = await this.supabase
                    .from('tv_show_seasons')
                    .insert([{
                        tv_show_id: showId,
                        season_number: season.season_number,
                        release_year: releaseYear,
                        release_date: airDate,
                        watched: false
                    }])
                    .select()
                    .single();
                
                if (seasonError) {
                    console.error(`Error adding season ${season.season_number}:`, seasonError);
                    continue;
                }
                
                // Then fetch and add episodes for this season
                if (seasonDetails.episodes && seasonDetails.episodes.length > 0) {
                    // Filter out episodes without air dates (not yet released)
                    const episodesWithDates = seasonDetails.episodes.filter(episode => episode.air_date);
                    const episodesWithoutDates = seasonDetails.episodes.filter(episode => !episode.air_date);
                    
                    // Add episodes with known air dates
                    if (episodesWithDates.length > 0) {
                        const episodesData = episodesWithDates.map(episode => ({
                            season_id: insertedSeason.id,
                            episode_number: episode.episode_number,
                            release_date: episode.air_date,
                            watched: false
                        }));
                        
                        const { error: episodesError } = await this.supabase
                            .from('tv_show_episodes')
                            .insert(episodesData);
                        
                        if (episodesError) {
                            console.error(`Error adding episodes for season ${season.season_number}:`, episodesError);
                        } else {
                            console.log(`Added ${episodesData.length} episodes with release dates for season ${season.season_number}`);
                        }
                    }
                    
                    // Add episodes without air dates as upcoming
                    if (episodesWithoutDates.length > 0) {
                        const upcomingEpisodesData = episodesWithoutDates.map(episode => ({
                            season_id: insertedSeason.id,
                            episode_number: episode.episode_number,
                            release_date: null,
                            watched: false
                        }));
                        
                        const { error: upcomingEpisodesError } = await this.supabase
                            .from('tv_show_episodes')
                            .insert(upcomingEpisodesData);
                        
                        if (upcomingEpisodesError) {
                            console.error(`Error adding upcoming episodes for season ${season.season_number}:`, upcomingEpisodesError);
                        } else {
                            console.log(`Added ${upcomingEpisodesData.length} upcoming episodes for season ${season.season_number}`);
                        }
                    }
                } else {
                    console.log(`No episodes found for season ${season.season_number}`);
                }
            }
        } catch (error) {
            console.error('Error in addNewSeasons:', error);
            throw error;
        }
    }

    getBestPlatform(providers) {
        try {
            // Log the providers data for debugging
            console.log('Providers data:', providers);

            // If no providers data, return 'Online'
            if (!providers) {
                console.log('No providers data available');
                return 'Online';
            }

            // Define allowed streaming platforms for UK (matching app.js PLATFORMS exactly)
            const allowedPlatforms = {
                'Netflix': 'Netflix',
                'Disney Plus': 'Disney+',
                'Amazon Prime Video': 'Prime Video',
                'Apple TV': 'Apple TV+',
                'Apple TV Plus': 'Apple TV+',
                'BBC iPlayer': 'BBC iPlayer',
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

    async searchAndUpdateTMDBID(show) {
        try {
            console.log(`Searching TMDB for "${show.title}" (Released: ${show.release_date})...`);
            
            // First try exact title match with release year
            const year = show.release_date ? new Date(show.release_date).getFullYear() : null;
            let searchUrl = `${this.tmdbBaseUrl}/search/tv?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(show.title)}`;
            if (year) {
                searchUrl += `&first_air_date_year=${year}`;
            }
            
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                console.error(`TMDB search error for ${show.title}:`, response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Try to find the best match
                let bestMatch = data.results[0];
                
                // If we have a release date, try to find a better match
                if (show.release_date) {
                    const releaseDate = new Date(show.release_date);
                    const matches = data.results.filter(result => {
                        if (!result.first_air_date) return false;
                        const resultDate = new Date(result.first_air_date);
                        // Allow for some flexibility in the date (up to 1 year difference)
                        return Math.abs(resultDate - releaseDate) < 365 * 24 * 60 * 60 * 1000;
                    });
                    
                    if (matches.length > 0) {
                        bestMatch = matches[0];
                    }
                }
                
                console.log(`Found TMDB ID ${bestMatch.id} for "${show.title}" (First air date: ${bestMatch.first_air_date})`);
                
                // Update the show in the database
                const { error } = await this.supabase
                    .from('tv_shows')
                    .update({ tmdb_id: bestMatch.id })
                    .eq('id', show.id);
                    
                if (error) {
                    console.error(`Error updating TMDB ID for ${show.title}:`, error);
                    return null;
                }
                
                return bestMatch.id;
            }
            
            console.log(`No TMDB results found for "${show.title}"`);
            return null;
        } catch (error) {
            console.error(`Error searching TMDB for ${show.title}:`, error);
            return null;
        }
    }

    async searchAndUpdateMovieTMDBID(movie) {
        try {
            console.log(`Searching TMDB for movie "${movie.title}" (Released: ${movie.release_date})...`);
            
            // First try exact title match with release year
            const year = movie.release_year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null);
            let searchUrl = `${this.tmdbBaseUrl}/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(movie.title)}`;
            if (year) {
                searchUrl += `&year=${year}`;
            }
            
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                console.error(`TMDB search error for ${movie.title}:`, response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // Try to find the best match
                let bestMatch = data.results[0];
                
                // If we have a release date, try to find a better match
                if (movie.release_date) {
                    const releaseDate = new Date(movie.release_date);
                    const matches = data.results.filter(result => {
                        if (!result.release_date) return false;
                        const resultDate = new Date(result.release_date);
                        // Allow for some flexibility in the date (up to 1 year difference)
                        return Math.abs(resultDate - releaseDate) < 365 * 24 * 60 * 60 * 1000;
                    });
                    
                    if (matches.length > 0) {
                        bestMatch = matches[0];
                    }
                }
                
                console.log(`Found TMDB ID ${bestMatch.id} for "${movie.title}" (Release date: ${bestMatch.release_date})`);
                
                // Update the movie in the database
                const { error } = await this.supabase
                    .from('movies')
                    .update({ tmdb_id: bestMatch.id })
                    .eq('id', movie.id);
                    
                if (error) {
                    console.error(`Error updating TMDB ID for ${movie.title}:`, error);
                    return null;
                }
                
                return bestMatch.id;
            }
            
            console.log(`No TMDB results found for "${movie.title}"`);
            return null;
        } catch (error) {
            console.error(`Error searching TMDB for ${movie.title}:`, error);
            return null;
        }
    }

    async updateComingSoonPanel() {
        try {
            // Get all TV shows with release dates
            const { data: shows } = await this.supabase
                .from('tv_shows')
                .select('id, title, release_date')
                .not('release_date', 'is', null);

            const comingSoonItems = [];

            // Process TV shows
            for (const show of shows) {
                if (new Date(show.release_date) > new Date()) {
                    comingSoonItems.push({
                        type: 'tv_show',
                        title: show.title,
                        release_date: show.release_date,
                        media_id: show.id
                    });
                }
            }

            // Get all movies with release dates
            const { data: movies } = await this.supabase
                .from('movies')
                .select('id, title, release_date')
                .not('release_date', 'is', null);

            // Process movies
            for (const movie of movies) {
                if (new Date(movie.release_date) > new Date()) {
                    comingSoonItems.push({
                        type: 'movie',
                        title: movie.title,
                        release_date: movie.release_date,
                        media_id: movie.id
                    });
                }
            }

            // Sort all items by release date
            comingSoonItems.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

            // Update the coming soon panel in the UI
            const comingSoonPanel = document.getElementById('coming-soon-panel');
            if (comingSoonPanel) {
                comingSoonPanel.innerHTML = comingSoonItems.map(item => `
                    <div class="coming-soon-item">
                        <h3>${item.title}</h3>
                        <p>Release Date: ${new Date(item.release_date).toLocaleDateString()}</p>
                        <p>Type: ${item.type === 'tv_show' ? 'TV Show' : 'Movie'}</p>
                    </div>
                `).join('');
            }

            console.log(`Updated coming soon panel with ${comingSoonItems.length} items`);
        } catch (error) {
            console.error('Error in updateComingSoonPanel:', error);
        }
    }
} 
