// Wrap in IIFE to prevent multiple executions
(function() {
    // Only initialize if not already done
    if (window.__mediaBoardConfigInitialized) {
        return;
    }
    window.__mediaBoardConfigInitialized = true;

    // Configuration values
    window.SUPABASE_URL = "https://yvtiybyuifkiwyrnjebe.supabase.co";
    window.SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGl5Ynl1aWZraXd5cm5qZWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMDI2MDAsImV4cCI6MjA1MzY3ODYwMH0.HDfXGowPGlrthUD87x2uNsprx_xySFiGojFcgabLtxQ";
    window.TMDB_API_KEY = "784d3314cee165d07cc55d1ac2f027ee";
    window.TMDB_BASE_URL = "https://api.themoviedb.org/3";
    window.TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

    // Create Supabase client
    window.__supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_API_KEY);
})();

// Create global variables for backward compatibility
// Use var to allow redeclaration if script is loaded multiple times
var SUPABASE_URL = window.SUPABASE_URL;
var SUPABASE_API_KEY = window.SUPABASE_API_KEY;
var TMDB_API_KEY = window.TMDB_API_KEY;
var TMDB_BASE_URL = window.TMDB_BASE_URL;
var TMDB_IMAGE_BASE_URL = window.TMDB_IMAGE_BASE_URL;
var supabase = window.__supabaseClient;
