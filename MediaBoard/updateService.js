class MediaUpdateService {
    constructor() {
        this.lastUpdate = localStorage.getItem('lastUpdateTime');
        
        // Initialize Supabase client
        this.supabase = supabase;
        
        // Initialize TMDB configuration
        this.tmdbBaseUrl = 'https://api.themoviedb.org/3';
        this.tmdbApiKey = TMDB_API_KEY;
        
        // Configuration for batch processing
        this.batchSize = 10; // Process 10 items at once
        this.maxConcurrentRequests = 5; // Max concurrent API calls
        this.rateLimitDelay = 250; // 250ms delay between batches to respect API limits
        
        console.log('UpdateService initialized with configurations');
    }

    // Helper method to process items in parallel with rate limiting
    async processBatchParallel(items, processor, batchSize = this.batchSize, maxConcurrent = this.maxConcurrentRequests, onProgress = null) {
        const results = [];
        const batches = [];
        
        // Split items into batches
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        
        console.log(`Processing ${items.length} items in ${batches.length} batches of ${batchSize} with max ${maxConcurrent} concurrent requests`);
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
            
            // Process batch with limited concurrency
            const batchPromises = batch.map(item => processor(item));
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.error(`Error processing item in batch ${batchIndex + 1}:`, result.reason);
                    results.push(null);
                }
            });
            
            // Update progress after each batch
            if (onProgress) {
                const batchProgress = ((batchIndex + 1) / batches.length) * 100;
                onProgress(Math.round(batchProgress));
            }
            
            // Rate limiting between batches (except for the last batch)
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
            }
        }
        
        return results.filter(result => result !== null);
    }

    // Helper method to batch database operations
    async batchDatabaseOperations(operations, batchSize = 50) {
        const results = [];
        const batches = [];
        
        // Split operations into batches
        for (let i = 0; i < operations.length; i += batchSize) {
            batches.push(operations.slice(i, i + batchSize));
        }
        
        console.log(`Batching ${operations.length} database operations into ${batches.length} batches`);
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`Executing database batch ${batchIndex + 1}/${batches.length}`);
            
            // Execute batch operations concurrently
            const batchPromises = batch.map(operation => operation());
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.error(`Error in database batch ${batchIndex + 1}:`, result.reason);
                    results.push(null);
                }
            });
        }
        
        return results.filter(result => result !== null);
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

            if (!forceCheck && hoursSinceLastUpdate < 1) {
                console.log(`Skipping update check - last check was ${hoursSinceLastUpdate.toFixed(1)} hours ago`);
                return [];
            }

            console.log('Checking for updates...');
            let totalProgress = 0;

            // Check TV shows for new seasons and status changes (parallel processing)
            console.log('Starting TV show updates check with parallel processing...');
            if (onProgress) onProgress(10); // Start at 10%
            
            await this.checkTVShowUpdatesParallel(false, (progress) => {
                if (onProgress) {
                    // TV shows are 30% of total progress (10% to 40%)
                    const tvProgress = 10 + (progress * 0.3);
                    onProgress(Math.round(tvProgress));
                }
            });

            // Fix episodes with missing release dates
            console.log('Fixing episodes with missing release dates...');
            if (onProgress) onProgress(35);
            await this.fixMissingEpisodeDates();

            // Check movies for updates (parallel processing)
            console.log('Starting comprehensive movie updates check with parallel processing...');
            if (onProgress) onProgress(40); // Movies start at 40%
            
            await this.checkMovieUpdatesParallel(true, (progress) => {
                if (onProgress) {
                    // Movies are 50% of total progress (40% to 90%)
                    const movieProgress = 40 + (progress * 0.5);
                    onProgress(Math.round(movieProgress));
                }
            });

            // Update coming soon panel
            console.log('Updating coming soon panel...');
            if (onProgress) onProgress(90);
            await this.updateComingSoonPanel();

            // Check for movies that have been released (parallel processing)
            console.log('Checking for newly released movies with parallel processing...');
            if (onProgress) onProgress(95);
            await this.checkForNewlyReleasedMoviesParallel();

            // Update last check time
            localStorage.setItem('lastUpdateCheck', now.toISOString());
            console.log('Update check complete');
            
            if (onProgress) onProgress(100); // Complete

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

    // Parallel version of TV show updates
    async checkTVShowUpdatesParallel(checkPlatforms = false, onProgress = null) {
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
                if (onProgress) onProgress(100);
                return changes;
            }

            console.log(`Found ${shows.length} TV shows to check with parallel processing`);
            
            // Process TV shows in parallel batches with progress tracking
            const results = await this.processBatchParallel(
                shows,
                async (show) => {
                    try {
                        return await this.processSingleTVShow(show, checkPlatforms);
                    } catch (error) {
                        console.error(`Error processing TV show ${show.title}:`, error);
                        return null;
                    }
                },
                this.batchSize,
                this.maxConcurrentRequests,
                onProgress
            );
            
            // Collect all changes
            results.forEach(result => {
                if (result && result.changes) {
                    changes.push(...result.changes);
                }
            });
            
        } catch (error) {
            console.error('Error in checkTVShowUpdatesParallel:', error);
        }
        
        console.log(`TV show updates completed: ${changes.length} changes detected`);
        return changes;
    }

    // Process a single TV show (extracted for parallel processing)
    async processSingleTVShow(show, checkPlatforms) {
        const changes = [];
        
        try {
            // If no tmdb_id, try to find and update it
            if (!show.tmdb_id) {
                console.log(`No TMDB ID found for ${show.title}, searching...`);
                const tmdbId = await this.searchAndUpdateTMDBID(show);
                if (!tmdbId) {
                    console.log(`Could not find TMDB ID for ${show.title}, skipping...`);
                    return { changes: [] };
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
                return { changes: [] };
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
                const seasonChanges = await this.processTVShowSeasons(show, currentDetails);
                changes.push(...seasonChanges);
            }
            
        } catch (error) {
            console.error(`Error checking updates for TV show ${show.title}:`, error);
        }
        
        return { changes };
    }

    // Process TV show seasons (extracted for better organization)
    async processTVShowSeasons(show, currentDetails) {
        const changes = [];
        
        try {
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
            const episodeChanges = await this.processExistingSeasons(show, currentDetails, existingSeasons);
            changes.push(...episodeChanges);
            
        } catch (error) {
            console.error(`Error processing seasons for ${show.title}:`, error);
        }
        
        return changes;
    }

    // Process existing seasons for missing episodes
    async processExistingSeasons(show, currentDetails, existingSeasons) {
        const changes = [];
        
        try {
            for (const season of currentDetails.seasons) {
                if (season.season_number > 0 && existingSeasons.some(s => s.season_number === season.season_number)) {
                    const seasonId = existingSeasons.find(s => s.season_number === season.season_number).id;
                    
                    // Get existing episodes for this season
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
                                release_date: episode.air_date && episode.air_date !== 'N/A' ? episode.air_date : null,
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
        } catch (error) {
            console.error(`Error processing existing seasons for ${show.title}:`, error);
        }
        
        return changes;
    }

    // Parallel version of movie updates
    async checkMovieUpdatesParallel(checkPlatforms = false, onProgress = null) {
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
                if (onProgress) onProgress(100);
                return changes;
            }

            console.log(`Found ${movies.length} movies to check with parallel processing`);
            
            // Process movies in parallel batches with progress tracking
            const results = await this.processBatchParallel(
                movies,
                async (movie) => {
                    try {
                        return await this.processSingleMovie(movie, checkPlatforms);
                    } catch (error) {
                        console.error(`Error processing movie ${movie.title}:`, error);
                        return null;
                    }
                },
                this.batchSize,
                this.maxConcurrentRequests,
                onProgress
            );
            
            // Collect all changes
            results.forEach(result => {
                if (result && result.changes) {
                    changes.push(...result.changes);
                }
            });
            
        } catch (error) {
            console.error('Error in checkMovieUpdatesParallel:', error);
        }
        
        // Log summary of changes
        if (changes.length > 0) {
            console.log(`Movie update summary: ${changes.length} changes detected`);
            changes.forEach(change => {
                console.log(`  - ${change.name}: ${change.change} ${change.old ? `(${change.old} → ${change.new})` : ''}`);
            });
        } else {
            console.log('No movie updates detected');
        }
        
        return changes;
    }

    // Process a single movie (extracted for parallel processing)
    async processSingleMovie(movie, checkPlatforms) {
        const changes = [];
        
        try {
            // If no tmdb_id, try to find and update it
            if (!movie.tmdb_id) {
                console.log(`No TMDB ID found for ${movie.title}, searching...`);
                const tmdbId = await this.searchAndUpdateMovieTMDBID(movie);
                if (!tmdbId) {
                    console.log(`Could not find TMDB ID for ${movie.title}, skipping...`);
                    return { changes: [] };
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
            
            // Special logging for The Old Guard 2 to debug poster issues
            if (movie.title.toLowerCase().includes('old guard')) {
                console.log(`🔍 Special debug for ${movie.title}:`);
                console.log(`  Current poster: ${movie.poster}`);
                console.log(`  Has TMDB ID: ${!!movie.tmdb_id}`);
                console.log(`  Release date: ${movie.release_date}`);
            }
            
            // Get current details from TMDB
            const response = await fetch(
                `${this.tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=watch/providers`
            );
            
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`TMDB API rate limit reached for ${movie.title}, waiting before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    return { changes: [] };
                }
                console.error(`TMDB API error for ${movie.title}:`, response.status, response.statusText);
                return { changes: [] };
            }
            
            const currentDetails = await response.json();
            
            // Validate the response
            if (!currentDetails || currentDetails.success === false) {
                console.error(`Invalid TMDB response for ${movie.title}:`, currentDetails);
                return { changes: [] };
            }
            
            // Special logging for The Old Guard 2 to debug poster issues
            if (movie.title.toLowerCase().includes('old guard')) {
                console.log(`🔍 TMDB data for ${movie.title}:`);
                console.log(`  TMDB poster_path: ${currentDetails.poster_path}`);
                console.log(`  TMDB release_date: ${currentDetails.release_date}`);
                console.log(`  TMDB overview: ${currentDetails.overview ? currentDetails.overview.substring(0, 100) + '...' : 'None'}`);
            }

            // Check for movie data updates
            const updateData = {};
            let hasUpdates = false;

            // Enhanced title updates - always update if TMDB has data
            if (currentDetails.title) {
                if (currentDetails.title !== movie.title) {
                    console.log(`Title update detected for ${movie.title}: ${movie.title} → ${currentDetails.title}`);
                    updateData.title = currentDetails.title;
                    hasUpdates = true;
                    changes.push({
                        type: 'movie',
                        id: movie.id,
                        name: movie.title,
                        change: 'title',
                        old: movie.title,
                        new: currentDetails.title
                    });
                }
            }

            // Enhanced overview updates - always update if TMDB has data
            if (currentDetails.overview) {
                if (currentDetails.overview !== movie.overview) {
                    console.log(`Overview update detected for ${movie.title}`);
                    updateData.overview = currentDetails.overview;
                    hasUpdates = true;
                    changes.push({
                        type: 'movie',
                        id: movie.id,
                        name: movie.title,
                        change: 'overview',
                        details: 'Overview updated'
                    });
                }
            }

            // Enhanced release date handling - always update if TMDB has better data
            if (currentDetails.release_date) {
                const shouldUpdateReleaseDate = 
                    !movie.release_date || // No existing release date
                    movie.release_date !== currentDetails.release_date || // Different release date
                    movie.release_year !== new Date(currentDetails.release_date).getFullYear(); // Different year
                
                if (shouldUpdateReleaseDate) {
                    updateData.release_date = currentDetails.release_date;
                    updateData.release_year = new Date(currentDetails.release_date).getFullYear();
                    hasUpdates = true;
                    
                    // Log release date changes for tracking
                    if (movie.release_date && movie.release_date !== currentDetails.release_date) {
                        console.log(`Release date change detected for ${movie.title}: ${movie.release_date} → ${currentDetails.release_date}`);
                        changes.push({
                            type: 'movie',
                            id: movie.id,
                            name: movie.title,
                            change: 'release_date',
                            old: movie.release_date,
                            new: currentDetails.release_date
                        });
                    } else if (!movie.release_date) {
                        console.log(`New release date found for ${movie.title}: ${currentDetails.release_date}`);
                        changes.push({
                            type: 'movie',
                            id: movie.id,
                            name: movie.title,
                            change: 'release_date',
                            old: 'none',
                            new: currentDetails.release_date
                        });
                    }
                }
            }

            // Enhanced poster updates - always update if we have missing/bad poster data
            if (currentDetails.poster_path) {
                const newPosterUrl = `https://image.tmdb.org/t/p/w500${currentDetails.poster_path}`;
                const shouldUpdatePoster = 
                    !movie.poster || 
                    movie.poster === 'placeholder.jpg' || 
                    movie.poster.includes('placeholder') ||
                    movie.poster.includes('THE OLD GUARD 2') ||
                    movie.poster === 'null' ||
                    movie.poster === '' ||
                    movie.poster.includes('undefined');
                
                if (shouldUpdatePoster) {
                    console.log(`Poster update detected for ${movie.title}`);
                    console.log(`  Old poster: ${movie.poster || 'none'}`);
                    console.log(`  New poster: ${newPosterUrl}`);
                    updateData.poster = newPosterUrl;
                    hasUpdates = true;
                    changes.push({
                        type: 'movie',
                        id: movie.id,
                        name: movie.title,
                        change: 'poster',
                        details: 'Poster updated'
                    });
                }
            }

            // Runtime updates removed - field not available in database

            // Check release status changes (from coming soon to released)
            const currentReleaseDate = currentDetails.release_date ? new Date(currentDetails.release_date) : null;
            const isCurrentlyReleased = currentReleaseDate && currentReleaseDate <= new Date();
            const wasComingSoon = movie.release_date && new Date(movie.release_date) > new Date();
            
            if (wasComingSoon && isCurrentlyReleased) {
                console.log(`Release status change detected for ${movie.title}: Coming Soon -> Released`);
                // Update the status field now that we have it
                updateData.status = 'released';
                hasUpdates = true;
                changes.push({
                    type: 'movie',
                    id: movie.id,
                    name: movie.title,
                    change: 'release_status',
                    old: 'coming_soon',
                    new: 'released',
                    details: 'Movie has been released'
                });
            }
            
            // Also update status for movies that are still coming soon
            if (currentReleaseDate && currentReleaseDate > new Date()) {
                if (movie.status !== 'coming_soon') {
                    updateData.status = 'coming_soon';
                    hasUpdates = true;
                    changes.push({
                        type: 'movie',
                        id: movie.id,
                        name: movie.title,
                        change: 'status',
                        old: movie.status || 'unknown',
                        new: 'coming_soon',
                        details: 'Movie marked as coming soon'
                    });
                }
            }

            // Additional TMDB fields are not included to avoid database schema issues
            // Focus on core fields: title, overview, release_date, poster, runtime, status, platform

            // Update the movie if there are any changes
            if (hasUpdates) {
                console.log(`Updating movie ${movie.title} with new data:`, updateData);
                console.log(`Update summary for ${movie.title}:`);
                Object.keys(updateData).forEach(key => {
                    console.log(`  - ${key}: ${updateData[key]}`);
                });
                
                const { error: updateError } = await this.supabase
                    .from('movies')
                    .update(updateData)
                    .eq('id', movie.id);
                
                if (updateError) {
                    console.error(`Error updating movie ${movie.title}:`, updateError);
                } else {
                    console.log(`Successfully updated ${movie.title}`);
                }
            }

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
        
        return { changes };
    }

    async searchTMDBID(title, year = null) {
        try {
            // Construct search query
            let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(title)}`;
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
                const releaseYear = airDate && airDate !== 'N/A' ? new Date(airDate).getFullYear() : null;
                
                // Handle N/A release dates by setting to null
                const processedAirDate = airDate && airDate !== 'N/A' ? airDate : null;
                
                // First add the season
                const { data: insertedSeason, error: seasonError } = await this.supabase
                    .from('tv_show_seasons')
                    .insert([{
                        tv_show_id: showId,
                        season_number: season.season_number,
                        release_year: releaseYear,
                        release_date: processedAirDate,
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
                            release_date: episode.air_date && episode.air_date !== 'N/A' ? episode.air_date : null,
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
                    
                    // Add episodes without air dates as upcoming (TBA)
                    if (episodesWithoutDates.length > 0) {
                        const upcomingEpisodesData = episodesWithoutDates.map(episode => ({
                            season_id: insertedSeason.id,
                            episode_number: episode.episode_number,
                            release_date: null, // Will show as TBA
                            watched: false
                        }));
                        
                        const { error: upcomingEpisodesError } = await this.supabase
                            .from('tv_show_episodes')
                            .insert(upcomingEpisodesData);
                        
                        if (upcomingEpisodesError) {
                            console.error(`Error adding upcoming episodes for season ${season.season_number}:`, upcomingEpisodesError);
                        } else {
                            console.log(`Added ${upcomingEpisodesData.length} upcoming episodes for season ${season.season_number} (will show as TBA)`);
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

    // Parallel version of newly released movies check
    async checkForNewlyReleasedMoviesParallel(onProgress = null) {
        try {
            console.log('Checking for movies that have been released with parallel processing...');
            
            // Get all movies that have future release dates (since they might not have a status field)
            const { data: comingSoonMovies, error } = await this.supabase
                .from('movies')
                .select('*')
                .gt('release_date', new Date().toISOString().split('T')[0]);
            
            if (error) {
                console.error('Error fetching coming soon movies:', error);
                return;
            }
            
            if (!comingSoonMovies || comingSoonMovies.length === 0) {
                console.log('No coming soon movies found');
                if (onProgress) onProgress(100);
                return;
            }

            console.log(`Found ${comingSoonMovies.length} movies to check for release status with parallel processing`);
            
            // Process movies in parallel batches with progress tracking
            const results = await this.processBatchParallel(
                comingSoonMovies,
                async (movie) => {
                    try {
                        if (!movie.tmdb_id) return null;
                        
                        // Get current details from TMDB
                        const response = await fetch(
                            `${this.tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${this.tmdbApiKey}`
                        );
                        
                        if (!response.ok) {
                            if (response.status === 429) {
                                console.warn(`TMDB API rate limit reached for ${movie.title}, waiting before retry...`);
                                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                                return null; // Skip this movie for now
                            }
                            return null;
                        }
                        
                        const currentDetails = await response.json();
                        
                        // Validate the response
                        if (!currentDetails || currentDetails.success === false) {
                            console.error(`Invalid TMDB response for ${movie.title}:`, currentDetails);
                            return null;
                        }
                        
                        // Check if the movie has been released
                        if (currentDetails.release_date) {
                            const releaseDate = new Date(currentDetails.release_date);
                            const now = new Date();
                            
                            if (releaseDate <= now) {
                                console.log(`Movie ${movie.title} has been released!`);
                                
                                // Update the movie with release information
                                const updateData = {
                                    release_date: currentDetails.release_date
                                };
                                
                                // Only add status if the field exists in the database
                                // For now, we'll just update the release date to reflect current reality
                                
                                // Update poster if available and we don't have one
                                if (currentDetails.poster_path && (!movie.poster || movie.poster === 'placeholder.jpg')) {
                                    updateData.poster = `https://image.tmdb.org/t/p/w500${currentDetails.poster_path}`;
                                }
                                
                                // Update overview if available
                                if (currentDetails.overview && currentDetails.overview !== movie.overview) {
                                    updateData.overview = currentDetails.overview;
                                }
                                
                                // Update runtime if available
                                if (currentDetails.runtime && currentDetails.runtime !== movie.runtime) {
                                    updateData.runtime = currentDetails.runtime;
                                }
                                
                                // Update the movie in the database
                                const { error: updateError } = await this.supabase
                                    .from('movies')
                                    .update(updateData)
                                    .eq('id', movie.id);
                                
                                if (updateError) {
                                    console.error(`Error updating released movie ${movie.title}:`, updateError);
                                    return false;
                                } else {
                                    console.log(`Successfully updated ${movie.title} as released`);
                                    return true;
                                }
                            }
                        }
                        
                        return null; // No update needed
                    } catch (error) {
                        console.error(`Error checking release status for ${movie.title}:`, error);
                        return null;
                    }
                },
                this.batchSize,
                this.maxConcurrentRequests,
                onProgress
            );
            
            const updatedCount = results.filter(result => result === true).length;
            console.log(`Newly released movies check completed: ${updatedCount} movies updated`);
            
        } catch (error) {
            console.error('Error in checkForNewlyReleasedMoviesParallel:', error);
        }
    }

    // Configuration method to adjust batch processing settings
    configureBatchProcessing(batchSize = 10, maxConcurrent = 5, rateLimitDelay = 250) {
        this.batchSize = batchSize;
        this.maxConcurrentRequests = maxConcurrent;
        this.rateLimitDelay = rateLimitDelay;
        
        console.log(`Batch processing configured: batchSize=${batchSize}, maxConcurrent=${maxConcurrent}, rateLimitDelay=${rateLimitDelay}ms`);
    }

    // Fix episodes with missing release dates
    async fixMissingEpisodeDates() {
        try {
            console.log('🔧 Starting fix for episodes with missing release dates...');
            
            // Get all episodes with null or missing release dates
            // This includes episodes that show as "TBA" in the UI (null values)
            console.log('🔍 Querying for episodes with missing release dates...');
            
            const { data: episodesWithMissingDates, error: fetchError } = await this.supabase
                .from('tv_show_episodes')
                .select(`
                    id,
                    episode_number,
                    release_date,
                    season_id,
                    tv_show_seasons!inner(
                        id,
                        season_number,
                        tv_show_id,
                        tv_shows!inner(
                            id,
                            title,
                            tmdb_id
                        )
                    )
                `)
                .is('release_date', null);
            
            // Also check for episodes with empty string or "N/A" values
            const { data: episodesWithEmptyDates } = await this.supabase
                .from('tv_show_episodes')
                .select(`
                    id,
                    episode_number,
                    release_date,
                    season_id,
                    tv_show_seasons!inner(
                        id,
                        season_number,
                        tv_show_id,
                        tv_shows!inner(
                            id,
                            title,
                            tmdb_id
                        )
                    )
                `)
                .or('release_date.eq.N/A,release_date.eq.,release_date.eq."",release_date.eq."null"');
            
            // Combine both results
            const allMissingEpisodes = [
                ...(episodesWithMissingDates || []),
                ...(episodesWithEmptyDates || [])
            ];
            
            // Remove duplicates based on episode ID
            const uniqueMissingEpisodes = allMissingEpisodes.filter((episode, index, self) => 
                index === self.findIndex(e => e.id === episode.id)
            );
            
            if (fetchError) {
                console.error('Error fetching episodes with missing dates:', fetchError);
                return;
            }
            
            if (!uniqueMissingEpisodes || uniqueMissingEpisodes.length === 0) {
                console.log('✅ No episodes with missing release dates found');
                return;
            }
            
            console.log(`🔍 Found ${uniqueMissingEpisodes.length} episodes with missing release dates`);
            
            // Debug: Show what we found
            uniqueMissingEpisodes.forEach(ep => {
                console.log(`  - ${ep.tv_show_seasons.tv_shows.title} S${ep.tv_show_seasons.season_number}E${ep.episode_number}: ${ep.release_date || 'null'}`);
            });
            
            // Group episodes by TV show for efficient processing
            const episodesByShow = new Map();
            uniqueMissingEpisodes.forEach(episode => {
                const showId = episode.tv_show_seasons.tv_shows.id;
                if (!episodesByShow.has(showId)) {
                    episodesByShow.set(showId, {
                        show: episode.tv_show_seasons.tv_shows,
                        episodes: []
                    });
                }
                episodesByShow.get(showId).episodes.push(episode);
            });
            
            let totalFixed = 0;
            let totalErrors = 0;
            let totalSkipped = 0;
            
            // Process each TV show
            for (const [showId, showData] of episodesByShow) {
                try {
                    const { show, episodes } = showData;
                    
                    if (!show.tmdb_id) {
                        console.log(`⚠️  No TMDB ID for ${show.title}, skipping...`);
                        continue;
                    }
                    
                    console.log(`🎬 Fixing episodes for ${show.title}...`);
                    
                    // Get fresh episode data from TMDB
                    const seasonNumbers = [...new Set(episodes.map(ep => ep.tv_show_seasons.season_number))];
                    
                    for (const seasonNumber of seasonNumbers) {
                        try {
                            const seasonResponse = await fetch(
                                `${this.tmdbBaseUrl}/tv/${show.tmdb_id}/season/${seasonNumber}?api_key=${this.tmdbApiKey}`
                            );
                            
                            if (!seasonResponse.ok) {
                                console.error(`❌ Error fetching season ${seasonNumber} for ${show.title}:`, seasonResponse.status);
                                continue;
                            }
                            
                            const seasonDetails = await seasonResponse.json();
                            
                            if (!seasonDetails.episodes || seasonDetails.episodes.length === 0) {
                                console.log(`⚠️  No episodes found for ${show.title} Season ${seasonNumber}`);
                                continue;
                            }
                            
                            // Find episodes that need fixing
                            const seasonEpisodes = episodes.filter(ep => ep.tv_show_seasons.season_number === seasonNumber);
                            
                            for (const episode of seasonEpisodes) {
                                const tmdbEpisode = seasonDetails.episodes.find(
                                    tmdbEp => tmdbEp.episode_number === episode.episode_number
                                );
                                
                                if (tmdbEpisode && tmdbEpisode.air_date) {
                                    // Update the episode with the correct release date from TMDB
                                    const { error: updateError } = await this.supabase
                                        .from('tv_show_episodes')
                                        .update({ release_date: tmdbEpisode.air_date })
                                        .eq('id', episode.id);
                                    
                                    if (updateError) {
                                        console.error(`❌ Error updating episode ${episode.episode_number} for ${show.title}:`, updateError);
                                        totalErrors++;
                                    } else {
                                        console.log(`✅ Fixed episode ${episode.episode_number} for ${show.title}: ${tmdbEpisode.air_date}`);
                                        totalFixed++;
                                    }
                                } else {
                                    // No air date available on TMDB - leave as TBA
                                    console.log(`⚠️  No air date found for ${show.title} Season ${seasonNumber} Episode ${episode.episode_number} - leaving as TBA`);
                                    totalSkipped++;
                                }
                            }
                            
                        } catch (seasonError) {
                            console.error(`❌ Error processing season ${seasonNumber} for ${show.title}:`, seasonError);
                            totalErrors++;
                        }
                    }
                    
                } catch (showError) {
                    console.error(`❌ Error processing show ${showData.show.title}:`, showError);
                    totalErrors++;
                }
            }
            
            console.log(`🎉 Episode date fix completed: ${totalFixed} episodes fixed, ${totalErrors} errors, ${totalSkipped} skipped (likely first episodes without TMDB data)`);
            
        } catch (error) {
            console.error('💥 Error in fixMissingEpisodeDates:', error);
        }
    }


    // Debug function to check what episodes have missing dates
    async debugMissingEpisodes() {
        try {
            console.log('🔍 Debugging missing episodes...');
            
            // Get all episodes to see what we have
            const { data: allEpisodes } = await this.supabase
                .from('tv_show_episodes')
                .select(`
                    id,
                    episode_number,
                    release_date,
                    tv_show_seasons!inner(
                        season_number,
                        tv_shows!inner(
                            title,
                            tmdb_id
                        )
                    )
                `)
                .order('tv_show_seasons.tv_shows.title, tv_show_seasons.season_number, episode_number');
            
            if (!allEpisodes) {
                console.log('❌ No episodes found');
                return;
            }
            
            console.log(`📊 Total episodes in database: ${allEpisodes.length}`);
            
            // Categorize episodes
            const episodesWithDates = allEpisodes.filter(ep => ep.release_date && ep.release_date !== 'N/A');
            const episodesWithoutDates = allEpisodes.filter(ep => !ep.release_date || ep.release_date === 'N/A');
            
            console.log(`✅ Episodes with dates: ${episodesWithDates.length}`);
            console.log(`❌ Episodes without dates: ${episodesWithoutDates.length}`);
            
            if (episodesWithoutDates.length > 0) {
                console.log('\n📋 Episodes without dates:');
                episodesWithoutDates.forEach(ep => {
                    console.log(`  - ${ep.tv_show_seasons.tv_shows.title} S${ep.tv_show_seasons.season_number}E${ep.episode_number}: "${ep.release_date || 'null'}"`);
                });
            }
            
            // Check for episodes that should be fixable
            const fixableEpisodes = episodesWithoutDates.filter(ep => ep.tv_show_seasons.tv_shows.tmdb_id);
            console.log(`\n🔧 Episodes that can be fixed (have TMDB ID): ${fixableEpisodes.length}`);
            
            return {
                total: allEpisodes.length,
                withDates: episodesWithDates.length,
                withoutDates: episodesWithoutDates.length,
                fixable: fixableEpisodes.length
            };
            
        } catch (error) {
            console.error('💥 Error in debugMissingEpisodes:', error);
        }
    }

    // Manual fix function for debugging specific episodes
    async fixSpecificEpisode(showTitle, seasonNumber, episodeNumber) {
        try {
            console.log(`🔧 Manually fixing ${showTitle} S${seasonNumber}E${episodeNumber}...`);
            
            // Find the show
            const { data: shows } = await this.supabase
                .from('tv_shows')
                .select('id, title, tmdb_id')
                .ilike('title', `%${showTitle}%`);
            
            if (!shows || shows.length === 0) {
                console.log(`❌ Show "${showTitle}" not found`);
                return;
            }
            
            const show = shows[0];
            console.log(`📺 Found show: ${show.title} (TMDB ID: ${show.tmdb_id})`);
            
            // Find the season
            const { data: seasons } = await this.supabase
                .from('tv_show_seasons')
                .select('id, season_number, release_date')
                .eq('tv_show_id', show.id)
                .eq('season_number', seasonNumber);
            
            if (!seasons || seasons.length === 0) {
                console.log(`❌ Season ${seasonNumber} not found for ${show.title}`);
                return;
            }
            
            const season = seasons[0];
            console.log(`📅 Found season: ${season.season_number} (Release date: ${season.release_date})`);
            
            // Find the episode
            const { data: episodes } = await this.supabase
                .from('tv_show_episodes')
                .select('id, episode_number, release_date')
                .eq('season_id', season.id)
                .eq('episode_number', episodeNumber);
            
            if (!episodes || episodes.length === 0) {
                console.log(`❌ Episode ${episodeNumber} not found for ${show.title} Season ${seasonNumber}`);
                return;
            }
            
            const episode = episodes[0];
            console.log(`🎬 Found episode: ${episode.episode_number} (Current date: ${episode.release_date || 'null'})`);
            
            // Try to get the date from TMDB
            const seasonResponse = await fetch(
                `${this.tmdbBaseUrl}/tv/${show.tmdb_id}/season/${seasonNumber}?api_key=${this.tmdbApiKey}`
            );
            
            if (!seasonResponse.ok) {
                console.log(`❌ Could not fetch season data from TMDB: ${seasonResponse.status}`);
                return;
            }
            
            const seasonDetails = await seasonResponse.json();
            console.log(`📊 Season air date from TMDB: ${seasonDetails.air_date}`);
            
            // Try to find the specific episode
            const tmdbEpisode = seasonDetails.episodes?.find(ep => ep.episode_number === episodeNumber);
            console.log(`🎬 TMDB episode data:`, tmdbEpisode);
            
            let newDate = null;
            
            if (tmdbEpisode && tmdbEpisode.air_date) {
                newDate = tmdbEpisode.air_date;
                console.log(`✅ Found episode air date from TMDB: ${newDate}`);
            } else if (episodeNumber === 1 && seasonDetails.air_date) {
                newDate = seasonDetails.air_date;
                console.log(`💡 Using season air date for first episode: ${newDate}`);
            } else {
                console.log(`⚠️  No air date available from TMDB`);
                return;
            }
            
            // Update the episode
            const { error: updateError } = await this.supabase
                .from('tv_show_episodes')
                .update({ release_date: newDate })
                .eq('id', episode.id);
            
            if (updateError) {
                console.error(`❌ Error updating episode:`, updateError);
            } else {
                console.log(`✅ Successfully updated episode to: ${newDate}`);
            }
            
        } catch (error) {
            console.error('💥 Error in fixSpecificEpisode:', error);
        }
    }

    // Keep original methods for backward compatibility
    async checkTVShowUpdates(checkPlatforms = false, onProgress = null) {
        console.log('Using legacy sequential TV show updates. Consider using checkTVShowUpdatesParallel for better performance.');
        return this.checkTVShowUpdatesParallel(checkPlatforms, onProgress);
    }

    async checkMovieUpdates(checkPlatforms = false, onProgress = null) {
        console.log('Using legacy sequential movie updates. Consider using checkMovieUpdatesParallel for better performance.');
        return this.checkMovieUpdatesParallel(checkPlatforms, onProgress);
    }

    async checkForNewlyReleasedMovies() {
        console.log('Using legacy sequential newly released movies check. Consider using checkForNewlyReleasedMoviesParallel for better performance.');
        return this.checkForNewlyReleasedMoviesParallel();
    }

    // Enhanced method for comprehensive movie refresh with parallel processing
    async refreshAllMoviesParallel(onProgress = null) {
        try {
            console.log('🚀 Starting comprehensive movie refresh with parallel processing...');
            
            // Get all movies from database
            const { data: movies, error } = await this.supabase
                .from('movies')
                .select('*');
            
            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }
            
            if (!movies || movies.length === 0) {
                console.log('✅ No movies found to refresh');
                if (onProgress) onProgress(100);
                return { updated: 0, errors: 0, total: 0 };
            }

            console.log(`📊 Found ${movies.length} movies to refresh with parallel processing`);
            
            // Process movies using the parallel batch processor with progress tracking
            const results = await this.processBatchParallel(
                movies,
                async (movie) => {
                    try {
                        return await this.refreshSingleMovie(movie);
                    } catch (error) {
                        console.error(`Error refreshing ${movie.title}:`, error);
                        return false;
                    }
                },
                this.batchSize,
                this.maxConcurrentRequests,
                onProgress
            );
            
            // Count results
            const totalUpdated = results.filter(result => result === true).length;
            const totalErrors = results.filter(result => result === false).length;
            
            console.log('\n🎉 Comprehensive movie refresh completed!');
            console.log(`📈 Summary: ${totalUpdated} updated, ${totalErrors} errors out of ${movies.length} total`);
            
            return {
                updated: totalUpdated,
                errors: totalErrors,
                total: movies.length
            };
            
        } catch (error) {
            console.error('💥 Fatal error in comprehensive movie refresh:', error);
            throw error;
        }
    }

    // Bulk database operations for better performance
    async bulkUpdateMovies(updates) {
        try {
            if (!updates || updates.length === 0) {
                console.log('No updates to process');
                return { success: 0, errors: 0 };
            }

            console.log(`Processing ${updates.length} bulk movie updates...`);
            
            // Group updates by movie ID for efficiency
            const updateMap = new Map();
            updates.forEach(update => {
                if (!updateMap.has(update.id)) {
                    updateMap.set(update.id, {});
                }
                Object.assign(updateMap.get(update.id), update.data);
            });

            // Convert to array of update operations
            const updateOperations = Array.from(updateMap.entries()).map(([id, data]) => 
                () => this.supabase
                    .from('movies')
                    .update(data)
                    .eq('id', id)
            );

            // Execute updates in batches
            const results = await this.batchDatabaseOperations(updateOperations);
            
            const successCount = results.filter(result => result !== null).length;
            const errorCount = results.length - successCount;
            
            console.log(`Bulk update completed: ${successCount} successful, ${errorCount} errors`);
            
            return {
                success: successCount,
                errors: errorCount
            };
            
        } catch (error) {
            console.error('Error in bulk update:', error);
            throw error;
        }
    }

    // Performance monitoring method
    async measureUpdatePerformance(operation, ...args) {
        const startTime = performance.now();
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        try {
            const result = await operation.apply(this, args);
            const endTime = performance.now();
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            
            const duration = endTime - startTime;
            const memoryUsed = endMemory - startMemory;
            
            console.log(`⏱️  Performance metrics for ${operation.name}:`);
            console.log(`   Duration: ${duration.toFixed(2)}ms`);
            if (performance.memory) {
                console.log(`   Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
            }
            
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ Operation ${operation.name} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
            throw error;
        }
    }

    // Keep original methods for backward compatibility
    async refreshAllMovies() {
        console.log('Using legacy sequential comprehensive movie refresh. Consider using refreshAllMoviesParallel for better performance.');
        return this.refreshAllMoviesParallel();
    }

    async refreshSingleMovie(movie) {
        try {
            console.log(`\n🎬 Refreshing: ${movie.title}`);
            
            // Get current details from TMDB
            if (!movie.tmdb_id) {
                console.log(`  ❌ No TMDB ID for ${movie.title}, skipping...`);
                return false;
            }
            
            const response = await fetch(
                `${this.tmdbBaseUrl}/movie/${movie.tmdb_id}?api_key=${this.tmdbApiKey}&append_to_response=watch/providers`
            );
            
            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`  ⚠️  TMDB API rate limit reached for ${movie.title}`);
                    return false;
                }
                console.error(`  ❌ TMDB API error for ${movie.title}: ${response.status}`);
                return false;
            }
            
            const currentDetails = await response.json();
            
            if (!currentDetails || currentDetails.success === false) {
                console.error(`  ❌ Invalid TMDB response for ${movie.title}`);
                return false;
            }
            
            // Use the same enhanced update logic
            const updateData = {};
            let hasUpdates = false;
            
            // Enhanced title updates - always update if TMDB has data
            if (currentDetails.title) {
                if (currentDetails.title !== movie.title) {
                    updateData.title = currentDetails.title;
                    hasUpdates = true;
                }
            }
            
            // Enhanced overview updates - always update if TMDB has data
            if (currentDetails.overview) {
                if (currentDetails.overview !== movie.overview) {
                    updateData.overview = currentDetails.overview;
                    hasUpdates = true;
                }
            }
            
            // Enhanced release date handling
            if (currentDetails.release_date) {
                const shouldUpdateReleaseDate = 
                    !movie.release_date || 
                    movie.release_date !== currentDetails.release_date || 
                    movie.release_year !== new Date(currentDetails.release_date).getFullYear();
                
                if (shouldUpdateReleaseDate) {
                    updateData.release_date = currentDetails.release_date;
                    updateData.release_year = new Date(currentDetails.release_date).getFullYear();
                    hasUpdates = true;
                }
            }
            
            // Enhanced poster updates
            if (currentDetails.poster_path) {
                const newPosterUrl = `https://image.tmdb.org/t/p/w500${currentDetails.poster_path}`;
                const shouldUpdatePoster = 
                    !movie.poster || 
                    movie.poster === 'placeholder.jpg' || 
                    movie.poster.includes('placeholder') ||
                    movie.poster.includes('THE OLD GUARD 2') ||
                    movie.poster === 'null' ||
                    movie.poster === '' ||
                    movie.poster.includes('undefined');
                
                if (shouldUpdatePoster) {
                    updateData.poster = newPosterUrl;
                    hasUpdates = true;
                }
            }
            
            // Runtime updates removed - field not available in database
            
            // Enhanced status updates
            if (currentDetails.release_date) {
                const releaseDate = new Date(currentDetails.release_date);
                const now = new Date();
                const newStatus = releaseDate > now ? 'coming_soon' : 'released';
                
                if (movie.status !== newStatus) {
                    updateData.status = newStatus;
                    hasUpdates = true;
                }
            }
            
            // Additional TMDB fields are not included to avoid database schema issues
            // Focus on core fields: title, overview, release_date, poster, runtime, status, platform
            
            // Platform updates
            if (currentDetails['watch/providers'] && currentDetails['watch/providers'].results) {
                const platform = this.getBestPlatform(currentDetails['watch/providers']);
                if (platform && platform !== movie.platform) {
                    updateData.platform = platform;
                    hasUpdates = true;
                }
            }
            
            // Update database if there are changes
            if (hasUpdates) {
                const { error: updateError } = await this.supabase
                    .from('movies')
                    .update(updateData)
                    .eq('id', movie.id);
                
                if (updateError) {
                    console.error(`  ❌ Database update failed for ${movie.title}: ${updateError.message}`);
                    return false;
                }
                
                console.log(`  ✅ Successfully updated ${movie.title}`);
                return true;
            } else {
                console.log(`  ℹ️  No updates needed for ${movie.title}`);
                return true;
            }
            
        } catch (error) {
            console.error(`  💥 Error refreshing ${movie.title}:`, error);
            return false;
        }
    }
} 
