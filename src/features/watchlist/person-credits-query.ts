import { supabase } from '@/integrations/supabase/client';
import {
  normalizeCombinedCredits,
  type RawTmdbCreditEntry,
  type TmdbPersonFilmography,
} from './person-credits';
import type { WatchlistItem } from './WatchlistContext';

/**
 * Find all titles in the user's library that credit `name` in `directors`,
 * `creators`, or `top_cast`. Runs 4 tiny indexed `.select('id')` queries
 * with zero TMDB calls.
 */
export async function fetchPersonLibraryMatches(
  name: string,
  watchlist: WatchlistItem[],
): Promise<WatchlistItem[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const [movieDirectors, movieCast, showCreators, showCast] = await Promise.all([
    supabase.from('movies').select('id').contains('directors', [trimmed]),
    supabase.from('movies').select('id').contains('top_cast', [trimmed]),
    supabase.from('tv_shows').select('id').contains('creators', [trimmed]),
    supabase.from('tv_shows').select('id').contains('top_cast', [trimmed]),
  ]);

  const movieIds = new Set<string>();
  for (const row of movieDirectors.data ?? []) movieIds.add(String(row.id));
  for (const row of movieCast.data ?? []) movieIds.add(String(row.id));

  const showIds = new Set<string>();
  for (const row of showCreators.data ?? []) showIds.add(String(row.id));
  for (const row of showCast.data ?? []) showIds.add(String(row.id));

  const lower = trimmed.toLowerCase();
  const hasName = (list?: string[]) => list?.some((n) => n.trim().toLowerCase() === lower) ?? false;

  return watchlist.filter((item) => {
    if (item.category === 'Movies') {
      return movieIds.has(item.id) || hasName(item.directors) || hasName(item.top_cast);
    }
    return showIds.has(item.id) || hasName(item.creators) || hasName(item.top_cast);
  });
}

async function invokeTmdbProxy<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(`tmdb-proxy?${query}`, { method: 'GET' });
  if (error) throw error;
  return data as T;
}

/**
 * Look up a person on TMDB by name and return their combined filmography.
 * Called only on explicit user request from the person dialog.
 */
export async function fetchTmdbPersonFilmography(
  name: string,
): Promise<TmdbPersonFilmography | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const search = await invokeTmdbProxy<{
    results?: Array<{
      id: number;
      name: string;
      known_for_department?: string;
      profile_path?: string | null;
    }>;
  }>('search/person', { query: trimmed, include_adult: 'false' });

  const results = search.results ?? [];
  if (results.length === 0) return null;

  const lower = trimmed.toLowerCase();
  const best = results.find((r) => r.name.trim().toLowerCase() === lower) ?? results[0];

  const credits = await invokeTmdbProxy<{
    cast?: RawTmdbCreditEntry[];
    crew?: RawTmdbCreditEntry[];
  }>(`person/${best.id}/combined_credits`, { language: 'en-GB' });

  return {
    person: {
      id: best.id,
      name: best.name,
      knownForDepartment: best.known_for_department,
      profileUrl: best.profile_path ? `https://image.tmdb.org/t/p/w185${best.profile_path}` : undefined,
    },
    credits: normalizeCombinedCredits(credits.cast ?? [], credits.crew ?? []),
  };
}

/** Lightweight TMDB profile-photo lookup for Cool facts avatars. */
export async function fetchTmdbPersonProfileUrl(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const search = await invokeTmdbProxy<{
    results?: Array<{ name: string; profile_path?: string | null }>;
  }>('search/person', { query: trimmed, include_adult: 'false' });
  const results = search.results ?? [];
  if (results.length === 0) return null;
  const lower = trimmed.toLowerCase();
  const best = results.find((r) => r.name.trim().toLowerCase() === lower) ?? results[0];
  return best.profile_path ? `https://image.tmdb.org/t/p/w185${best.profile_path}` : null;
}
