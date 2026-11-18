import type { WatchlistItem } from './WatchlistContext';
import type { DiscoveryItem, DiscoveryMedia } from './discovery';
import type { useTMDB } from './useTMDB';

type Detail = NonNullable<Awaited<ReturnType<ReturnType<typeof useTMDB>['getMovieDetails']>>>;

/** Film production states must never become a series' personal-library status. */
export function seriesStatus(media: DiscoveryMedia, status: string | undefined): WatchlistItem['series_status'] {
  if (media !== 'tv') return undefined;
  switch (status) {
    case 'Returning Series':
    case 'In Production':
    case 'Ended':
    case 'Canceled':
    case 'Cancelled':
      return status;
    default:
      return undefined;
  }
}

/** Keep the same title metadata whether Discover adds a future watch or a seen title. */
export function discoveryAddPayload(item: DiscoveryItem, data: Detail, watched: boolean): Omit<WatchlistItem, 'id' | 'created_at'> {
  const title = data.title || item.title || item.name || 'Untitled';
  return {
    title: data.release_year ? `${title} (${data.release_year})` : title,
    category: item.media === 'movie' ? 'Movies' : 'TV Shows',
    description: data.overview,
    year: data.release_year ?? undefined,
    image_url: data.poster ?? undefined,
    backdrop_url: data.backdrop ?? undefined,
    runtime: data.runtime ?? undefined,
    genres: data.genres,
    genre_ids: data.genre_ids,
    original_language: data.original_language,
    origin_country: data.origin_country,
    tmdb_id: item.id,
    release_date: data.release_date ?? undefined,
    streaming_platform: data.platform,
    trailer_key: data.trailer_key ?? undefined,
    series_status: data.series_status,
    directors: data.directors ?? undefined,
    creators: data.creators ?? undefined,
    top_cast: data.top_cast ?? undefined,
    // So the nightly sync can score it (OMDb is asked by IMDb id) and a film
    // shows in its series on Franchises without waiting for a resync.
    imdb_id: data.imdb_id ?? undefined,
    collection_id: data.collection_id ?? undefined,
    collection_name: data.collection_name ?? undefined,
    watched,
  };
}
