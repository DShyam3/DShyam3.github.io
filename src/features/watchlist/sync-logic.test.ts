import { describe, it, expect } from 'vitest';
import {
  buildCommonUpdates,
  buildMovieUpdates,
  buildShowUpdates,
  getPlatform,
} from './sync-logic';
import type { TMDBDetails } from './tmdb-types';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/** An item with nothing filled in, so each test can say what it cares about. */
const emptyItem = {
  id: '1',
  image_url: undefined,
  description: undefined,
  genres: [] as string[],
};

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

describe('buildCommonUpdates', () => {
  it('fills in a poster only when the stored one is missing', () => {
    const data: TMDBDetails = { poster_path: '/abc.jpg' };

    expect(buildCommonUpdates(emptyItem, data, IMAGE_BASE).poster).toBe(
      `${IMAGE_BASE}/abc.jpg`,
    );
    expect(
      buildCommonUpdates(
        { ...emptyItem, image_url: 'https://example.com/hand-picked.jpg' },
        data,
        IMAGE_BASE,
      ),
    ).not.toHaveProperty('poster');
  });

  it('fills in genres only when the stored list is empty', () => {
    const data: TMDBDetails = { genres: [{ name: 'Drama' }, { name: 'Western' }] };

    expect(buildCommonUpdates(emptyItem, data, IMAGE_BASE).genre).toBe('Drama, Western');
    expect(
      buildCommonUpdates({ ...emptyItem, genres: ['Kept'] }, data, IMAGE_BASE),
    ).not.toHaveProperty('genre');
  });

  // release_date and platform legitimately change, so unlike poster/genre they
  // are refreshed on every sync.
  it('always refreshes release_date and platform', () => {
    const item = {
      ...emptyItem,
      image_url: 'kept',
      description: 'kept',
      genres: ['kept'],
    };
    const updates = buildCommonUpdates(
      item,
      {
        release_date: '2021-12-19',
        'watch/providers': { results: { GB: { flatrate: [{ provider_name: 'Netflix' }] } } },
      },
      IMAGE_BASE,
    );

    expect(updates.release_date).toBe('2021-12-19');
    expect(updates.platform).toBe('Netflix');
  });

  it('falls back to first_air_date for a show with no release_date', () => {
    const updates = buildCommonUpdates(emptyItem, { first_air_date: '2022-05-08' }, IMAGE_BASE);
    expect(updates.release_date).toBe('2022-05-08');
  });

  it('reads providers from the GB region only', () => {
    const updates = buildCommonUpdates(
      emptyItem,
      { 'watch/providers': { results: { US: { flatrate: [{ provider_name: 'Netflix' }] } } } },
      IMAGE_BASE,
    );
    expect(updates.platform).toBe('Online');
  });

  describe('the overview asymmetry', () => {
    const data: TMDBDetails = { overview: 'From TMDB' };

    // The browser's list query does not fetch `overview`, so `item.description`
    // is undefined whether or not one is stored. Without needsOverview the
    // sync would overwrite every stored summary on every run.
    it('writes the overview when the caller confirms the column is null', () => {
      const updates = buildCommonUpdates(
        emptyItem,
        data,
        IMAGE_BASE,
        new Set(['1']),
      );
      expect(updates.overview).toBe('From TMDB');
    });

    it('leaves a stored overview alone when the id is not in the set', () => {
      const updates = buildCommonUpdates(emptyItem, data, IMAGE_BASE, new Set<string>());
      expect(updates).not.toHaveProperty('overview');
    });

    // A caller that does hold the real description (the edge function selects
    // '*') passes no set and is trusted to have it.
    it('falls back to the in-memory description when no set is given', () => {
      expect(buildCommonUpdates(emptyItem, data, IMAGE_BASE).overview).toBe('From TMDB');
      expect(
        buildCommonUpdates({ ...emptyItem, description: 'stored' }, data, IMAGE_BASE),
      ).not.toHaveProperty('overview');
    });
  });
});

describe('buildMovieUpdates', () => {
  it('derives release_year from the release date when the item has none', () => {
    const updates = buildMovieUpdates(
      { ...emptyItem, year: undefined },
      { release_date: '2021-12-19' },
      IMAGE_BASE,
    );
    expect(updates.release_year).toBe(2021);
  });

  it('leaves an existing year alone', () => {
    const updates = buildMovieUpdates(
      { ...emptyItem, year: 1984 },
      { release_date: '2021-12-19' },
      IMAGE_BASE,
    );
    expect(updates).not.toHaveProperty('release_year');
  });

  it('only writes a runtime TMDB actually returned', () => {
    expect(buildMovieUpdates(emptyItem, { runtime: 155 }, IMAGE_BASE).runtime).toBe(155);
    expect(buildMovieUpdates(emptyItem, {}, IMAGE_BASE)).not.toHaveProperty('runtime');
  });
});

describe('buildShowUpdates', () => {
  it('carries the series status through on top of the common columns', () => {
    const updates = buildShowUpdates(emptyItem, { status: 'Returning Series' }, IMAGE_BASE);
    expect(updates.status).toBe('Returning Series');
    expect(updates.platform).toBe('Online');
  });

  // TMDB spells it "Canceled"; the pill has to match what is stored, so the
  // sync must not silently rewrite it.
  it('stores TMDB spelling of a cancelled show verbatim', () => {
    expect(buildShowUpdates(emptyItem, { status: 'Canceled' }, IMAGE_BASE).status).toBe(
      'Canceled',
    );
  });
});
