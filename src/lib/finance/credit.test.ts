import { describe, expect, it } from 'vitest';
import { BUREAU_BANDS, getBandForScore, getUniversalStanding } from './credit';

describe('BUREAU_BANDS', () => {
  it('covers each bureau’s range without gaps', () => {
    for (const bands of Object.values(BUREAU_BANDS)) {
      bands.forEach((band, i) => {
        if (i > 0) expect(band.min).toBe(bands[i - 1].max + 1);
      });
    }
  });

  it('rises monotonically through the tiers', () => {
    for (const bands of Object.values(BUREAU_BANDS)) {
      bands.forEach((band, i) => {
        if (i > 0) expect(band.tier).toBeGreaterThan(bands[i - 1].tier);
      });
    }
  });

  it('lets TransUnion skip a tier, since it has four bands not five', () => {
    expect(BUREAU_BANDS.transunion).toHaveLength(4);
    expect(BUREAU_BANDS.transunion.map(b => b.tier)).toEqual([1, 2, 4, 5]);
  });
});

describe('getBandForScore', () => {
  it('finds the band a score sits in', () => {
    expect(getBandForScore('experian', 900)?.name).toBe('Good');
    expect(getBandForScore('transunion', 610)?.name).toBe('Good');
    expect(getBandForScore('equifax', 800)?.name).toBe('Soaring High');
  });

  it('includes both boundaries', () => {
    expect(getBandForScore('experian', 861)?.name).toBe('Good');
    expect(getBandForScore('experian', 1000)?.name).toBe('Good');
  });

  it('returns null outside every band', () => {
    expect(getBandForScore('experian', 2000)).toBeNull();
  });
});

describe('getUniversalStanding', () => {
  it('is null when no bureau has a score', () => {
    expect(getUniversalStanding({})).toBeNull();
    expect(getUniversalStanding({ experian: [], transunion: [], equifax: [] })).toBeNull();
  });

  it('reads the newest score, not the first', () => {
    const standing = getUniversalStanding({ experian: [{ score: 400 }, { score: 1200 }] });
    expect(standing?.label).toBe('Excellent');
    expect(standing?.tier).toBe(5);
  });

  it('averages across the bureaus that have scores', () => {
    // 5, 3.8 and 4.2 average to 4.33 -- Very Good.
    const standing = getUniversalStanding({
      experian: [{ score: 1150 }],
      transunion: [{ score: 610 }],
      equifax: [{ score: 700 }],
    });
    expect(standing?.rating).toBeCloseTo(4.333, 3);
    expect(standing?.label).toBe('Very Good');
    expect(standing?.tier).toBe(4);
  });

  it('ignores a bureau with no entries rather than scoring it zero', () => {
    const alone = getUniversalStanding({ experian: [{ score: 1150 }] });
    const withEmpty = getUniversalStanding({ experian: [{ score: 1150 }], equifax: [] });
    expect(withEmpty).toEqual(alone);
  });

  it('falls to the lowest standing for a poor score', () => {
    const standing = getUniversalStanding({ experian: [{ score: 300 }] });
    expect(standing?.label).toBe('Needs Work');
    expect(standing?.tier).toBe(1);
  });
});
