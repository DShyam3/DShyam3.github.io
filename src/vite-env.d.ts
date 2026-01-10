/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
    readonly VITE_TMDB_API_KEY: string
    readonly VITE_TMDB_BASE_URL: string
    readonly VITE_TMDB_IMAGE_BASE_URL: string
    readonly VITE_ADMIN_PASSWORD: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
