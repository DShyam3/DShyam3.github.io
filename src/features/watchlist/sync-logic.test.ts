import { describe, it, expect } from 'vitest';
import { buildDisplaySyncLog, getPlatform } from './sync-logic';

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
});

