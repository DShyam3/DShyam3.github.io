import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { CreditsRow } from './cool-facts';

/**
 * Fetch per-title `directors`, `creators`, and `top_cast` for the Cool facts
 * tab only, keeping the main Library grid payload small.
 */
export async function fetchWatchlistCreditsIndex(): Promise<Map<string, CreditsRow>> {
  const [moviesResult, showsResult] = await Promise.all([
    selectAllPages(
      (from, to) =>
        supabase
          .from('movies')
          .select('id, directors, top_cast', { count: 'exact' })
          .order('id', { ascending: true })
          .range(from, to),
      (row) => String(row.id),
    ),
    selectAllPages(
      (from, to) =>
        supabase
          .from('tv_shows')
          .select('id, creators, top_cast', { count: 'exact' })
          .order('id', { ascending: true })
          .range(from, to),
      (row) => String(row.id),
    ),
  ]);

  if (moviesResult.error) throw moviesResult.error;
  if (showsResult.error) throw showsResult.error;

  const map = new Map<string, CreditsRow>();
  for (const movie of moviesResult.data ?? []) {
    const key = `Movies:${movie.id}`;
    map.set(key, {
      key,
      directors: movie.directors,
      top_cast: movie.top_cast,
    });
  }
  for (const show of showsResult.data ?? []) {
    const key = `TV Shows:${show.id}`;
    map.set(key, {
      key,
      creators: show.creators,
      top_cast: show.top_cast,
    });
  }
  return map;
}
