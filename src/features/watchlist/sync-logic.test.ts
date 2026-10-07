import { describe, it, expect } from 'vitest';
import { buildDisplaySyncLog, formatSyncPart, getPlatform } from './sync-logic';

describe('getPlatform', () => {
  it('falls back to Online when the region has no providers', () => {
    expect(getPlatform(undefined)).toBe('Online');
    expect(getPlatform({})).toBe('Online');
  });

  it('reads flatrate, free and ads alike', () => {
    expect(getPlatform({ flatrate: [{ provider_name: 'Netflix' }] })).toBe('Netflix');
    expect(getPlatform({ free: [{ provider_name: 'BBC iPlayer' }] })).toBe('BBC iPlayer');
    expect(getPlatform({ ads: [{ provider_name: 'ITVX' }] })).toBe('ITVX');
  });

  // TMDB spells the same service several ways; the allowlist maps them all to
  // one display name.
  it('normalises the alternate names TMDB uses', () => {
    expect(getPlatform({ flatrate: [{ provider_name: 'Disney Plus' }] })).toBe('Disney+');
    expect(getPlatform({ flatrate: [{ provider_name: 'Apple TV Plus' }] })).toBe('Apple TV+');
    expect(getPlatform({ flatrate: [{ provider_name: 'Amazon Prime Video' }] })).toBe(
      'Prime Video',
    );
  });

  it('matches case-insensitively', () => {
    expect(getPlatform({ flatrate: [{ provider_name: 'netflix' }] })).toBe('Netflix');
  });

  it('ignores services that are not on the allowlist', () => {
    expect(getPlatform({ flatrate: [{ provider_name: 'MUBI' }] })).toBe('Online');
  });

  // Allowlist order decides ties, so a title on two services always resolves
  // to the same platform rather than to whichever TMDB happened to list first.
  it('resolves a title on two services by allowlist order', () => {
    const providers = {
      flatrate: [{ provider_name: 'ITVX' }, { provider_name: 'Netflix' }],
    };
    expect(getPlatform(providers)).toBe('Netflix');
  });
});

describe('buildDisplaySyncLog', () => {
  it('returns empty array when given no entries', () => {
    expect(buildDisplaySyncLog([])).toEqual([]);
  });

  it('detects missing scheduled days between runs', () => {
    const entries = [
      {
        id: 2,
        synced_at: '2026-09-08T06:00:49.000Z',
        sync_type: 'auto' as const,
        status: 'success' as const,
        items_synced: 1134,
        duration_ms: 49800,
        error_message: null,
      },
      {
        id: 1,
        synced_at: '2026-09-06T06:00:52.000Z',
        sync_type: 'auto' as const,
        status: 'success' as const,
        items_synced: 1134,
        duration_ms: 45200,
        error_message: null,
      },
    ];

    const now = new Date('2026-09-08T12:00:00.000Z');
    const result = buildDisplaySyncLog(entries, now, 6);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(2);
    expect(result[0].is_missed).toBe(false);

    // September 7 is detected as missed
    expect(result[1].id).toBe('missed-2026-09-07');
    expect(result[1].is_missed).toBe(true);
    expect(result[1].status).toBe('error');
    expect(result[1].error_message).toContain('Missed scheduled run');

    expect(result[2].id).toBe(1);
    expect(result[2].is_missed).toBe(false);
  });

  it('surfaces error status when an entry has failed items even if stored status was success', () => {
    const entries = [
      {
        id: 186,
        synced_at: '2026-07-29T07:00:22.000Z',
        sync_type: 'daily' as const,
        status: 'success' as const,
        items_synced: 1018,
        duration_ms: 1556487,
        error_message: '44 item(s) failed: The Fresh Prince of Bel-Air, ...',
      },
    ];

    const now = new Date('2026-07-29T08:00:00.000Z');
    const result = buildDisplaySyncLog(entries, now, 6);

    expect(result[0].status).toBe('error');
    expect(result[0].error_message).toContain('44 item(s) failed');
  });

  it('flags today as missed only if scheduled hour has already passed', () => {
    const entries = [
      {
        id: 1,
        synced_at: '2026-09-07T06:00:00.000Z',
        sync_type: 'auto' as const,
        status: 'success' as const,
        items_synced: 1000,
        duration_ms: 30000,
        error_message: null,
      },
    ];

    // At 05:00 UTC, today's 06:00 UTC sync has not happened yet -> not missed
    const beforeRun = new Date('2026-09-08T05:00:00.000Z');
    const resultBefore = buildDisplaySyncLog(entries, beforeRun, 6);
    expect(resultBefore.some((e) => e.id === 'missed-2026-09-08')).toBe(false);

    // At 07:00 UTC, today's 06:00 UTC sync was supposed to run -> flagged as missed
    const afterRun = new Date('2026-09-08T07:00:00.000Z');
    const resultAfter = buildDisplaySyncLog(entries, afterRun, 6);
    expect(resultAfter.some((e) => e.id === 'missed-2026-09-08')).toBe(true);
  });

  it('waits for the next slot before flagging today', () => {
    const entries = [
      {
        id: 1,
        synced_at: '2026-09-07T06:00:40.000Z',
        sync_type: 'auto' as const,
        status: 'success' as const,
        items_synced: 1000,
        duration_ms: 40000,
        error_message: null,
      },
    ];
    // The run is still going at 06:00:20; it is not late until 06:10.
    const during = buildDisplaySyncLog(entries, new Date('2026-09-08T06:00:20.000Z'), 6);
    expect(during.some((e) => e.id === 'missed-2026-09-08')).toBe(false);
  });

  describe('a run split into parts', () => {
    const part = (id: number, synced_at: string, shard: number, shard_count = 3) => ({
      id,
      synced_at,
      sync_type: 'auto' as const,
      status: 'success' as const,
      items_synced: 395,
      duration_ms: 18000,
      error_message: null,
      shard,
      shard_count,
    });
    // A complete day before the one under test, so that day is not the
    // oldest in the window (whose early parts may be cut off by the fetch).
    const dayBefore = [
      part(-3, '2026-10-06T06:20:19.000Z', 2),
      part(-2, '2026-10-06T06:10:18.000Z', 1),
      part(-1, '2026-10-06T06:00:20.000Z', 0),
    ];
    const noon = new Date('2026-10-07T12:00:00.000Z');

    it('counts a day with every part logged as run', () => {
      const entries = [
        part(3, '2026-10-07T06:20:19.000Z', 2),
        part(2, '2026-10-07T06:10:18.000Z', 1),
        part(1, '2026-10-07T06:00:20.000Z', 0),
        ...dayBefore,
      ];
      expect(buildDisplaySyncLog(entries, noon, 6).some((e) => e.is_missed)).toBe(false);
    });

    // The failure this guards: a part killed for CPU writes no row, and the
    // other two parts' rows must not make the day look complete.
    it('flags the one part that logged nothing, at its slot', () => {
      const entries = [
        part(3, '2026-10-07T06:20:19.000Z', 2),
        part(1, '2026-10-07T06:00:20.000Z', 0),
        ...dayBefore,
      ];
      const missed = buildDisplaySyncLog(entries, noon, 6).filter((e) => e.is_missed);
      expect(missed).toHaveLength(1);
      expect(missed[0].id).toBe('missed-2026-10-07-1');
      expect(missed[0].synced_at).toBe('2026-10-07T06:10:00.000Z');
      expect(missed[0].shard).toBe(1);
      expect(missed[0].shard_count).toBe(3);
      expect(missed[0].error_message).toContain('part 2 of 3');
    });

    it('does not flag a part today before its slot has passed', () => {
      const entries = [part(1, '2026-10-07T06:00:20.000Z', 0), ...dayBefore];
      const early = buildDisplaySyncLog(entries, new Date('2026-10-07T06:05:00.000Z'), 6);
      expect(early.some((e) => e.is_missed)).toBe(false);

      const late = buildDisplaySyncLog(entries, new Date('2026-10-07T06:25:00.000Z'), 6);
      expect(late.filter((e) => e.is_missed).map((e) => e.id)).toEqual(['missed-2026-10-07-1']);
    });

    // The page reads the newest 20 rows. At three a day that cut lands
    // inside the oldest day shown, and its older parts are simply not loaded.
    it('does not flag parts cut off the oldest day by the fetch limit', () => {
      const all = [];
      for (let d = 10; d >= 1; d--) {
        for (let p = 2; p >= 0; p--) {
          const day = String(d).padStart(2, '0');
          all.push(part(d * 10 + p, `2026-10-${day}T06:${p}0:20.000Z`, p));
        }
      }
      const newest20 = all.slice(0, 20);
      const result = buildDisplaySyncLog(newest20, new Date('2026-10-10T12:00:00.000Z'), 6);
      expect(result.some((e) => e.is_missed)).toBe(false);
    });

    it('does not let parts of one split stand in for another', () => {
      const entries = [
        part(3, '2026-10-07T06:20:19.000Z', 2, 3),
        part(2, '2026-10-07T06:10:18.000Z', 1, 3),
        part(1, '2026-10-07T06:00:20.000Z', 0, 2),
        ...dayBefore,
      ];
      // Indices 0, 1 and 2 are all present, but 0 is a part of 2: neither
      // split is complete. The latest row's split, 3, is the one reported.
      const missed = buildDisplaySyncLog(entries, noon, 6).filter((e) => e.is_missed);
      expect(missed.map((e) => e.id)).toEqual(['missed-2026-10-07-0']);
    });

    it('still treats a whole-library row as a complete day', () => {
      const entries = [
        {
          id: 1,
          synced_at: '2026-10-07T06:00:56.000Z',
          sync_type: 'auto' as const,
          status: 'success' as const,
          items_synced: 1183,
          duration_ms: 55149,
          error_message: null,
          shard: null,
          shard_count: null,
        },
        ...dayBefore,
      ];
      expect(buildDisplaySyncLog(entries, noon, 6).some((e) => e.is_missed)).toBe(false);
    });
  });
});

describe('formatSyncPart', () => {
  it('labels a part one-based, and a whole-library run not at all', () => {
    expect(formatSyncPart({ shard: 0, shard_count: 3 })).toBe('part 1/3');
    expect(formatSyncPart({ shard: null, shard_count: null })).toBeNull();
    expect(formatSyncPart({})).toBeNull();
  });
});

