import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { WatchRecord } from './diary';

export const DIARY_EPISODE_SELECT = `id, episode_number, title, runtime, watched_at,
  tv_show_seasons!inner(season_number, tv_shows!inner(id, title, poster, genre, platform))`;
export const DIARY_MOVIE_SELECT = 'id, title, poster, genre, platform, runtime, watched_at';

const genresOf = (genre: string | null): string[] =>
  genre ? genre.split(',').map((g) => g.trim()).filter(Boolean) : [];

interface ShowRow {
  id: number;
  title: string;
  poster: string | null;
  genre: string | null;
  platform: string | null;
}
interface EpisodeRow {
  id: number;
  episode_number: number;
  title: string | null;
  runtime: number | null;
  watched_at: string | null;
  tv_show_seasons: { season_number: number; tv_shows: ShowRow | ShowRow[] } | { season_number: number; tv_shows: ShowRow | ShowRow[] }[];
}

const one = <T,>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value);

async function readDiary(): Promise<{ records: WatchRecord[] }> {
  const [episodesResult, moviesResult] = await Promise.all([
    selectAllPages((from, to) => supabase
      .from('tv_show_episodes')
      .select(DIARY_EPISODE_SELECT, { count: 'exact' })
      .eq('watched', true)
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id)),
    selectAllPages((from, to) => supabase
      .from('movies')
      .select(DIARY_MOVIE_SELECT, { count: 'exact' })
      .eq('watched', true)
      .order('id', { ascending: true })
      .range(from, to), (row) => String(row.id)),
  ]);
  if (episodesResult.error) throw episodesResult.error;
  if (moviesResult.error) throw moviesResult.error;

  const episodes = (episodesResult.data as unknown as EpisodeRow[]).map((row): WatchRecord => {
    const season = one(row.tv_show_seasons);
    const show = one(season.tv_shows);
    return {
      kind: 'episode',
      id: row.id,
      watchedAt: row.watched_at,
      runtime: row.runtime,
      titleId: String(show.id),
      title: show.title,
      poster: show.poster,
      seasonNumber: season.season_number,
      episodeNumber: row.episode_number,
      episodeTitle: row.title,
      genres: genresOf(show.genre),
      platform: show.platform,
    };
  });
  const films = moviesResult.data.map((row): WatchRecord => ({
    kind: 'movie',
    id: row.id,
    watchedAt: row.watched_at,
    runtime: row.runtime,
    titleId: String(row.id),
    title: row.title,
    poster: row.poster,
    genres: genresOf(row.genre),
    platform: row.platform,
  }));
  return { records: [...episodes, ...films] };
}

/** Every watched episode and film as a WatchRecord. Mutations invalidate this key. */
export const diaryQueryOptions = queryOptions({
  queryKey: ['watchlist', 'diary'],
  queryFn: readDiary,
});
