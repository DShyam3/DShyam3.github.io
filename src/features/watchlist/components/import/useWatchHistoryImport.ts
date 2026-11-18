import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWatchlistContext } from '../../WatchlistContext';
import { watchlistLibraryQuery } from '../../library-query';
import { invalidateWatchDerived } from '../../up-next-query';
import { useTMDB } from '../../useTMDB';
import { releaseYear } from '../../watchlist-utils';
import { LETTERBOXD_MAX_BYTES, parseLetterboxdFiles } from '../../letterboxd-import';
import { TRAKT_MAX_BYTES, parseTraktFiles } from '../../trakt-import';
import {
  buildImportPayload, buildLibraryIndex, chunk, classifyCandidates, filmsFromLetterboxd, importFromTrakt,
  matchFilm, matchShow, titlesToAdd,
  type Candidate, type ImportEpisode, type ImportFilm, type ImportPlan, type ImportRating, type ImportShowRef, type Resolution,
} from '../../import-match';

export type ImportSource = 'letterboxd' | 'trakt';
export type ImportStage = 'pick' | 'matching' | 'review' | 'applying' | 'done';

/** The proxy allows 60 requests a minute per address. */
const SEARCH_GAP_MS = 1100;

export interface ParsedImport {
  films: ImportFilm[];
  shows: ImportShowRef[];
  episodes: ImportEpisode[];
  ratings: ImportRating[];
  notes: string[];
}
export interface ImportOutcome {
  added: number;
  failedAdds: string[];
  marked: { episodes_marked: number; movies_marked: number; dated: number; ratings_set: number };
  notFound: { episodes: number; films: number; ratings: number };
}
export interface ImportFailure { step: string; message: string; saved: string }
export interface ImportProgress { label: string; done: number; total: number }

const RETRY_WAIT_MS = 30_000;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const asCount = (value: unknown) => typeof value === 'number' ? value : 0;

export function useWatchHistoryImport() {
  const queryClient = useQueryClient();
  const { watchlist, addWatchlistItem, fetchData } = useWatchlistContext();
  const { searchTitles, getPosterUrl, getMovieDetails } = useTMDB();
  const [stage, setStage] = useState<ImportStage>('pick');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const cancelled = useRef(false);
  const lastCall = useRef(0);

  const reset = () => {
    cancelled.current = true;
    setStage('pick'); setParsed(null); setParseError(null); setPlan(null); setProgress(null); setOutcome(null); setFailure(null);
  };

  const parseFiles = async (source: ImportSource, files: File[]) => {
    setParseError(null); setParsed(null);
    if (files.length === 0) return;
    const cap = source === 'letterboxd' ? LETTERBOXD_MAX_BYTES : TRAKT_MAX_BYTES;
    const tooBig = files.find(file => file.size > cap);
    if (tooBig) { setParseError(`${tooBig.name} is larger than ${cap / (1024 * 1024)} MB.`); return; }
    try {
      const texts = await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })));
      if (source === 'letterboxd') {
        const result = parseLetterboxdFiles(texts);
        const notes = result.files.map(file => `${file.name}: ${file.kind === 'unknown' ? 'not recognised, skipped' : `${file.kind}, ${file.rows} rows`}`);
        if (result.skipped.length > 0) {
          notes.push(`${result.skipped.length} row${result.skipped.length === 1 ? '' : 's'} skipped, for example: ${result.skipped.slice(0, 3).map(s => `${s.file} row ${s.row} (${s.reason})`).join('; ')}`);
        }
        setParsed({ films: filmsFromLetterboxd(result.films), shows: [], episodes: [], ratings: [], notes });
      } else {
        const result = parseTraktFiles(texts);
        const notes = result.files.map(file => `${file.name}: ${file.items} items`);
        if (result.skipped > 0) {
          notes.push(`${result.skipped} item${result.skipped === 1 ? '' : 's'} skipped: ${Object.entries(result.skippedReasons).map(([reason, n]) => `${reason} (${n})`).join(', ')}`);
        }
        setParsed({ ...importFromTrakt(result), notes });
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Could not read these files.');
    }
  };

  /**
   * One TMDB search, paced against the last one. A failed call (often the
   * proxy's 60-a-minute limit) waits 30 s and is tried once more; a second
   * failure gives no candidates, so the title lands in "Not found".
   */
  const searchCandidates = async (title: string, category: 'Movies' | 'TV Shows'): Promise<Candidate[]> => {
    const attempt = async () => {
      const wait = SEARCH_GAP_MS - (Date.now() - lastCall.current);
      if (wait > 0) await sleep(wait);
      lastCall.current = Date.now();
      return searchTitles(title, category);
    };
    let results;
    try {
      results = await attempt();
    } catch {
      if (cancelled.current) return [];
      await sleep(RETRY_WAIT_MS);
      try {
        results = await attempt();
      } catch (error) {
        console.error(`TMDB search failed twice for "${title}":`, error);
        return [];
      }
    }
    return results.map(item => ({
      id: item.id,
      title: item.title ?? item.name ?? '',
      year: releaseYear(item.release_date ?? item.first_air_date) ?? null,
      poster: item.poster_path ? getPosterUrl(item.poster_path) : null,
    }));
  };

  const resolveBySearch = async (title: string, year: number | null, category: 'Movies' | 'TV Shows'): Promise<Resolution> => {
    const candidates = await searchCandidates(title, category);
    const verdict = classifyCandidates({ title, year }, candidates);
    if (verdict.status === 'confident') {
      const { match } = verdict;
      return { status: 'new', tmdbId: match.id, title: match.title, year: match.year, poster: match.poster, include: false };
    }
    if (verdict.status === 'unsure') return { status: 'unsure', candidates: verdict.candidates, chosen: null };
    return { status: 'missing' };
  };

  const startMatching = async () => {
    if (!parsed) return;
    cancelled.current = false;
    setStage('matching'); setFailure(null);
    const index = buildLibraryIndex(watchlist);
    const films = parsed.films.map(film => ({ film, resolution: matchFilm(film, index) }));
    const shows = parsed.shows.map(ref => ({ ref, resolution: matchShow(ref, index) }));
    const total = films.filter(f => !f.resolution).length + shows.filter(s => !s.resolution).length;
    let done = 0;
    setProgress({ label: 'Looking titles up', done, total });
    for (const entry of films) {
      if (entry.resolution) continue;
      if (cancelled.current) return;
      entry.resolution = await resolveBySearch(entry.film.name, entry.film.year, 'Movies');
      setProgress({ label: `Looking up ${entry.film.name}`, done: ++done, total });
    }
    for (const entry of shows) {
      if (entry.resolution) continue;
      if (cancelled.current) return;
      entry.resolution = await resolveBySearch(entry.ref.title, entry.ref.year, 'TV Shows');
      setProgress({ label: `Looking up ${entry.ref.title}`, done: ++done, total });
    }
    if (cancelled.current) return;
    setPlan({
      films: films.map(f => ({ film: f.film, resolution: f.resolution ?? { status: 'missing' } })),
      shows: shows.map(s => ({ ref: s.ref, resolution: s.resolution ?? { status: 'missing' } })),
      episodes: parsed.episodes,
      ratings: parsed.ratings,
    });
    setProgress(null);
    setStage('review');
  };

  const cancelMatching = () => { cancelled.current = true; setProgress(null); setStage('pick'); };

  const apply = async () => {
    if (!plan) return;
    cancelled.current = false;
    setStage('applying'); setFailure(null);
    const adds = titlesToAdd(plan);
    const failedAdds: string[] = [];
    let added = 0;
    let step = 'Adding new titles';
    let marked = { episodes_marked: 0, movies_marked: 0, dated: 0, ratings_set: 0 };
    const savedText = () => [
      added > 0 ? `${added} new title${added === 1 ? '' : 's'} added to your library (not rolled back)` : 'No new titles were added',
      marked.movies_marked + marked.episodes_marked > 0
        ? `${marked.movies_marked} films and ${marked.episodes_marked} episodes marked watched` : 'nothing marked watched yet',
    ].join('; ');
    try {
      for (const [i, entry] of adds.entries()) {
        const wait = SEARCH_GAP_MS - (Date.now() - lastCall.current);
        if (wait > 0) await sleep(wait);
        lastCall.current = Date.now();
        setProgress({ label: `Adding title ${i + 1} of ${adds.length}`, done: i, total: adds.length });
        const details = await getMovieDetails(entry.tmdbId, entry.category === 'Movies' ? 'movie' : 'tv');
        const ok = details && await addWatchlistItem({
          title: details.release_year ? `${details.title} (${details.release_year})` : details.title,
          category: entry.category,
          description: details.overview,
          year: details.release_year || undefined,
          image_url: details.poster || undefined,
          backdrop_url: details.backdrop || undefined,
          runtime: details.runtime || undefined,
          genres: details.genres,
          tmdb_id: details.tmdb_id,
          release_date: details.release_date,
          streaming_platform: details.platform,
          trailer_key: details.trailer_key ?? undefined,
          tmdb_vote_average: details.tmdb_vote_average ?? undefined,
          tmdb_vote_count: details.tmdb_vote_count ?? undefined,
          collection_id: details.collection_id ?? undefined,
          collection_name: details.collection_name ?? undefined,
          directors: details.directors ?? undefined,
          creators: details.creators ?? undefined,
          top_cast: details.top_cast ?? undefined,
        }, { quiet: true, skipRefresh: true });
        if (ok) added += 1; else failedAdds.push(details?.title ?? `TMDB ${entry.tmdbId}`);
      }

      step = 'Reading the updated library';
      setProgress({ label: 'Reading your library', done: 0, total: 1 });
      await fetchData();
      const fresh = queryClient.getQueryData(watchlistLibraryQuery.queryKey)?.watchlist;
      if (!fresh) throw new Error('The library could not be read back.');

      step = 'Marking titles watched';
      const payload = buildImportPayload(plan, fresh);
      const parts = {
        episodes: chunk(payload.p_episodes), movies: chunk(payload.p_movies),
        shows: chunk(payload.p_shows), seasons: chunk(payload.p_seasons),
      };
      const batches = Math.max(1, parts.episodes.length, parts.movies.length, parts.shows.length, parts.seasons.length);
      for (let i = 0; i < batches; i++) {
        setProgress({ label: `Saving batch ${i + 1} of ${batches}`, done: i, total: batches });
        const { data, error } = await supabase.rpc('import_watch_history', {
          p_episodes: parts.episodes[i] ?? [], p_movies: parts.movies[i] ?? [],
          p_shows: parts.shows[i] ?? [], p_seasons: parts.seasons[i] ?? [],
        });
        if (error) throw error;
        const counts = (data ?? {}) as Record<string, unknown>;
        marked = {
          episodes_marked: marked.episodes_marked + asCount(counts.episodes_marked),
          movies_marked: marked.movies_marked + asCount(counts.movies_marked),
          dated: marked.dated + asCount(counts.dated),
          ratings_set: marked.ratings_set + asCount(counts.ratings_set),
        };
      }

      step = 'Refreshing the page';
      await fetchData();
      await invalidateWatchDerived(queryClient);
      setOutcome({ added, failedAdds, marked, notFound: payload.notFound });
      setProgress(null);
      setStage('done');
    } catch (error) {
      setProgress(null);
      setFailure({ step, message: error instanceof Error ? error.message : 'Something went wrong.', saved: savedText() });
      setStage('review');
      void fetchData();
    }
  };

  return {
    stage, parsed, parseError, plan, setPlan, progress, outcome, failure,
    parseFiles, startMatching, cancelMatching, apply, reset,
  };
}
