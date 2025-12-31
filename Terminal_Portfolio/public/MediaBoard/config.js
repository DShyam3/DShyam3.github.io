// Configuration template - Copy this to config.js and fill in your API keys
// DO NOT commit config.js to git - it's in .gitignore
// Configuration constants - check window first to avoid redeclaration errors
if (typeof window.SUPABASE_URL === 'undefined') {
    window.SUPABASE_URL = "";
    window.SUPABASE_API_KEY = "";
    window.TMDB_API_KEY = "";
    window.TMDB_BASE_URL = "https://api.themoviedb.org/3";
    window.TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
}

// Create local variables that reference window (var allows redeclaration)
var SUPABASE_URL = window.SUPABASE_URL;
var SUPABASE_API_KEY = window.SUPABASE_API_KEY;
var TMDB_API_KEY = window.TMDB_API_KEY;
var TMDB_BASE_URL = window.TMDB_BASE_URL;
var TMDB_IMAGE_BASE_URL = window.TMDB_IMAGE_BASE_URL;

// Create supabase client - reuse if already exists
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_API_KEY);
}
var supabase = window.supabaseClient;

