/**
 * The slices of TMDB's responses this project actually reads.
 *
 * Deliberately partial: TMDB returns far more than this, and every field here
 * is one the watchlist maps into a row or a badge. Everything is optional
 * except the identifiers, because TMDB omits rather than nulls for a lot of
 * these (an announced season has no `air_date`, a TV entry has no `runtime`).
 *
 * The Deno cron function cannot import from `src/`, so it keeps its own copy
 * of the shapes it needs -- same rule as `sync-logic.ts`.
 */

/** One streaming service in a `watch/providers` block. */
export interface TMDBProvider {
  provider_name?: string;
}

/** The providers available in one region, split by how you pay for them. */
export interface TMDBRegionProviders {
  flatrate?: TMDBProvider[];
  free?: TMDBProvider[];
  ads?: TMDBProvider[];
}

/** `append_to_response: 'watch/providers'` payload, keyed by ISO-2 region. */
export interface TMDBWatchProviders {
  results?: Record<string, TMDBRegionProviders | undefined>;
}

export interface TMDBGenre {
  id?: number;
  name: string;
}

/** A season as it appears in the show payload -- a summary, with no episodes. */
export interface TMDBSeasonSummary {
  id?: number;
  season_number: number;
  episode_count?: number;
  air_date?: string | null;
  name?: string;
}

export interface TMDBEpisode {
  id?: number;
  episode_number: number;
  name?: string;
  air_date?: string | null;
  runtime?: number | null;
}

/** `tv/{id}/season/{n}` -- the only place episodes come from. */
export interface TMDBSeasonDetails {
  episodes?: TMDBEpisode[];
}

/** `movie/{id}` or `tv/{id}`. Movie-only and TV-only fields are both optional. */
export interface TMDBDetails {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: TMDBGenre[];
  status?: string;
  seasons?: TMDBSeasonSummary[];
  'watch/providers'?: TMDBWatchProviders;
}

/** One row of `search/movie` or `search/tv`. */
export interface TMDBSearchItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  original_language?: string;
}

export interface TMDBSearchResponse {
  results?: TMDBSearchItem[];
}
