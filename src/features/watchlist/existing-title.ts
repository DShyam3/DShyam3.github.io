import type { WatchlistItem } from './WatchlistContext';
import type { TMDBResult } from './useTMDB';

/** Match by TMDB identity, then the same exact title fallback as the add mutation. */
export function findExistingTitle(items: WatchlistItem[], result: TMDBResult): WatchlistItem | undefined {
  const category = result.media_type === 'tv' ? 'TV Shows' : 'Movies';
  const name = result.title || result.name || '';
  const year = (result.release_date || result.first_air_date || '').slice(0, 4);
  const storedTitle = year ? `${name} (${year})` : name;
  return items.find((item) => item.category === category && item.tmdb_id === result.id)
    ?? items.find((item) => item.category === category && item.title.toLowerCase() === storedTitle.toLowerCase());
}

