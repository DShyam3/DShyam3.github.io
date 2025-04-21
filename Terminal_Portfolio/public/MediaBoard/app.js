// State management
let currentTVShows = [];
let currentMovies = [];
let currentFilters = {
    tvShows: {
        genre: '',
        platform: '',
        status: ''
    },
    movies: {
        genre: '',
        platform: '',
        releaseStatus: ''
    }
};

// Platform configurations
const PLATFORMS = {
    'Netflix': {
        logo: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Netflix_2015_N_logo.svg',
        baseUrl: 'https://www.netflix.com'
    },
    'Disney+': {
        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
        baseUrl: 'https://www.disneyplus.com'
    },
    'Prime Video': {
        logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
        baseUrl: 'https://www.primevideo.com'
    },
    'Apple TV+': {
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
        baseUrl: 'https://tv.apple.com'
    },
    'BBC iPlayer': {
        logo: 'https://upload.wikimedia.org/wikipedia/en/f/fd/BBC_iPlayer_logo_%282021%29.svg',
        baseUrl: 'https://www.bbc.co.uk/iplayer'
    },
    'ITVX': {
        logo: 'https://upload.wikimedia.org/wikipedia/en/1/12/ITVX_logo.svg',
        baseUrl: 'https://www.itv.com/watch'
    }
};

let updateService;

// Initialize application
async function initializeApp() {
    try {
        setupTabs();
        updateService = new MediaUpdateService();
        await loadData();
        setupEventListeners();
        setupWeeklySchedule();
        await checkScheduledUpdate();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Data loading functions
async function loadData() {
    try {
        const { data: tvShows, error: tvError } = await supabase
            .from('tv_shows')
            .select('*, tv_show_seasons(*)');
        
        if (tvError) throw tvError;

        const { data: movies, error: movieError } = await supabase
            .from('movies')
            .select('*');
            
        if (movieError) throw movieError;

        // Sort TV shows alphabetically
        currentTVShows = (tvShows || []).sort((a, b) => 
            a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        );
        
        // Sort movies alphabetically
        currentMovies = (movies || []).sort((a, b) => 
            a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        );

        updateFilters();
        renderMediaGrids();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Event listeners setup
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Filter change events with dynamic updates
    document.querySelectorAll('.filter').forEach(filter => {
        filter.addEventListener('change', () => {
            const section = filter.closest('section');
            const isMovieSection = section.id === 'movies-section';
            
            // Update the current filters based on the section
            if (isMovieSection) {
                if (filter.id === 'movies-genre-filter') {
                    currentFilters.movies.genre = filter.value;
                } else if (filter.id === 'movies-platform-filter') {
                    currentFilters.movies.platform = filter.value;
                }
            } else {
                if (filter.id === 'tv-genre-filter') {
                    currentFilters.tvShows.genre = filter.value;
                } else if (filter.id === 'tv-platform-filter') {
                    currentFilters.tvShows.platform = filter.value;
                } else if (filter.id === 'tv-status-filter') {
                    currentFilters.tvShows.status = filter.value;
                }
            }
            
            // Update all filter options and counts
            updateFilters();
            renderMediaGrids();
        });
    });

    // Add new media button
    document.getElementById('add-media-btn').addEventListener('click', showAddMediaModal);

    // Site title reset
    document.getElementById('site-title').addEventListener('click', (e) => {
        e.preventDefault();
        resetApp();
    });

    // Add release status filter listener
    const releaseFilter = document.getElementById('movies-release-filter');
    if (releaseFilter) {
        releaseFilter.addEventListener('change', (e) => {
            currentFilters.movies.releaseStatus = e.target.value;
            renderMediaGrids();
        });
    }

    // Add refresh button listener
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('.refresh-icon');
            const originalText = refreshBtn.textContent;
            
            // Disable button and show loading state
            refreshBtn.disabled = true;
            icon.style.animation = 'spin 1s linear infinite';
            
            try {
                // Get total count of items to check
                const { data: counts } = await supabase
                    .from('tv_shows')
                    .select('count', { count: 'exact', head: true });
                const { data: movieCounts } = await supabase
                    .from('movies')
                    .select('count', { count: 'exact', head: true });
                
                const totalItems = (counts?.[0]?.count || 0) + (movieCounts?.[0]?.count || 0);
                let itemsChecked = 0;
                
                // Show initial progress
                refreshBtn.innerHTML = `
                    <div class="progress-bar" style="width: 0%"></div>
                    <span class="refresh-icon">↻</span> Checking updates (0%)...
                `;
                
                // Force check for updates including platforms
                const changes = await updateService.checkForUpdates(true, true, (progress) => {
                    itemsChecked = progress;
                    const percentage = Math.round((itemsChecked / totalItems) * 100);
                    refreshBtn.querySelector('.progress-bar').style.width = `${percentage}%`;
                    refreshBtn.innerHTML = `
                        <div class="progress-bar" style="width: ${percentage}%"></div>
                        <span class="refresh-icon">↻</span> Checking updates (${percentage}%)...
                    `;
                });
                
                // Show progress
                refreshBtn.innerHTML = '<span class="refresh-icon">↻</span> Updating data...';
                
                if (changes && changes.length > 0) {
                    localStorage.setItem('recentChanges', JSON.stringify(changes));
                    renderNewsSection();
                }
                
                // Show final progress
                refreshBtn.innerHTML = '<span class="refresh-icon">✓</span> Refreshing display...';
                await loadData();
                
                // Show success state briefly
                refreshBtn.innerHTML = '<span class="refresh-icon">✓</span> Updates complete!';
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                    icon.style.animation = '';
                }, 2000);
                
            } catch (error) {
                console.error('Error refreshing data:', error);
                refreshBtn.innerHTML = '<span class="refresh-icon">✗</span> Update failed';
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                    icon.style.animation = '';
                }, 2000);
            }
        });
    }
}

// Search functionality
async function handleSearch(event) {
    const searchTerm = event.target.value.trim();
    const searchResults = document.getElementById('search-results');

    if (searchTerm.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    // Search through existing media
    const matchingTVShows = currentTVShows.filter(show => 
        show.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchingMovies = currentMovies.filter(movie => 
        movie.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    renderSearchResults([...matchingTVShows.map(show => ({...show, media_type: 'tv'})), 
                        ...matchingMovies.map(movie => ({...movie, media_type: 'movie'}))]);
}

function renderSearchResults(results) {
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';

    if (!results || results.length === 0) {
        searchResults.style.display = 'none';
        return;
    }

    results.slice(0, 5).forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="search-result-content">
                <img src="${result.poster || 'placeholder.jpg'}" alt="${result.title}" class="search-result-poster">
                <div class="search-result-info">
                    ${result.title}
                    <span class="result-type">${result.media_type === 'tv' ? 'TV Show' : 'Movie'}</span>
                </div>
            </div>
        `;
        div.addEventListener('click', () => handleSearchResultClick(result));
        searchResults.appendChild(div);
    });

    searchResults.style.display = 'block';
}

// Media grid rendering
function renderMediaGrids() {
    // Update counts in section titles
    const tvCount = document.getElementById('tv-shows-count');
    const movieCount = document.getElementById('movies-count');
    
    if (tvCount) {
        tvCount.textContent = `(${currentTVShows.length})`;
    }
    
    if (movieCount) {
        movieCount.textContent = `(${currentMovies.length})`;
    }

    renderTVShows();
    renderMovies();
    // Setup image loading after rendering
    setTimeout(setupImageLoading, 0);
}

function renderTVShows() {
    const grid = document.getElementById('tv-shows-grid');
    const filteredShows = filterTVShows(currentTVShows);
    
    grid.innerHTML = filteredShows.map(show => createMediaCard(show, 'tv')).join('');
}

function renderMovies() {
    const grid = document.getElementById('movies-grid');
    const filteredMovies = filterMovies(currentMovies);
    
    grid.innerHTML = filteredMovies.map(movie => createMediaCard(movie, 'movie')).join('');
}

// Card creation
function createMediaCard(media, type) {
    const isUpcoming = media.release_date && new Date(media.release_date) > new Date();
    const releaseDate = formatDate(media.release_date);
    const today = new Date();
    const releaseDateTime = media.release_date ? new Date(media.release_date) : null;
    
    const daysUntilRelease = releaseDateTime ? 
        Math.ceil((releaseDateTime - today) / (1000 * 60 * 60 * 24)) : null;
    
    let releaseText = '';
    if (releaseDateTime) {
        if (daysUntilRelease > 0) {
            releaseText = daysUntilRelease === 1 ? 
                'Releases tomorrow' : 
                `Releases in ${daysUntilRelease} days`;
        } else if (daysUntilRelease === 0) {
            releaseText = 'Releases today';
        } else {
            releaseText = `Released ${releaseDate}`;
        }
    }

    return `
        <div class="media-card" data-id="${media.id}" data-type="${type}" onclick="handleCardClick(this)">
            <div class="media-card-actions">
                <button class="edit-platform-btn" onclick="event.stopPropagation(); showEditPlatformModal(${media.id}, '${type}', '${media.platform}')">
                    <span class="edit-icon">✎</span>
                </button>
            </div>
            <div class="media-card-image-container" onclick="handleCardClick(this.parentElement)">
                <img 
                    src="${media.poster || 'placeholder.jpg'}" 
                    alt="${media.title}"
                    loading="lazy"
                    onerror="this.src='placeholder.jpg'; this.onerror=null;"
                    class="media-poster"
                >
                <div class="image-placeholder">
                    <div class="placeholder-content">
                        <span class="placeholder-icon">🎬</span>
                        <span class="placeholder-text">Loading...</span>
                    </div>
                </div>
            </div>
            <div class="media-card-content">
                <h3>${media.title}</h3>
                <p class="platform-text">${media.platform}</p>
                ${releaseDateTime ? `<p class="release-date ${isUpcoming ? 'upcoming' : 'released'}">${releaseText}</p>` : ''}
            </div>
        </div>
    `;
}

// Add function to handle card clicks
function handleCardClick(cardElement) {
    const id = cardElement.dataset.id;
    const type = cardElement.dataset.type;
    
    const media = type === 'tv' 
        ? currentTVShows.find(show => show.id === parseInt(id))
        : currentMovies.find(movie => movie.id === parseInt(id));
    
    if (media) {
        showMediaDetails({
            ...media,
            media_type: type
        });
    }
}

// Modal handling
function showMediaDetails(media) {
    const modal = document.getElementById('view-media-modal');
    modal.innerHTML = '';  // Clear previous content
    modal.style.display = 'flex';
    
    if (media.media_type === 'tv') {
        modal.innerHTML = createTVShowDetails(media);
    } else {
        modal.innerHTML = createMovieDetails(media);
    }

    // Add event listener for closing modal
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => closeModal('view-media-modal'));

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal('view-media-modal');
        }
    });
}

function createTVShowDetails(show) {
    // Sort seasons by number and get the first season's ID
    const sortedSeasons = show.tv_show_seasons.sort((a, b) => a.season_number - b.season_number);
    const firstSeasonId = sortedSeasons[0]?.id;

    // Check if show is scheduled anywhere
    const isScheduled = async () => {
        const { data } = await supabase
            .from('weekly_schedule')
            .select('day_of_week')
            .eq('tv_show_id', show.id);
        return data && data.length > 0 ? data[0].day_of_week : null;
    };

    // Escape the title for JavaScript string literals
    const escapedTitle = show.title.replace(/'/g, "\\'");
    const escapedPoster = show.poster ? show.poster.replace(/'/g, "\\'") : 'placeholder.jpg';

    const modalContent = `
        <div class="modal-content">
            <div class="modal-close">&times;</div>
            <button class="delete-media-btn" data-type="tv" data-id="${show.id}" data-title="${escapedTitle}">
                Delete TV Show
            </button>
            <div class="details-grid">
                <div class="poster-column">
                    <img src="${show.poster || 'placeholder.jpg'}" alt="${show.title}" class="detail-poster">
                </div>
                <div class="info-column">
                    <h2>${show.title}</h2>
                    <p class="overview">${show.overview || 'No overview available.'}</p>
                    <div class="show-status ${show.status.toLowerCase().replace(/\s+/g, '-')}">
                        <span class="status-indicator"></span>
                        ${show.status}
                    </div>
                    <div class="available-on">
                        <h3>Available on</h3>
                        <div class="platform-display">
                            ${getPlatformLogo(show.platform, show)}
                            <button class="edit-platform-btn" onclick="showEditPlatformModal(${show.id}, 'tv', '${show.platform}')">
                                <span class="edit-icon">✎</span>
                            </button>
                        </div>
                    </div>
                    <button id="schedule-btn-${show.id}" class="schedule-btn" onclick="handleScheduleButton(${show.id}, '${escapedTitle}', '${escapedPoster}')">
                        <span class="schedule-btn-text">Checking schedule...</span>
                    </button>
                </div>
                <div class="episodes-column">
                    <div class="seasons-episodes-container">
                        <div class="season-selector">
                            <select id="season-select" onchange="handleSeasonChange(this.value, ${show.id})">
                                ${createSeasonOptions(sortedSeasons)}
                            </select>
                        </div>
                        <div class="episodes-list" id="episodes-list">
                            <div class="loading">Loading episodes...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('view-media-modal').innerHTML = modalContent;
    
    // Update schedule button state
    isScheduled().then(scheduledDay => {
        const btn = document.getElementById(`schedule-btn-${show.id}`);
        if (scheduledDay) {
            btn.classList.add('scheduled');
            btn.querySelector('.schedule-btn-text').textContent = `Remove from ${scheduledDay}`;
        } else {
            btn.querySelector('.schedule-btn-text').textContent = 'Add to Schedule';
        }
    });

    // Load initial episodes after rendering
    if (firstSeasonId) {
        handleSeasonChange(firstSeasonId, show.id);
    }
    
    // Add event listener after the modal is added to DOM
    setTimeout(() => {
        const deleteBtn = document.querySelector('.delete-media-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const type = deleteBtn.dataset.type;
                const id = deleteBtn.dataset.id;
                const title = deleteBtn.dataset.title;
                
                try {
                    await handleDeleteMedia(type, parseInt(id), title);
                } catch (error) {
                    alert(`Error deleting ${title}: ${error.message}`);
                }
            });
        }
    }, 0);

    return modalContent;
}

function createSeasonOptions(seasons) {
    if (!seasons || seasons.length === 0) {
        return '<option value="">No seasons available</option>';
    }

    return seasons
        .map(season => `
            <option value="${season.id}" ${season.watched ? 'class="watched-option"' : ''}>
                ${season.watched ? '✓ ' : ''}Season ${season.season_number}
            </option>
        `).join('');
}

async function handleSeasonChange(seasonId, showId) {
    try {
        const { data: season, error: seasonError } = await supabase
            .from('tv_show_seasons')
            .select('*')
            .eq('id', seasonId)
            .single();

        const { data: episodes, error: episodesError } = await supabase
            .from('tv_show_episodes')
            .select('*')
            .eq('season_id', seasonId)
            .order('episode_number');

        if (seasonError || episodesError) throw seasonError || episodesError;

        // Check if all episodes are watched
        const allEpisodesWatched = episodes.every(episode => episode.watched);
        if (allEpisodesWatched !== season.watched) {
            // Update season watched status if it doesn't match episodes
            await supabase
                .from('tv_show_seasons')
                .update({ watched: allEpisodesWatched })
                .eq('id', seasonId);
            
            season.watched = allEpisodesWatched;
        }

        const episodesList = document.getElementById('episodes-list');
        episodesList.innerHTML = createEpisodesSection({ ...season, episodes });
    } catch (error) {
        console.error('Error loading episodes:', error);
    }
}

async function updateSeasonWatched(seasonId, watched, event) {
    // Prevent the season header click event from firing
    event?.stopPropagation();
    
    try {
        // Update season watched status
        const { error: seasonError } = await supabase
            .from('tv_show_seasons')
            .update({ watched })
            .eq('id', seasonId);

        if (seasonError) throw seasonError;

        // Update all episodes for this season
        const { error: episodesError } = await supabase
            .from('tv_show_episodes')
            .update({ watched })
            .eq('season_id', seasonId);

        if (episodesError) throw episodesError;

        // Refresh the episodes display
        const seasonSelect = document.getElementById('season-select');
        await handleSeasonChange(seasonId, null);
        
        // Update the season header styling
        const seasonHeader = document.querySelector(`.season-header[data-season-id="${seasonId}"]`);
        if (seasonHeader) {
            seasonHeader.classList.toggle('watched', watched);
            const watchedBtn = seasonHeader.querySelector('.season-watched-btn');
            watchedBtn.classList.toggle('watched', watched);
            watchedBtn.textContent = watched ? '✓' : '';
        }
    } catch (error) {
        console.error('Error updating season status:', error);
    }
}

function createEpisodesSection(season) {
    if (!season || !season.episodes || season.episodes.length === 0) {
        return '<p class="no-episodes">No episodes available.</p>';
    }

    return `
        <div class="season-status">
            <button class="mark-season-btn ${season.watched ? 'watched' : ''}"
                onclick="updateSeasonWatched(${season.id}, ${!season.watched})">
                ${season.watched ? 'Season Watched' : 'Mark Season as Watched'}
            </button>
        </div>
        <div class="episodes-grid">
            ${season.episodes.map(episode => `
                <div class="episode-item ${episode.watched ? 'watched' : ''}" 
                     onclick="updateEpisodeWatched(${episode.id}, ${!episode.watched}, ${season.id})">
                    <div class="episode-header">
                        <span class="episode-number">Episode ${episode.episode_number}</span>
                        <span class="episode-status">${episode.watched ? '✓' : ''}</span>
                    </div>
                    <div class="episode-info">
                        <span class="episode-date">
                            ${formatDate(episode.release_date)}
                        </span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function createMovieDetails(movie) {
    const modalContent = `
        <div class="modal-content">
            <div class="modal-close">&times;</div>
            <button class="delete-media-btn" data-type="movie" data-id="${movie.id}" data-title="${movie.title}">
                Delete Movie
            </button>
            <div class="details-grid movie-details">
                <div class="poster-column">
                    <img src="${movie.poster || 'placeholder.jpg'}" alt="${movie.title}" class="detail-poster">
                </div>
                <div class="info-column">
                    <h2>${movie.title}</h2>
                    <p class="overview">${movie.overview || 'No overview available.'}</p>
                    <div class="available-on">
                        <h3>Available on</h3>
                        <div class="platform-display">
                            ${getPlatformLogo(movie.platform, movie)}
                            <button class="edit-platform-btn" onclick="showEditPlatformModal(${movie.id}, 'movie', '${movie.platform}')">
                                <span class="edit-icon">✎</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listener after the modal is added to DOM
    setTimeout(() => {
        const deleteBtn = document.querySelector('.delete-media-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const type = deleteBtn.dataset.type;
                const id = deleteBtn.dataset.id;
                const title = deleteBtn.dataset.title;
                
                try {
                    await handleDeleteMedia(type, parseInt(id), title);
                } catch (error) {
                    alert(`Error deleting ${title}: ${error.message}`);
                }
            });
        }
    }, 0);

    return modalContent;
}

// Weekly schedule management
function setupWeeklySchedule() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const scheduleGrid = document.querySelector('.schedule-grid');
    
    scheduleGrid.innerHTML = days.map(day => `
        <div class="schedule-day" data-day="${day}">
            <h4>${day}</h4>
            <div class="schedule-shows"></div>
        </div>
    `).join('');

    loadWeeklySchedule();
}

async function loadWeeklySchedule() {
    const { data: schedule } = await supabase
        .from('weekly_schedule')
        .select(`
            *,
            tv_shows (*)
        `);

    if (schedule) {
        schedule.forEach(entry => {
            const dayElement = document.querySelector(`[data-day="${entry.day_of_week}"] .schedule-shows`);
            if (dayElement && entry.tv_shows) {
                const showElement = createScheduledShowElement(
                    entry.tv_show_id,
                    entry.tv_shows.title,
                    entry.tv_shows.poster,
                    entry.day_of_week
                );
                dayElement.appendChild(showElement);
            }
        });
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Tab management
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-section`).classList.add('active');
            
            // Render news section if switching to news tab
            if (tabId === 'news') {
                renderNewsSection();
            }
        });
    });
}

// Update filter options function
function updateFilterOptions(filterId, options, items, field) {
    const filter = document.getElementById(filterId);
    if (!filter) return; // Guard against missing element
    
    const currentValue = filter.value;
    
    // Keep the first "All" option
    filter.innerHTML = `<option value="">${filter.options[0].text}</option>`;
    
    // Get the current filters for the section
    const isMovieSection = filterId.startsWith('movies-');
    const sectionFilters = isMovieSection ? currentFilters.movies : currentFilters.tvShows;
    
    // Filter items based on other active filters
    let filteredItems = items;
    if (field !== 'genre' && sectionFilters.genre) {
        filteredItems = filteredItems.filter(item => item.genre.includes(sectionFilters.genre));
    }
    if (field !== 'platform' && sectionFilters.platform) {
        filteredItems = filteredItems.filter(item => item.platform === sectionFilters.platform);
    }
    if (!isMovieSection && field !== 'status' && sectionFilters.status) {
        filteredItems = filteredItems.filter(item => item.status === sectionFilters.status);
    }
    
    // Calculate counts based on filtered items
    options.forEach(option => {
        let count;
        if (field === 'genre') {
            count = filteredItems.filter(item => item.genre.includes(option)).length;
        } else if (field === 'platform') {
            count = filteredItems.filter(item => item.platform === option).length;
        } else if (field === 'status') {
            count = filteredItems.filter(item => item.status === option).length;
        }
        
        if (count > 0) {
            const optionElement = new Option(`${option} (${count})`, option);
            if (option === currentValue) {
                optionElement.selected = true;
            }
            filter.appendChild(optionElement);
        }
    });
}

// Update filters function
function updateFilters() {
    if (!currentTVShows || !currentMovies) return; // Guard against missing data

    // Helper function to simplify genres
    function simplifyGenres(genreString) {
        if (!genreString) return '';
        const genres = genreString.split(', ');
        const mainGenres = new Set([
            'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
            'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror',
            'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War'
        ]);
        return genres.filter(g => mainGenres.has(g)).join(', ');
    }

    // Update TV Show filters
    const tvGenres = [...new Set(currentTVShows.map(show => 
        (show.genre || '').split(', ').map(g => g.trim())
    ).flat())].filter(g => g !== '').sort();

    const tvPlatforms = [...new Set(currentTVShows.map(show => show.platform))].filter(Boolean);
    const tvStatuses = [...new Set(currentTVShows.map(show => show.status))].filter(Boolean);
    
    updateFilterOptions('tv-genre-filter', tvGenres, currentTVShows, 'genre');
    updateFilterOptions('tv-platform-filter', tvPlatforms, currentTVShows, 'platform');
    updateFilterOptions('tv-status-filter', tvStatuses, currentTVShows, 'status');

    // Update Movie filters
    const movieGenres = [...new Set(currentMovies.map(movie => 
        (movie.genre || '').split(', ').map(g => g.trim())
    ).flat())].filter(g => g !== '').sort();

    const moviePlatforms = [...new Set(currentMovies.map(movie => movie.platform))].filter(Boolean);
    
    updateFilterOptions('movies-genre-filter', movieGenres, currentMovies, 'genre');
    updateFilterOptions('movies-platform-filter', moviePlatforms, currentMovies, 'platform');
}

// Update filter functions
function filterTVShows(shows) {
    return shows.filter(show => {
        const { genre, platform, status } = currentFilters.tvShows;
        
        const genreMatch = !genre || show.genre.includes(genre);
        const platformMatch = !platform || show.platform === platform;
        const statusMatch = !status || show.status === status;
        
        return genreMatch && platformMatch && statusMatch;
    });
}

function filterMovies(movies) {
    return movies.filter(movie => {
        const { genre, platform, releaseStatus } = currentFilters.movies;
        
        const genreMatch = !genre || movie.genre.includes(genre);
        const platformMatch = !platform || movie.platform === platform;
        
        // Release status filtering
        const today = new Date().toISOString().split('T')[0];
        let releaseMatch = true;
        
        if (releaseStatus === 'released') {
            releaseMatch = movie.release_date && movie.release_date <= today;
        } else if (releaseStatus === 'coming_soon') {
            releaseMatch = movie.release_date && movie.release_date > today;
        }

        return genreMatch && platformMatch && releaseMatch;
    });
}

// Reset app function
function resetApp() {
    // Reset all filters
    document.querySelectorAll('.filter').forEach(filter => {
        filter.value = '';
    });
    
    // Reset to TV Shows tab
    const tvShowsTab = document.querySelector('[data-tab="tv-shows"]');
    if (tvShowsTab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tvShowsTab.classList.add('active');
        document.getElementById('tv-shows-section').classList.add('active');
    }
    
    // Scroll to top smoothly
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Reload data
    loadData();
    
    // Close any open modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Add media modal
function showAddMediaModal() {
    const modal = document.createElement('div');
    modal.id = 'add-media-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-close">&times;</div>
            <h2>Add New Media</h2>
            <div class="add-media-tabs">
                <button class="add-tab-btn active" data-tab="add-tv">TV Show</button>
                <button class="add-tab-btn" data-tab="add-movie">Movie</button>
            </div>
            <div class="add-media-content">
                <div id="add-tv" class="add-tab-content active">
                    <div class="search-add-container">
                        <input type="text" 
                            class="search-add-input" 
                            placeholder="Search for a TV show..."
                            oninput="handleAddMediaSearch(this, 'tv')">
                        <div class="search-add-results"></div>
                    </div>
                </div>
                <div id="add-movie" class="add-tab-content">
                    <div class="search-add-container">
                        <input type="text" 
                            class="search-add-input" 
                            placeholder="Search for a movie..."
                            oninput="handleAddMediaSearch(this, 'movie')">
                        <div class="search-add-results"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to body
    document.body.appendChild(modal);
    
    // Setup tab switching
    setupAddMediaTabs();
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal('add-media-modal');
        }
    });
    
    // Add close button functionality
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal('add-media-modal');
    });
}

// Close modal function
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        if (modalId === 'add-media-modal') {
            modal.remove(); // Remove the add media modal from DOM when closed
        }
    }
}

// Add function to update filter counts dynamically
function updateFilterCounts(isMovieSection) {
    const items = isMovieSection ? currentMovies : currentTVShows;
    const filteredItems = isMovieSection ? filterMovies(items) : filterTVShows(items);
    
    const prefix = isMovieSection ? 'movies-' : 'tv-';
    const filters = ['genre', 'platform'];
    if (!isMovieSection) filters.push('status');

    filters.forEach(filterType => {
        const filter = document.getElementById(`${prefix}${filterType}-filter`);
        const currentValue = filter.value;
        const options = [...new Set(items.map(item => 
            filterType === 'genre' ? 
                item[filterType].split(', ').map(g => g.trim()) : 
                [item[filterType]]
        ).flat())].filter(Boolean).sort();

        // Keep the first "All" option
        filter.innerHTML = `<option value="">${filter.options[0].text}</option>`;
        
        options.forEach(option => {
            const count = filteredItems.filter(item => 
                filterType === 'genre' ? 
                    item[filterType].includes(option) : 
                    item[filterType] === option
            ).length;
            
            const optionElement = new Option(`${option} (${count})`, option);
            if (option === currentValue) optionElement.selected = true;
            filter.appendChild(optionElement);
        });
    });
}

// Add card view functionality
function handleSearchResultClick(result) {
    // Hide search results dropdown
    const searchResults = document.getElementById('search-results');
    searchResults.style.display = 'none';
    
    // Clear search input
    document.getElementById('search').value = '';
    
    // Show media details
    showMediaDetails(result);
}

// Add function to update episode watched status
async function updateEpisodeWatched(episodeId, watched, seasonId) {
    try {
        // Update episode watched status
        const { error: episodeError } = await supabase
            .from('tv_show_episodes')
            .update({ watched })
            .eq('id', episodeId);

        if (episodeError) throw episodeError;

        // Get all episodes for this season
        const { data: episodes, error: episodesError } = await supabase
            .from('tv_show_episodes')
            .select('watched')
            .eq('season_id', seasonId);

        if (episodesError) throw episodesError;

        // Check if all episodes are now watched
        const allEpisodesWatched = episodes.every(ep => ep.watched);

        // Update season watched status
        const { error: seasonError } = await supabase
            .from('tv_show_seasons')
            .update({ watched: allEpisodesWatched })
            .eq('id', seasonId);

        if (seasonError) throw seasonError;

        // Refresh the display
        await handleSeasonChange(seasonId, null);

    } catch (error) {
        console.error('Error updating episode status:', error);
    }
}

// Add schedule selector functionality
function showScheduleSelector(showId, title, poster) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const modal = document.createElement('div');
    modal.className = 'schedule-selector-modal';
    
    // Escape the title and poster for HTML and JavaScript
    const escapedTitle = title.replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const escapedPoster = poster ? poster.replace(/"/g, '&quot;').replace(/'/g, "\\'") : 'placeholder.jpg';
    
    modal.innerHTML = `
        <div class="schedule-selector-content">
            <div class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</div>
            <h3>Add "${escapedTitle}" to Schedule</h3>
            <div class="day-selector">
                ${days.map(day => `
                    <div class="day-option" onclick="addToSchedule(${showId}, '${day}', '${escapedTitle}', '${escapedPoster}')">
                        <h4>${day}</h4>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function addToSchedule(showId, day, title, poster) {
    try {
        if (!showId || !day) {
            console.error('Invalid showId or day');
            return;
        }

        // Check if show is already scheduled for this day
        const { data: existing, error: checkError } = await supabase
            .from('weekly_schedule')
            .select('*')
            .eq('tv_show_id', showId)
            .eq('day_of_week', day);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
            alert(`${title} is already scheduled for ${day}`);
            return;
        }

        // Add to schedule
        const { error: insertError } = await supabase
            .from('weekly_schedule')
            .insert([{ tv_show_id: showId, day_of_week: day }]);

        if (insertError) throw insertError;

        // Update the schedule display
        const dayElement = document.querySelector(`[data-day="${day}"] .schedule-shows`);
        if (dayElement) {
            const showElement = createScheduledShowElement(showId, title, poster, day);
            dayElement.appendChild(showElement);
        }

        // Close the schedule selector
        const modal = document.querySelector('.schedule-selector-modal');
        if (modal) modal.remove();

        // Update the button in the show details if it's open
        const btn = document.getElementById(`schedule-btn-${showId}`);
        if (btn) {
            btn.classList.add('scheduled');
            btn.querySelector('.schedule-btn-text').textContent = `Remove from ${day}`;
        }
    } catch (error) {
        console.error('Error updating schedule:', error);
        alert('Failed to add show to schedule. Please try again.');
    }
}

function createScheduledShowElement(showId, title, poster, day) {
    const div = document.createElement('div');
    div.className = 'scheduled-show';
    div.setAttribute('data-show-id', showId);
    div.innerHTML = `
        <img src="${poster || 'placeholder.jpg'}" alt="${title}">
        <span>${title}</span>
        <button class="remove-schedule" onclick="removeFromSchedule(${showId}, '${day}', this.parentElement)">×</button>
    `;
    div.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove-schedule')) {
            const show = currentTVShows.find(s => s.id === showId);
            if (show) {
                showMediaDetails({...show, media_type: 'tv'});
            }
        }
    });
    return div;
}

async function removeFromSchedule(showId, day, element) {
    try {
        const { error } = await supabase
            .from('weekly_schedule')
            .delete()
            .eq('tv_show_id', showId)
            .eq('day_of_week', day);

        if (error) throw error;
        element.remove();
    } catch (error) {
        console.error('Error removing from schedule:', error);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initializeApp); 

async function handleScheduleButton(showId, title, poster) {
    const btn = document.getElementById(`schedule-btn-${showId}`);
    
    // Check current schedule status
    const { data } = await supabase
        .from('weekly_schedule')
        .select('day_of_week')
        .eq('tv_show_id', showId);
    
    if (data && data.length > 0) {
        // Show is scheduled - remove it
        const day = data[0].day_of_week;
        const element = document.querySelector(`[data-day="${day}"] .schedule-shows`)
            .querySelector(`[data-show-id="${showId}"]`);
        
        await removeFromSchedule(showId, day, element);
        
        // Update button state
        btn.classList.remove('scheduled');
        btn.querySelector('.schedule-btn-text').textContent = 'Add to Schedule';
    } else {
        // Show is not scheduled - show day selector
        showScheduleSelector(showId, title, poster);
    }
}

// Helper function to get platform logo
function getPlatformLogo(platform, media) {
    // Normalize platform name
    const normalizedPlatform = normalizePlatformName(platform);
    
    if (PLATFORMS[normalizedPlatform]) {
        const platformUrl = PLATFORMS[normalizedPlatform].baseUrl;
        
        return `
            <a href="${platformUrl}" 
               target="_blank" 
               class="platform-link" 
               title="Go to ${normalizedPlatform}">
                <img src="${PLATFORMS[normalizedPlatform].logo}" 
                    alt="${platform}" 
                    class="platform-logo">
            </a>`;
    }
    
    // If no logo found, return the platform name as text
    return `<span class="platform-name">${platform}</span>`;
}

// Helper function to normalize platform names
function normalizePlatformName(platform) {
    // Handle common variations
    const platformMap = {
        'netflix': 'Netflix',
        'disney+': 'Disney+',
        'disney plus': 'Disney+',
        'prime': 'Prime Video',
        'prime video': 'Prime Video',
        'amazon prime': 'Prime Video',
        'amazon prime video': 'Prime Video',
        'amazon': 'Prime Video',
        'apple tv+': 'Apple TV+',
        'apple tv': 'Apple TV+',
        'apple tv plus': 'Apple TV+',
        'appletv+': 'Apple TV+',
        'appletv': 'Apple TV+',
        'bbc': 'BBC iPlayer',
        'bbc iplayer': 'BBC iPlayer',
        'itv': 'ITVX',
        'itvx': 'ITVX'
    };
    
    // Remove any special characters and normalize
    const normalized = platform?.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s+]/g, '');
    
    console.log('Platform:', platform, 'Normalized:', normalized, 'Mapped:', platformMap[normalized]);
    return platformMap[normalized] || platform;
}

async function handleAddMediaSearch(input, type) {
    const searchTerm = input.value.trim();
    const resultsContainer = input.parentElement.querySelector('.search-add-results');
    
    if (searchTerm.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTerm)}`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            resultsContainer.innerHTML = '';
            data.results.slice(0, 5).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'search-add-item';
                itemDiv.innerHTML = `
                    <img src="${item.poster_path ? 
                        `https://image.tmdb.org/t/p/w92${item.poster_path}` : 
                        'https://via.placeholder.com/92x138'}" 
                        alt="${item.title || item.name}">
                    <div class="search-add-item-info">
                        <div class="title">${item.title || item.name}</div>
                        <div class="year">${item.release_date || item.first_air_date ? 
                            new Date(item.release_date || item.first_air_date).getFullYear() : 'N/A'}</div>
                    </div>
                `;
                itemDiv.addEventListener('click', async (e) => {
                    e.preventDefault();
                    resultsContainer.style.display = 'none';
                    await handleAddMediaSelect(item.id, type);
                });
                resultsContainer.appendChild(itemDiv);
            });
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
            resultsContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error searching:', error);
        resultsContainer.innerHTML = '<div class="error">Error searching. Please try again.</div>';
        resultsContainer.style.display = 'block';
    }
}

async function handleAddMediaSelect(tmdbId, type) {
    const searchInput = document.querySelector('.search-add-input');
    // Get the active tab's search container
    const activeTab = document.querySelector('.add-tab-content.active');
    
    // Clear any existing status messages
    const existingStatus = document.querySelector('.add-media-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Create a new status message container
    const statusMessage = document.createElement('div');
    statusMessage.className = 'add-media-status';
    statusMessage.innerHTML = `<div class="loading">Adding ${type === 'tv' ? 'TV show' : 'movie'}...</div>`;
    
    // Insert the status message next to the tabs
    const tabsContainer = document.querySelector('.add-media-tabs');
    tabsContainer.parentNode.insertBefore(statusMessage, tabsContainer.nextSibling);
    
    try {
        // Fetch and process media
        const details = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`
        ).then(res => res.json());
        
        const providers = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
        ).then(res => res.json());
        
        // Add the media
        if (type === 'tv') {
            await addTVShow(details, providers);
        } else {
            await addMovie(details, providers);
        }
        
        // Show success message
        const title = type === 'tv' ? details.name : details.title;
        statusMessage.innerHTML = `<div class="success">"${title}" has been added to your ${type === 'tv' ? 'TV shows' : 'movies'}</div>`;
        
        // Clear the search input and results
        searchInput.value = '';
        const resultsContainer = activeTab.querySelector('.search-add-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
        
        // Refresh the data but keep the modal open
        await loadData();
        
        // Remove the success message after a delay
        setTimeout(() => {
            statusMessage.remove();
        }, 3000);
        
    } catch (error) {
        console.error('Error adding media:', error);
        // Show error message in the status message
        statusMessage.innerHTML = `<div class="error">${error.message}</div>`;
        
        // Don't remove the error message immediately if it's a duplicate
        if (!error.message.includes('already in your')) {
            setTimeout(() => {
                statusMessage.remove();
                searchInput.disabled = false;
            }, 3000);
        }
    }
}

// Add media tab management
function setupAddMediaTabs() {
    const tabBtns = document.querySelectorAll('.add-tab-btn');
    const tabContents = document.querySelectorAll('.add-tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Function to determine the best platform
function getBestPlatform(providers) {
    const PREFERRED_STREAMING = {
        'Netflix': 'Netflix',
        'Amazon Prime Video': 'Prime Video',
        'Disney Plus': 'Disney+',
        'Disney+': 'Disney+',
        'Apple TV Plus': 'Apple TV+',
        'Apple TV+': 'Apple TV+',
        'Apple TV': 'Apple TV+'
    };
    
    const PREFERRED_FREE = {
        'BBC iPlayer': 'BBC iPlayer',
        'BBC': 'BBC iPlayer',
        'ITV Hub': 'ITVX',
        'ITVX': 'ITVX'
    };
    
    const ukProviders = providers?.results?.GB || {};
    const free = ukProviders.free?.map(p => p.provider_name) || [];
    const flatrate = ukProviders.flatrate?.map(p => p.provider_name) || [];
    
    // Check free providers first
    for (const providerName of free) {
        if (PREFERRED_FREE[providerName]) {
            return PREFERRED_FREE[providerName];
        }
    }
    
    // Then check streaming providers
    for (const providerName of flatrate) {
        if (PREFERRED_STREAMING[providerName]) {
            return PREFERRED_STREAMING[providerName];
        }
    }
    
    // Log the providers we found for debugging
    console.log('UK Providers:', {
        free,
        flatrate,
        all: ukProviders
    });
    
    return 'Online';
}

async function addTVShow(details, providers) {
    try {
        // Check if TV show already exists - using select without single() first
        const { data: existing, error: existingError } = await supabase
            .from('tv_shows')
            .select('id, title')
            .ilike('title', details.name);

        if (existingError) throw existingError;
        
        // Check if we found any matches
        if (existing && existing.length > 0) {
            throw new Error(`"${details.name}" is already in your TV shows list`);
        }

        // Prepare TV show data
        const tvShowData = {
            title: details.name,
            platform: getBestPlatform(providers),
            genre: details.genres.map(g => g.name).join(', '),
            status: details.status,
            poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
            overview: details.overview,
            release_date: details.first_air_date || null
        };

        // Insert TV show
        const { data: show, error } = await supabase
            .from('tv_shows')
            .insert([tvShowData])
            .select()
            .single();

        if (error) throw error;

        // Add seasons with release dates
        for (const season of details.seasons) {
            // Get detailed season info to get air date
            const seasonResponse = await fetch(
                `https://api.themoviedb.org/3/tv/${details.id}/season/${season.season_number}?api_key=${TMDB_API_KEY}`
            );
            const seasonDetails = await seasonResponse.json();
            
            const seasonData = {
                tv_show_id: show.id,
                season_number: season.season_number,
                release_year: season.air_date ? new Date(season.air_date).getFullYear() : null,
                release_date: seasonDetails.air_date || season.air_date || null,
                watched: false
            };

            const { data: insertedSeason, error: seasonError } = await supabase
                .from('tv_show_seasons')
                .insert([seasonData])
                .select()
                .single();

            if (seasonError) throw seasonError;

            // Add episodes
            if (seasonDetails.episodes && seasonDetails.episodes.length > 0) {
                const episodesData = seasonDetails.episodes.map(episode => ({
                    season_id: insertedSeason.id,
                    episode_number: episode.episode_number,
                    release_date: episode.air_date,
                    watched: false
                }));

                const { error: episodesError } = await supabase
                    .from('tv_show_episodes')
                    .insert(episodesData);

                if (episodesError) throw episodesError;
            }
        }

    } catch (error) {
        console.error('Error adding TV show:', error);
        throw error;
    }
}

async function addMovie(details, providers) {
    try {
        // Check if movie already exists
        const { data: existing } = await supabase
            .from('movies')
            .select('id')
            .ilike('title', details.title)
            .single();

        if (existing) {
            throw new Error(`"${details.title}" is already in your movies list`);
        }

        const movieData = {
            title: details.title,
            platform: getBestPlatform(providers),
            genre: details.genres.map(g => g.name).join(', '),
            release_year: details.release_date ? new Date(details.release_date).getFullYear() : null,
            poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
            overview: details.overview,
            release_date: details.release_date || null
        };

        const { error } = await supabase
            .from('movies')
            .insert([movieData]);

        if (error) throw error;

    } catch (error) {
        console.error('Error adding movie:', error);
        throw error;
    }
}

async function handleDeleteMedia(type, id, title) {
    try {
        if (type === 'tv') {
            // First, get all seasons for this TV show
            const { data: seasons } = await supabase
                .from('tv_show_seasons')
                .select('id')
                .eq('tv_show_id', id);

            if (seasons && seasons.length > 0) {
                // Delete all episodes for each season
                const seasonIds = seasons.map(s => s.id);
                const { error: episodesError } = await supabase
                    .from('tv_show_episodes')
                    .delete()
                    .in('season_id', seasonIds);

                if (episodesError) throw episodesError;
            }

            // Delete all seasons
            const { error: seasonsError } = await supabase
                .from('tv_show_seasons')
                .delete()
                .eq('tv_show_id', id);

            if (seasonsError) throw seasonsError;

            // Delete from schedule if it exists
            await supabase
                .from('weekly_schedule')
                .delete()
                .eq('tv_show_id', id);
        }

        // Delete the media itself
        const { error: mediaError } = await supabase
            .from(type === 'tv' ? 'tv_shows' : 'movies')
            .delete()
            .eq('id', id);

        if (mediaError) throw mediaError;

        // Show success message in modal only if it doesn't exist already
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent.querySelector('.success')) {
            const successMsg = document.createElement('div');
            successMsg.className = 'success';
            successMsg.textContent = `"${title}" has been deleted`;
            modalContent.prepend(successMsg);
        }

        // Close modal and refresh after delay
        setTimeout(() => {
            const modal = document.getElementById('view-media-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            loadData();
        }, 1000);

    } catch (error) {
        console.error('Error deleting media:', error);
        alert(`Error deleting ${title}: ${error.message}`);
    }
}

async function checkScheduledUpdate() {
    const now = new Date();
    if (now.getHours() === 6 && now.getMinutes() === 0) {
        await updateService.checkForUpdates();
    }
    // Check again in a minute
    setTimeout(checkScheduledUpdate, 60000);
}

async function renderNewsSection() {
    const upcomingTVContent = document.getElementById('upcoming-tv-content');
    const upcomingMoviesContent = document.getElementById('upcoming-movies-content');
    const changesContent = document.getElementById('changes-content');
    
    // Get and sort upcoming TV shows
    const upcomingTV = await getUpcomingTVShows();
    upcomingTV.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    upcomingTVContent.innerHTML = upcomingTV.map(item => createNewsItem(item, 'upcoming')).join('');
    
    // Get and sort upcoming movies
    const upcomingMovies = getUpcomingMovies();
    upcomingMovies.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    upcomingMoviesContent.innerHTML = upcomingMovies.map(item => createNewsItem(item, 'upcoming')).join('');
    
    // Get recent changes from localStorage
    const recentChanges = JSON.parse(localStorage.getItem('recentChanges') || '[]');
    changesContent.innerHTML = recentChanges.map(item => createNewsItem(item, 'change')).join('');
}

async function getUpcomingTVShows() {
    const today = new Date().toISOString().split('T')[0];
    // Get upcoming seasons directly
    const { data: upcomingSeasons } = await supabase
        .from('tv_show_seasons')
        .select(`
            *,
            show:tv_shows!inner(*)
        `)
        .gt('release_date', today)
        .order('release_date');
    
    const showMap = new Map();
    upcomingSeasons?.forEach(season => {
        const show = season.show;
        if (!showMap.has(show.id) || 
            new Date(showMap.get(show.id).release_date) > new Date(season.release_date)) {
            showMap.set(show.id, {
                ...show,
                type: 'tv_season',
                release_date: season.release_date,
                season_number: season.season_number
            });
        }
    });

    return Array.from(showMap.values());
}

function getUpcomingMovies() {
    const today = new Date().toISOString().split('T')[0];
    return currentMovies.filter(movie => movie.release_date && movie.release_date > today);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function createNewsItem(item, type) {
    if (type === 'upcoming') {
        const releaseDate = formatDate(item.release_date);
        const daysUntil = Math.ceil((new Date(item.release_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="news-item">
                <img src="${item.poster || 'placeholder.jpg'}" alt="${item.title}">
                <div class="news-item-content">
                    <div class="news-item-title">${item.title}</div>
                    <div class="news-item-date">
                        ${daysUntil === 0 ? 'Releases today' :
                          daysUntil === 1 ? 'Releases tomorrow' :
                          `Releases in ${daysUntil} days`}
                    </div>
                    <div class="news-item-release-date">Release date: ${releaseDate}</div>
                    ${item.type === 'tv_season' ? 
                        `<div class="news-item-info">Season ${item.season_number}</div>` : ''}
                    <div class="news-item-platform">on ${item.platform}</div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="news-item">
                <img src="${item.poster || 'placeholder.jpg'}" alt="${item.title}">
                <div class="news-item-content">
                    <div class="news-item-title">${item.title}</div>
                    ${item.changes.map(change => {
                        switch (change.type) {
                            case 'status':
                                return `<div class="news-item-change">Status changed from "${change.old}" to "${change.new}"</div>`;
                            case 'platform':
                                return `<div class="news-item-change">Now available on ${change.new}</div>`;
                            case 'seasons':
                                return `<div class="news-item-change">New season${change.new.length > 1 ? 's' : ''} announced!</div>`;
                            default:
                                return '';
                        }
                    }).join('')}
                </div>
            </div>
        `;
    }
}

function showEditPlatformModal(mediaId, type, currentPlatform) {
    const modal = document.createElement('div');
    modal.className = 'modal edit-platform-modal';
    modal.style.display = 'flex';
    
    const platforms = Object.keys(PLATFORMS).concat(['Online']);
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-close">&times;</div>
            <h3>Edit Platform</h3>
            <div class="platform-selector">
                ${platforms.map(platform => `
                    <div class="platform-option ${platform === currentPlatform ? 'selected' : ''}" 
                         data-platform="${platform}"
                         onclick="updatePlatform(${mediaId}, '${type}', '${platform}', this)">
                        ${getPlatformLogo(platform)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add close functionality
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

async function updatePlatform(mediaId, type, newPlatform, element) {
    try {
        const { error } = await supabase
            .from(type === 'tv' ? 'tv_shows' : 'movies')
            .update({ platform: newPlatform })
            .eq('id', mediaId);

        if (error) throw error;

        // Update UI
        const card = document.querySelector(`.media-card[data-id="${mediaId}"]`);
        if (card) {
            card.querySelector('.platform-text').textContent = newPlatform;
        }

        // Update selected state in modal
        const options = document.querySelectorAll('.platform-option');
        options.forEach(opt => opt.classList.remove('selected'));
        element.classList.add('selected');

        // Close modal after delay
        setTimeout(() => {
            document.querySelector('.edit-platform-modal').remove();
            loadData(); // Refresh data
        }, 1000);

    } catch (error) {
        console.error('Error updating platform:', error);
        alert('Failed to update platform. Please try again.');
    }
}

// Add this CSS to the head
const style = document.createElement('style');
style.textContent = `
    .update-button {
        position: relative;
        overflow: hidden;
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        background: #65B687;
        color: white;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 180px;
    }
    .update-button:disabled {
        cursor: not-allowed;
        opacity: 0.9;
    }
    .update-button .progress-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        transform-origin: left;
        transition: transform 0.3s ease;
    }
    .update-button .content {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        justify-content: center;
    }
    .update-button .refresh-icon {
        display: inline-block;
    }
    .update-button.updating .refresh-icon {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Find the update button
const updateButton = document.querySelector('.update-button');

// Update button click handler
updateButton.addEventListener('click', async () => {
    // Store original content and setup button
    const originalContent = updateButton.innerHTML;
    updateButton.disabled = true;
    updateButton.classList.add('updating');

    // Set up button structure
    updateButton.innerHTML = `
        <div class="progress-bg" style="transform: scaleX(0)"></div>
        <div class="content">
            <span class="refresh-icon">↻</span>
            <span class="status-text">Checking for updates...</span>
        </div>
    `;

    try {
        // Get elements
        const progressBar = updateButton.querySelector('.progress-bg');
        const statusText = updateButton.querySelector('.status-text');
        
        // Start with initial progress
        progressBar.style.transform = 'scaleX(0.2)'; // 20% initial progress

        // Get total count of items to check
        const { count: tvCount } = await supabase
            .from('tv_shows')
            .select('*', { count: 'exact', head: true });
            
        const { count: movieCount } = await supabase
            .from('movies')
            .select('*', { count: 'exact', head: true });
            
        const totalItems = (tvCount || 0) + (movieCount || 0);
        let checkedItems = 0;

        // Create a progress update function
        const updateProgress = (itemsChecked) => {
            checkedItems = itemsChecked;
            const progress = (checkedItems / totalItems) * 0.8 + 0.2; // 20-100%
            progressBar.style.transform = `scaleX(${progress})`;
            statusText.textContent = `Checking... ${Math.round(progress * 100)}%`;
        };

        // Check for updates with progress
        const changes = await updateService.checkForUpdates(true, true, updateProgress);
        
        // Show completion state
        progressBar.style.transform = 'scaleX(1)';
        statusText.textContent = 'Finished updating';

        // If there were changes, refresh the display
        if (changes && changes.length > 0) {
            localStorage.setItem('recentChanges', JSON.stringify(changes));
            renderNewsSection();
        }

        // Reset button after delay
        setTimeout(() => {
            updateButton.innerHTML = originalContent;
            updateButton.disabled = false;
            updateButton.classList.remove('updating');
        }, 2000);

    } catch (error) {
        console.error('Error checking for updates:', error);
        
        // Reset button immediately on error
        updateButton.innerHTML = originalContent;
        updateButton.disabled = false;
        updateButton.classList.remove('updating');
    }
});

// Image loading handling
function setupImageLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.onload = () => {
                    img.classList.add('loaded');
                    const placeholder = img.nextElementSibling;
                    if (placeholder && placeholder.classList.contains('image-placeholder')) {
                        placeholder.style.display = 'none';
                    }
                };
                // Start loading the image
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.1
    });

    // Observe all media posters
    document.querySelectorAll('.media-poster').forEach(img => {
        if (img.src && !img.src.includes('placeholder.jpg')) {
            img.dataset.src = img.src;
            img.src = 'placeholder.jpg';
            observer.observe(img);
        }
    });
}
