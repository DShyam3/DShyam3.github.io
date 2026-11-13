import type { TMDBVideo } from './tmdb-types';
import { isSpecialsSeason } from './watchlist-utils';

/**
 * Trailer selection and the embed URL built from it.
 *
 * `pickTrailerKey` has a hand-maintained copy in
 * supabase/functions/watchlist-cron-sync, since Deno cannot import from src/.
 * Change both together -- same rule as `getPlatform` in sync-logic.ts.
 */

/**
 * A YouTube video id. The database enforces the same pattern on every
 * `trailer_key` column; it is checked again here because the key is
 * interpolated into an iframe URL, and a stored value is not a trusted one.
 */
const YOUTUBE_KEY = /^[A-Za-z0-9_-]{6,20}$/;

export function isYouTubeKey(key: unknown): key is string {
  return typeof key === 'string' && YOUTUBE_KEY.test(key);
}

/**
 * Query params for every TMDB `videos` request: English and language-less
 * videos only. A title with only, say, a Japanese trailer gets none -- an
 * untranslated trailer is a worse result than no button. Mirrored as
 * `VIDEO_PARAMS` in watchlist-cron-sync.
 */
export const TRAILER_VIDEO_PARAMS = { include_video_language: 'en,null' } as const;

/** How much a video type is wanted. Types not listed are never picked. */
const TYPE_RANK: Record<string, number> = { Trailer: 2, Teaser: 1 };

/**
 * The best YouTube trailer in a TMDB `videos` list, or null when there is
 * none. Trailers beat teasers, official beats fan-uploaded, English beats
 * other languages, and among equals the most recently published wins (a
 * "final trailer" over the first teaser-length cut).
 */
export function pickTrailerKey(videos: TMDBVideo[] | undefined | null): string | null {
  let best: TMDBVideo | null = null;
  let bestScore: number[] = [];
  for (const video of videos ?? []) {
    if (video.site !== 'YouTube' || !isYouTubeKey(video.key)) continue;
    const typeRank = TYPE_RANK[video.type ?? ''];
    if (!typeRank) continue;
    const published = Date.parse(video.published_at ?? '');
    const score = [
      typeRank,
      video.official ? 1 : 0,
      video.iso_639_1 === 'en' ? 1 : 0,
      Number.isNaN(published) ? 0 : published,
    ];
    if (!best || compareScores(score, bestScore) > 0) {
      best = video;
      bestScore = score;
    }
  }
  return best?.key ?? null;
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Privacy-enhanced embed on youtube-nocookie.com, the only host `frame-src`
 * allows. It autoplays, so it is mounted only once the trailer button is
 * pressed: nothing reaches YouTube before that.
 */
export function trailerEmbedUrl(key: string): string | null {
  if (!isYouTubeKey(key)) return null;
  return `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0`;
}

/** The same video on youtube.com, for when the embed is blocked or unwanted. */
export function trailerWatchUrl(key: string): string | null {
  if (!isYouTubeKey(key)) return null;
  return `https://www.youtube.com/watch?v=${key}`;
}

export interface DetailTrailer {
  /** A valid YouTube id, or null when there is no trailer to offer. */
  key: string | null;
  /** Names the trailer's dialog: "Tulsa King" or "Tulsa King, Season 4". */
  title: string;
  label: string;
}

/**
 * The one trailer a title's detail offers. A show plays the selected season's
 * own trailer where TMDB has one, and the show's otherwise; specials always
 * take the show's. A film has only its own.
 */
export function detailTrailer(
  title: { title: string; trailer_key?: string | null },
  season?: { season_number: number; trailer_key?: string | null } | null,
): DetailTrailer {
  if (season && !isSpecialsSeason(season.season_number) && isYouTubeKey(season.trailer_key)) {
    const name = `Season ${season.season_number}`;
    return { key: season.trailer_key, title: `${title.title}, ${name}`, label: `Watch ${name} trailer` };
  }
  const key = isYouTubeKey(title.trailer_key) ? title.trailer_key : null;
  return { key, title: title.title, label: 'Watch trailer' };
}
