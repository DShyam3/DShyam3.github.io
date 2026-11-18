import type { WatchlistItem } from './WatchlistContext';

/** Reusable labels derived from TMDB metadata, never stored per title. */
export const LIBRARY_CATEGORIES = ['Anime', 'Cartoon', 'K-Drama (TV)', 'Action', 'Sci-Fi', 'Documentary'] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export function libraryCategories(item: Pick<WatchlistItem, 'category' | 'genres' | 'genre_ids' | 'original_language' | 'origin_country'>): LibraryCategory[] {
  const ids = item.genre_ids;
  const names = (item.genres ?? []).map((genre) => genre.toLowerCase());
  const hasGenre = (id: number, ...aliases: string[]) =>
    ids != null ? ids.includes(id) : aliases.some((name) => names.includes(name));
  const language = item.original_language?.trim().toLowerCase();
  const countries = (item.origin_country ?? []).map((country) => country.toUpperCase());
  const japanese = language === 'ja' || countries.includes('JP');
  const korean = language === 'ko' || countries.includes('KR');
  const categories: LibraryCategory[] = [];

  if (hasGenre(16, 'animation')) {
    if (japanese) categories.push('Anime');
    else if (language || countries.length) categories.push('Cartoon');
  }
  if (item.category === 'TV Shows' && korean && hasGenre(18, 'drama')) categories.push('K-Drama (TV)');
  if (hasGenre(item.category === 'TV Shows' ? 10759 : 28, 'action', 'action & adventure')) categories.push('Action');
  if (hasGenre(item.category === 'TV Shows' ? 10765 : 878, 'science fiction', 'sci-fi', 'sci-fi & fantasy')) categories.push('Sci-Fi');
  if (hasGenre(99, 'documentary')) categories.push('Documentary');
  return categories;
}
