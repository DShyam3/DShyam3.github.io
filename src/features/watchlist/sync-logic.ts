import type { TMDBRegionProviders } from './tmdb-types';

/**
 * Watchlist sync helpers the browser still needs, with no Supabase client, no
 * React and no network in sight.
 *
 * The sync itself runs only in supabase/functions/watchlist-cron-sync -- the
 * nightly job and the Sync buttons both call it. What stays here is the
 * platform mapping the add flow uses when it first stores a title, and the
 * sync history the page displays.
 *
 * `getPlatform` and `PLATFORM_ALLOWLIST` have a hand-maintained copy in that
 * function, since Deno cannot import from src/. Change both together.
 */

/**
 * Streaming services worth surfacing, and the various names TMDB uses for
 * each. Anything not on this list falls back to 'Online'.
 */
export const PLATFORM_ALLOWLIST: { tmdbNames: string[]; displayName: string }[] = [
  { tmdbNames: ['Netflix'], displayName: 'Netflix' },
  { tmdbNames: ['Disney Plus', 'Disney+'], displayName: 'Disney+' },
  { tmdbNames: ['Amazon Prime Video'], displayName: 'Prime Video' },
  { tmdbNames: ['Apple TV Plus', 'Apple TV+', 'Apple TV'], displayName: 'Apple TV+' },
  { tmdbNames: ['BBC iPlayer'], displayName: 'BBC iPlayer' },
  { tmdbNames: ['ITVX'], displayName: 'ITVX' },
];

/** Pick a display platform from a TMDB `watch/providers` region block. */
export function getPlatform(providers: TMDBRegionProviders | undefined): string {
  if (!providers) return 'Online';

  const available = [
    ...(providers.flatrate || []),
    ...(providers.free || []),
    ...(providers.ads || []),
  ];

  for (const entry of PLATFORM_ALLOWLIST) {
    const match = available.some((provider: { provider_name?: string }) =>
      entry.tmdbNames.some(
        (name) => provider.provider_name?.toLowerCase() === name.toLowerCase(),
      ),
    );
    if (match) return entry.displayName;
  }

  return 'Online';
}

export interface DisplaySyncLogEntry {
  id: number | string;
  synced_at: string;
  sync_type: 'auto' | 'manual' | 'daily';
  status: 'success' | 'error';
  items_synced: number;
  duration_ms: number;
  error_message?: string | null;
  is_missed?: boolean;
}

/**
 * Given the raw sync log from Supabase, detects any missing scheduled daily
 * sync runs between the oldest entry (or up to maxDaysBack) and now.
 * Also ensures all entries are sorted descending by date and surfaces partial failures.
 */
export function buildDisplaySyncLog(
  entries: {
    id: number;
    synced_at: string;
    sync_type: 'auto' | 'manual' | 'daily';
    status: 'success' | 'error';
    items_synced: number;
    duration_ms: number;
    error_message?: string | null;
  }[],
  now: Date = new Date(),
  scheduledHourUtc: number = 6,
  maxDaysBack: number = 30,
): DisplaySyncLogEntry[] {
  if (entries.length === 0) return [];

  const result: DisplaySyncLogEntry[] = entries.map((e) => ({
    ...e,
    // If the entry has an error message or failed items, treat it as an error/partial for display
    status: e.error_message || e.status === 'error' ? 'error' : 'success',
    is_missed: false,
  }));

  // Track dates (YYYY-MM-DD in UTC) that had a scheduled sync ('auto' or 'daily')
  const autoSyncDays = new Set<string>();
  entries.forEach((e) => {
    if (e.sync_type === 'auto' || e.sync_type === 'daily') {
      const d = new Date(e.synced_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      autoSyncDays.add(key);
    }
  });

  const timestamps = entries.map((e) => new Date(e.synced_at).getTime());
  const oldestTime = Math.min(...timestamps);
  const earliestAllowed = new Date(now.getTime() - maxDaysBack * 24 * 60 * 60 * 1000);

  const startCursor = new Date(Math.max(oldestTime, earliestAllowed.getTime()));
  startCursor.setUTCHours(0, 0, 0, 0);

  const todayCursor = new Date(now);
  todayCursor.setUTCHours(0, 0, 0, 0);

  const todayHourUtc = now.getUTCHours();
  const cursor = new Date(startCursor);

  while (cursor <= todayCursor) {
    const isToday = cursor.getTime() === todayCursor.getTime();
    const shouldCheck = !isToday || todayHourUtc >= scheduledHourUtc;

    if (shouldCheck) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
      if (!autoSyncDays.has(key)) {
        result.push({
          id: `missed-${key}`,
          synced_at: `${key}T${String(scheduledHourUtc).padStart(2, '0')}:00:00.000Z`,
          sync_type: 'auto',
          status: 'error',
          items_synced: 0,
          duration_ms: 0,
          error_message: 'Missed scheduled run — no execution logged',
          is_missed: true,
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result.sort(
    (a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime(),
  );
}

