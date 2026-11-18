import type { TMDBCastMember, TMDBCrewMember, TMDBCreator } from './tmdb-types';

/**
 * Who made a title and who is in it, picked from a TMDB credits block.
 *
 * `pickDirectors`, `pickCreators` and `pickTopCast` have hand-maintained
 * copies in supabase/functions/watchlist-cron-sync, since Deno cannot import
 * from src/. Change both together -- same rule as `pickTrailerKey`.
 */

/** The `append_to_response` block that carries credits, by media type. */
export const CREDITS_APPEND = { movie: 'credits', tv: 'aggregate_credits' } as const;

export const TOP_CAST_SIZE = 3;

/** Trimmed, non-empty, first-seen-order, de-duplicated names. */
function uniqueNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw?.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/** Everyone credited as `Director`, in TMDB's order. A person can appear twice. */
export function pickDirectors(crew: TMDBCrewMember[] | undefined | null): string[] {
  return uniqueNames((crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name));
}

/** A show's creators, from `created_by`. */
export function pickCreators(createdBy: TMDBCreator[] | undefined | null): string[] {
  return uniqueNames((createdBy ?? []).map((c) => c.name));
}

/**
 * The lead actors. A show's aggregate credits carry `total_episode_count`, so
 * the people in the most episodes come first; a film's credits do not, so they
 * fall back to billing `order`. Missing counts tie at 0 and a missing order
 * sorts last.
 */
export function pickTopCast(cast: TMDBCastMember[] | undefined | null): string[] {
  const ranked = (cast ?? [])
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.name?.trim())
    .sort((a, b) => {
      const episodes = (b.member.total_episode_count ?? 0) - (a.member.total_episode_count ?? 0);
      if (episodes) return episodes;
      const order = (a.member.order ?? Infinity) - (b.member.order ?? Infinity);
      // Infinity - Infinity is NaN: both missing, so keep input order.
      return order || a.index - b.index;
    });
  return uniqueNames(ranked.map(({ member }) => member.name)).slice(0, TOP_CAST_SIZE);
}

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". No Oxford comma. */
export function joinNames(names: string[], max = 3): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length > max) {
    return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
