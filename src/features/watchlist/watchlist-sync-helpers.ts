import { useCallback, useRef } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { TMDBEpisode } from './tmdb-types';
import { NIGHTLY_SYNC_HOUR_UTC } from './sync-logic';

/** A TMDB episode that survived the "has an air date" filter. */
export type AiredEpisode = TMDBEpisode & { air_date: string };

export const hasAirDate = (v: TMDBEpisode): v is AiredEpisode => Boolean(v.air_date);

// Returns a referentially-stable function that always calls the latest
// version of `fn`. Used so the context value below doesn't hand out a new
// function reference on every render (which defeats React.memo on
// downstream components like WatchlistCard) without having to hand-audit
// dependency arrays for every handler in this file.
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

// Routes TMDB requests through the tmdb-proxy edge function so the TMDB API
// key never has to live in (or be inlined into) the client bundle.
export async function fetchTMDBProxy<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  // The installed @supabase/supabase-js version has no `queryParams` option
  // on invoke() -- it's silently dropped, not an error, so this failed
  // with no indication why. invoke() just concatenates its first argument
  // onto the function URL and parses the result as a URL, so building the
  // query string in ourselves works correctly.
  const query = new URLSearchParams({ endpoint, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(
    `tmdb-proxy?${query}`,
    {
      method: 'GET',
    },
  );
  if (error) throw error;
  return data as T;
}

/** What watchlist-cron-sync answers a finished run with. */
export interface ServerSyncResult {
  itemsSynced: number;
  itemsTotal: number;
  failedTitles: string[];
  changes: string[];
  durationMs: number;
  /** Stopped at the time ceiling; the titles after that point were not reached. */
  truncated: boolean;
  /** Seconds left on the full-sync cooldown; only a manual full sync sets it. */
  retry_after?: number;
}

/**
 * The status and JSON body of a non-2xx edge function response. invoke()
 * reports one as a FunctionsHttpError whose `context` is the raw Response,
 * so the server's own message has to be read out of it.
 */
export async function readFunctionError(
  error: unknown,
): Promise<{ status?: number; error?: string; retry_after?: number }> {
  if (!(error instanceof FunctionsHttpError)) return {};
  const response = error.context as Response;
  try {
    const body = (await response.json()) as { error?: string; retry_after?: number };
    return { status: response.status, ...body };
  } catch {
    return { status: response.status };
  }
}

// 'auto'   = the pg_cron edge function fired on schedule, no browser involved
//             (watchlist-cron-sync/index.ts). This is the only scheduled path.
// 'manual' = an admin clicked "Sync Updates".
// 'daily'  = historic only. A client-side fallback used to sync whenever an
//             admin opened the page and the local 6 AM window looked unmet;
//             it was removed because it duplicated the cron at arbitrary
//             times. Kept in the union so existing log rows still parse.
export interface SyncLogEntry {
  id: number;
  synced_at: string;
  sync_type: 'auto' | 'manual' | 'daily';
  status: 'success' | 'error';
  items_synced: number;
  error_message?: string;
  duration_ms: number;
  /** The part of the library a nightly run covered; null for all of it. */
  shard?: number | null;
  shard_count?: number | null;
}

/**
 * How many favourites one facts sync will fetch. tmdb-proxy allows 60
 * requests a minute; a loop with no cap would trip that and start failing
 * mid-run, so the run stops short and asks to be run again.
 */
export const FAVOURITE_FACTS_BATCH = 50;

/**
 * The local copy of the stamp a database trigger puts on `last_activity_at`
 * after an add, a watch or a re-file, so Discover reorders before the next
 * library read rather than after it.
 */
export const touchedNow = () => ({ last_activity_at: new Date().toISOString() });

/**
 * The next time the server-side cron will start, as a Date. pg_cron reads
 * its schedule in UTC, so this does too -- computed as local time it would
 * promise 06:00 through British Summer Time while the sync landed at 07:00.
 */
export const getNextAutoSync = () => {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(NIGHTLY_SYNC_HOUR_UTC, 0, 0, 0);
  if (now >= target) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
};
