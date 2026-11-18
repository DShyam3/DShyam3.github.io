import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWatchlistContext } from '../../WatchlistContext';
import { watchlistLibraryQuery } from '../../library-query';
import { newItemFromDetails } from '../../new-item';
import { watchlistRatingsQuery } from '../../ratings-query';
import { invalidateWatchDerived } from '../../up-next-query';
import { useTMDB } from '../../useTMDB';
import { releaseYear } from '../../watchlist-utils';
import { LETTERBOXD_MAX_BYTES, parseLetterboxdFiles } from '../../letterboxd-import';
import { TRAKT_MAX_BYTES, parseTraktFiles } from '../../trakt-import';
import {
  buildImportPayload, buildLibraryIndex, chunk, classifyCandidates, filmsFromLetterboxd, importFromTrakt,
  matchFilm, matchShow, resolveVerdict, titlesToAdd,
  type Candidate, type ImportEpisode, type ImportFilm, type ImportPlan, type ImportRating, type ImportShowRef, type LibraryIndex, type Resolution,
} from '../../import-match';

export type ImportSource = 'letterboxd' | 'trakt';
export type ImportStage = 'pick' | 'matching' | 'review' | 'applying' | 'done';

/** The proxy allows 60 requests a minute per address: one TMDB request per gap. */
const REQUEST_GAP_MS = 1100;
/** The proxy's rate window is a fixed 60 s, so a retry waits it out. */
const RETRY_WAIT_MS = 60_000;

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
  marked: { episodes_marked: number; movies_marked: number; movies_dated: number; episodes_dated: number; ratings_set: number };
  notFound: { episodes: number; films: number; ratings: number };
}
export interface ImportFailure { step: string; message: string; saved: string }
export interface ImportProgress { label: string; done: number; total: number }

/** Thrown inside a run that was cancelled, closed or unmounted; unwinds it silently. */
class RunCancelled extends Error {}
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
  const runId = useRef(0);
  /** When the next TMDB request may go out. */
  const nextFree = useRef(0);

  // A closed dialog must not keep searching or adding.
  useEffect(() => () => { runId.current++; }, []);

  const assertLive = (myRun: number) => { if (runId.current !== myRun) throw new RunCancelled(); };
  const wait = async (ms: number, myRun: number) => { await sleep(ms); assertLive(myRun); };
  /** Waits for a free slot, then books `calls` requests' worth of the rate window. */
  const pace = async (myRun: number, calls = 1) => {
    const ahead = nextFree.current - Date.now();
    if (ahead > 0) await wait(ahead, myRun);
    nextFree.current = Math.max(Date.now(), nextFree.current) + calls * REQUEST_GAP_MS;
  };

  const reset = () => {
    runId.current++;
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
   * One paced TMDB search. A failed call (often the proxy's rate limit) waits
   * out its 60 s window and is tried once more; a second failure is null, which
   * the caller reports as a failed lookup rather than a title TMDB lacks.
   */
  const searchCandidates = async (myRun: number, title: string, category: 'Movies' | 'TV Shows', year?: number): Promise<Candidate[] | null> => {
    const attempt = async () => {
      await pace(myRun);
      const found = await searchTitles(title, category, year);
      assertLive(myRun);
      return found;
    };
    let results;
    try {
      results = await attempt();
    } catch (error) {
      if (error instanceof RunCancelled) throw error;
      await wait(RETRY_WAIT_MS, myRun);
      try {
        results = await attempt();
      } catch (retryError) {
        if (retryError instanceof RunCancelled) throw retryError;
        console.error(`TMDB search failed twice for "${title}":`, retryError);
        return null;
      }
    }
    return results.map(item => ({
      id: item.id,
      title: item.title ?? item.name ?? '',
      year: releaseYear(item.release_date ?? item.first_air_date) ?? null,
      poster: item.poster_path ? getPosterUrl(item.poster_path) : null,
    }));
  };

  /** Year first when there is one; with no year, or nothing found with it, search without. */
  const resolveBySearch = async (myRun: number, title: string, year: number | null, category: 'Movies' | 'TV Shows', index: LibraryIndex): Promise<Resolution> => {
    let candidates = await searchCandidates(myRun, title, category, year ?? undefined);
    if (candidates?.length === 0 && year !== null) candidates = await searchCandidates(myRun, title, category);
    if (candidates === null) return { status: 'failed' };
    return resolveVerdict(classifyCandidates({ title, year }, candidates), index, category);
  };

  const startMatching = async () => {
    if (!parsed) return;
    const myRun = ++runId.current;
    setStage('matching'); setFailure(null);
    const index = buildLibraryIndex(watchlist);
    const films = parsed.films.map(film => ({ film, resolution: matchFilm(film, index) }));
    const shows = parsed.shows.map(ref => ({ ref, resolution: matchShow(ref, index) }));
    const total = films.filter(f => !f.resolution).length + shows.filter(s => !s.resolution).length;
    let done = 0;
    setProgress({ label: 'Looking titles up', done, total });
    try {
      for (const entry of films) {
        if (entry.resolution) continue;
        assertLive(myRun);
        setProgress({ label: `Looking up ${entry.film.name}`, done, total });
        entry.resolution = await resolveBySearch(myRun, entry.film.name, entry.film.year, 'Movies', index);
        done += 1;
      }
      for (const entry of shows) {
        if (entry.resolution) continue;
        assertLive(myRun);
        setProgress({ label: `Looking up ${entry.ref.title}`, done, total });
        entry.resolution = await resolveBySearch(myRun, entry.ref.title, entry.ref.year, 'TV Shows', index);
        done += 1;
      }
    } catch (error) {
      if (error instanceof RunCancelled) return;
      throw error;
    }
    if (runId.current !== myRun) return;
    setPlan({
      films: films.map(f => {
        const resolution: Resolution = f.resolution ?? { status: 'missing' };
        // Rated but never logged as watched: offered, not assumed.
        const unticked = f.film.ratedOnly && (resolution.status === 'library' || resolution.status === 'new') ? { ...resolution, include: false } : resolution;
        return { film: f.film, resolution: unticked };
      }),
      shows: shows.map(s => ({ ref: s.ref, resolution: s.resolution ?? { status: 'missing' } })),
      episodes: parsed.episodes,
      ratings: parsed.ratings,
    });
    setProgress(null);
    setStage('review');
  };

  const cancelMatching = () => { runId.current++; setProgress(null); setStage('pick'); };

  const apply = async () => {
    if (!plan) return;
    const myRun = ++runId.current;
    setStage('applying'); setFailure(null);
    // Titles the library already holds are not added again, so "added" counts real adds.
    const index = buildLibraryIndex(watchlist);
    const adds = titlesToAdd(plan).filter(entry => !(entry.category === 'Movies' ? index.filmByTmdb : index.showByTmdb).has(entry.tmdbId));
    const failedAdds: string[] = [];
    let added = 0;
    let step = 'Adding new titles';
    let marked = { episodes_marked: 0, movies_marked: 0, movies_dated: 0, episodes_dated: 0, ratings_set: 0 };
    const savedText = () => [
      `${added} title${added === 1 ? '' : 's'} added to your library`,
      `${marked.movies_marked} film${marked.movies_marked === 1 ? '' : 's'} and ${marked.episodes_marked} episode${marked.episodes_marked === 1 ? '' : 's'} marked watched`,
      `${marked.movies_dated + marked.episodes_dated} watch date${marked.movies_dated + marked.episodes_dated === 1 ? '' : 's'} set`,
      `${marked.ratings_set} rating${marked.ratings_set === 1 ? '' : 's'} set`,
    ].join('; ');
    try {
      for (const [i, entry] of adds.entries()) {
        setProgress({ label: `Adding ${entry.title}`, done: i, total: adds.length });
        const type = entry.category === 'Movies' ? 'movie' : 'tv';
        await pace(myRun);
        let details = await getMovieDetails(entry.tmdbId, type);
        assertLive(myRun);
        if (!details) {
          await wait(RETRY_WAIT_MS, myRun);
          await pace(myRun);
          details = await getMovieDetails(entry.tmdbId, type);
          assertLive(myRun);
        }
        if (!details) { failedAdds.push(entry.title); continue; }
        // The add itself costs a details call plus one per season for a show.
        if (entry.category === 'TV Shows') nextFree.current += (1 + details.season_count) * REQUEST_GAP_MS;
        const ok = await addWatchlistItem(newItemFromDetails(details, entry.category), { quiet: true, skipRefresh: true });
        assertLive(myRun);
        if (ok) added += 1; else failedAdds.push(entry.title);
      }

      step = 'Reading the updated library';
      setProgress({ label: 'Reading your library', done: 0, total: 1 });
      // fetchData swallows its own errors; a failed re-read must stop the import.
      const fresh = (await queryClient.fetchQuery({ ...watchlistLibraryQuery, staleTime: 0 })).watchlist;
      assertLive(myRun);

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
        assertLive(myRun);
        const counts = (data ?? {}) as Record<string, unknown>;
        marked = {
          episodes_marked: marked.episodes_marked + asCount(counts.episodes_marked),
          movies_marked: marked.movies_marked + asCount(counts.movies_marked),
          movies_dated: marked.movies_dated + asCount(counts.movies_dated),
          episodes_dated: marked.episodes_dated + asCount(counts.episodes_dated),
          ratings_set: marked.ratings_set + asCount(counts.ratings_set),
        };
      }

      step = 'Refreshing the page';
      await fetchData();
      await invalidateWatchDerived(queryClient);
      await queryClient.invalidateQueries({ queryKey: watchlistRatingsQuery.queryKey }, { throwOnError: false });
      assertLive(myRun);
      setOutcome({ added, failedAdds, marked, notFound: payload.notFound });
      setProgress(null);
      setStage('done');
    } catch (error) {
      if (error instanceof RunCancelled) return;
      // Refresh before handing back to review, so a second Import sees the
      // titles already added and cannot add them again.
      await fetchData();
      await invalidateWatchDerived(queryClient);
      await queryClient.invalidateQueries({ queryKey: watchlistRatingsQuery.queryKey }, { throwOnError: false });
      if (runId.current !== myRun) return;
      setProgress(null);
      setFailure({ step, message: error instanceof Error ? error.message : 'Something went wrong.', saved: savedText() });
      setStage('review');
    }
  };

  return {
    stage, parsed, parseError, plan, setPlan, progress, outcome, failure,
    parseFiles, startMatching, cancelMatching, apply, reset,
  };
}
