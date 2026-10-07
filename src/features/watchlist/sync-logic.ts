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
  /** Which part of the library a scheduled run covered; null for all of it. */
  shard?: number | null;
  shard_count?: number | null;
  is_missed?: boolean;
}

/** "part 2/3" for a run that covered one part of the library, else null. */
export function formatSyncPart(entry: {
  shard?: number | null;
  shard_count?: number | null;
}): string | null {
  return entry.shard != null && entry.shard_count != null
    ? `part ${entry.shard + 1}/${entry.shard_count}`
    : null;
}

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * When the nightly sync runs: part 0 at this hour, each later part this many
 * minutes after the one before. The cron jobs that actually fire are in
 * supabase/migrations/20261006090000_watchlist_sync_shards.sql -- change both
 * together.
 */
export const NIGHTLY_SYNC_HOUR_UTC = 6;
export const NIGHTLY_SYNC_PART_SPACING_MINUTES = 10;

/**
 * Given the raw sync log from Supabase, detects any missing scheduled daily
 * sync runs between the oldest entry (or up to maxDaysBack) and now.
 * Also ensures all entries are sorted descending by date and surfaces partial failures.
 *
 * The nightly run is split into parts. A part the edge runtime kills for CPU
 * writes no row, so a day counts as run only when every part of its split
 * logged -- one row per day would hide a lost part behind the others. Rows
 * without a part are whole-library runs, and complete their day alone.
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
    shard?: number | null;
    shard_count?: number | null;
  }[],
  now: Date = new Date(),
  scheduledHourUtc: number = NIGHTLY_SYNC_HOUR_UTC,
  maxDaysBack: number = 30,
  partSpacingMinutes: number = NIGHTLY_SYNC_PART_SPACING_MINUTES,
): DisplaySyncLogEntry[] {
  if (entries.length === 0) return [];

  const result: DisplaySyncLogEntry[] = entries.map((e) => ({
    ...e,
    // If the entry has an error message or failed items, treat it as an error/partial for display
    status: e.error_message || e.status === 'error' ? 'error' : 'success',
    is_missed: false,
  }));

  // Per UTC day, what the scheduled ('auto' or 'daily') rows cover: the whole
  // library, or which parts of each split. Splits are kept apart so that, on
  // a day the part count changes, parts of 2 cannot pass for parts of 3.
  type Split = { parts: Set<number>; latest: number };
  const scheduledDays = new Map<string, { whole: boolean; splits: Map<number, Split> }>();
  entries.forEach((e) => {
    if (e.sync_type !== 'auto' && e.sync_type !== 'daily') return;
    const at = new Date(e.synced_at).getTime();
    const key = utcDayKey(new Date(at));
    const day = scheduledDays.get(key) ?? { whole: false, splits: new Map<number, Split>() };
    if (e.shard == null || e.shard_count == null) {
      day.whole = true;
    } else {
      const split = day.splits.get(e.shard_count) ?? { parts: new Set<number>(), latest: 0 };
      split.parts.add(e.shard);
      split.latest = Math.max(split.latest, at);
      day.splits.set(e.shard_count, split);
    }
    scheduledDays.set(key, day);
  });

  const timestamps = entries.map((e) => new Date(e.synced_at).getTime());
  const oldestTime = Math.min(...timestamps);
  // The log arrives as the newest N rows, so the cut can fall between the
  // parts of the oldest day shown. Parts missing there may just be older
  // than the window.
  const oldestKey = utcDayKey(new Date(oldestTime));
  const earliestAllowed = new Date(now.getTime() - maxDaysBack * 24 * 60 * 60 * 1000);

  const startCursor = new Date(Math.max(oldestTime, earliestAllowed.getTime()));
  startCursor.setUTCHours(0, 0, 0, 0);

  const todayCursor = new Date(now);
  todayCursor.setUTCHours(0, 0, 0, 0);

  const spacingMs = partSpacingMinutes * 60 * 1000;
  const cursor = new Date(startCursor);

  while (cursor <= todayCursor) {
    const key = utcDayKey(cursor);
    const day = scheduledDays.get(key);
    const scheduledAt = new Date(cursor);
    scheduledAt.setUTCHours(scheduledHourUtc, 0, 0, 0);
    // A run is late once the next slot would have started. Only today can
    // fall short of that.
    const isDue = (slot: number) => now.getTime() >= slot + spacingMs;

    if (!day) {
      if (isDue(scheduledAt.getTime())) {
        result.push({
          id: `missed-${key}`,
          synced_at: scheduledAt.toISOString(),
          sync_type: 'auto',
          status: 'error',
          items_synced: 0,
          duration_ms: 0,
          error_message: 'Missed scheduled run — no execution logged',
          is_missed: true,
        });
      }
    } else if (!day.whole && key !== oldestKey) {
      const splits = [...day.splits.entries()];
      const complete = splits.some(([count, split]) => split.parts.size >= count);
      if (!complete) {
        // The split the day's latest part belongs to is the one in force.
        const [partCount, split] = splits.reduce((a, b) => (b[1].latest > a[1].latest ? b : a));
        for (let part = 0; part < partCount; part++) {
          if (split.parts.has(part)) continue;
          const partAt = scheduledAt.getTime() + part * spacingMs;
          if (!isDue(partAt)) continue;
          result.push({
            id: `missed-${key}-${part}`,
            synced_at: new Date(partAt).toISOString(),
            sync_type: 'auto',
            status: 'error',
            items_synced: 0,
            duration_ms: 0,
            error_message: `Missed scheduled run — part ${part + 1} of ${partCount} logged nothing`,
            shard: part,
            shard_count: partCount,
            is_missed: true,
          });
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result.sort(
    (a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime(),
  );
}
