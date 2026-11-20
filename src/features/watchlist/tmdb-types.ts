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

/** One entry of an `append_to_response: 'videos'` block. */
export interface TMDBVideo {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
  iso_639_1?: string | null;
  published_at?: string;
}

/** `append_to_response: 'videos'` payload. */
export interface TMDBVideos {
  results?: TMDBVideo[];
}

/** One entry of a credits block's `cast`. `total_episode_count` is aggregate_credits only. */
export interface TMDBCastMember {
  name?: string;
  order?: number;
  total_episode_count?: number;
}

/** One entry of a credits block's `crew`. */
export interface TMDBCrewMember {
  name?: string;
  job?: string;
}

/** `append_to_response: 'credits'` (films) or `'aggregate_credits'` (shows). */
export interface TMDBCredits {
  cast?: TMDBCastMember[];
  crew?: TMDBCrewMember[];
}

/** One entry of a show's `created_by`. */
export interface TMDBCreator {
  name?: string;
}

/** `tv/{id}/season/{n}` -- the only place episodes come from. */
export interface TMDBSeasonDetails {
  episodes?: TMDBEpisode[];
  videos?: TMDBVideos;
}

/** `movie/{id}` or `tv/{id}`. Movie-only and TV-only fields are both optional. */
export interface TMDBDetails {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  original_language?: string;
  // ISO 3166-1 alpha-2 on TV. Films use production_countries instead.
  origin_country?: string[];
  production_countries?: { iso_3166_1: string }[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: TMDBGenre[];
  status?: string;
  number_of_seasons?: number;
  seasons?: TMDBSeasonSummary[];
  'watch/providers'?: TMDBWatchProviders;
  videos?: TMDBVideos;
  credits?: TMDBCredits;
  aggregate_credits?: TMDBCredits;
  created_by?: TMDBCreator[];
  /** Films: on the record itself. TV: under `external_ids`. */
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
  /** Films only: the series it belongs to, e.g. "X-Men Collection". */
  belongs_to_collection?: TMDBCollectionRef | null;
  vote_average?: number;
  vote_count?: number;
}

export interface TMDBCollectionRef {
  id?: number;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
}

/** `collection/{id}`: a film series and its parts. */
export interface TMDBCollection {
  id?: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: {
    id?: number;
    title?: string;
    release_date?: string | null;
    poster_path?: string | null;
    overview?: string;
  }[];
}

/** One spin-off / parent TV link returned by `tmdb-proxy?endpoint=wikidata/tv-spinoffs`. */
export interface WikidataTvSpinoffLink {
  seedTmdbId: number;
  seedTitle: string;
  franchiseId: string | null;
  franchiseName: string | null;
  relatedMediaType: 'tv' | 'movie';
  relatedTmdbId: number;
  relatedTitle: string;
  releaseDate: string | null;
  posterPath?: string | null;
}

/**
 * One film of a shared universe (`wikidata/film-universes`): a Wikidata
 * series spanning several TMDB collections, such as the Marvel Cinematic
 * Universe. Title, date and poster are TMDB's where it answered.
 */
export interface FilmUniverseMember {
  /** Wikidata id of the universe, e.g. `Q642878`. */
  universeId: string;
  universeName: string;
  tmdbId: number;
  title: string | null;
  releaseDate: string | null;
  posterPath: string | null;
}

/** One row of `search/movie` or `search/tv`. */
export interface TMDBSearchItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  original_language?: string;
  // TV search only; absent from `search/movie`.
  origin_country?: string[];
  // Ids rather than names -- the search endpoints never expand them. 16 is
  // Animation, 18 is Drama.
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

export interface TMDBSearchResponse {
  results?: TMDBSearchItem[];
}
