import type { WatchlistItem } from './WatchlistContext';
import type { useTMDB } from './useTMDB';

/** What `useTMDB().getMovieDetails` resolves to when it finds the title. */
export type TitleDetails = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

/**
 * The library item a TMDB detail read becomes, for every add path (Library
 * search, Franchises, the history import). One mapping, so a field added to
 * the detail read reaches all three. Film and show titles are stored as
 * "Title (Year)".
 */
export function newItemFromDetails(
  details: TitleDetails,
  category: 'Movies' | 'TV Shows',
): Omit<WatchlistItem, 'id' | 'created_at'> {
  return {
    title: details.release_year ? `${details.title} (${details.release_year})` : details.title,
    category,
    description: details.overview,
    year: details.release_year || undefined,
    image_url: details.poster || undefined,
    backdrop_url: details.backdrop || undefined,
    runtime: details.runtime || undefined,
    genres: details.genres,
    genre_ids: details.genre_ids,
    original_language: details.original_language,
    origin_country: details.origin_country,
    tmdb_id: details.tmdb_id,
    release_date: details.release_date ?? undefined,
    streaming_platform: details.platform,
    trailer_key: details.trailer_key ?? undefined,
    imdb_id: details.imdb_id ?? undefined,
    collection_id: details.collection_id ?? undefined,
    collection_name: details.collection_name ?? undefined,
    directors: details.directors ?? undefined,
    creators: details.creators ?? undefined,
    top_cast: details.top_cast ?? undefined,
  };
}
