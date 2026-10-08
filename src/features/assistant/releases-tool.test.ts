import { describe, expect, it } from 'vitest';
import { getReleases, MAX_RELEASES, parseReleaseArgs, readsEpisodes, readsMovies, type ReleaseArgs, type ReleaseReadRow } from './releases-tool';

const today = new Date(2026, 9, 8, 15, 30); // 8 Oct 2026, mid-afternoon local

const release = (overrides: Partial<ReleaseReadRow>): ReleaseReadRow => ({
  kind: 'movie',
  title: 'Film',
  date: '2026-10-08',
  platform: null,
  season: null,
  episode: null,
  episodeTitle: null,
  ...overrides,
});

const ROWS: ReleaseReadRow[] = [
  release({ title: 'Yesterday', date: '2026-10-07' }),
  release({ title: 'Today', date: '2026-10-08' }),
  // Episode 1 of a real season is the premiere: counted as the season, once.
  release({ kind: 'episode', title: 'Show', season: 3, episode: 1, episodeTitle: 'One', date: '2026-11-01', platform: 'Netflix' }),
  release({ kind: 'episode', title: 'Show', season: 3, episode: 2, episodeTitle: 'Two', date: '2026-11-08' }),
  // A special's first episode is not a premiere.
  release({ kind: 'episode', title: 'Show', season: 0, episode: 1, episodeTitle: 'Special', date: '2026-12-01' }),
  release({ title: 'New Year', date: '2026-12-31' }),
  release({ title: 'Next year', date: '2027-01-01' }),
  release({ title: 'Undated', date: null }),
];

const args = (input: Record<string, unknown>): ReleaseArgs => {
  const parsed = parseReleaseArgs(input, today);
  if ('error' in parsed) throw new Error(parsed.error);
  return parsed;
};

const data = (result: ReturnType<typeof getReleases>) => {
  if (!('data' in result)) throw new Error(result.error);
  return result.data;
};

describe('parseReleaseArgs', () => {
  it('defaults from to today and kind to all', () => {
    expect(args({ to: '2026-12-31' })).toEqual({ from: '2026-10-08', to: '2026-12-31', kind: 'all', title: null });
  });

  it('rejects a date that is not on the calendar', () => {
    expect(parseReleaseArgs({ to: '2026-02-30' }, today)).toHaveProperty('error');
    expect(parseReleaseArgs({ to: 'next week' }, today)).toHaveProperty('error');
  });

  it('rejects a backwards range, an oversized one, and an unknown kind', () => {
    expect(parseReleaseArgs({ from: '2026-12-01', to: '2026-11-01' }, today)).toHaveProperty('error');
    expect(parseReleaseArgs({ to: '2028-01-01' }, today)).toHaveProperty('error');
    expect(parseReleaseArgs({ to: '2026-12-31', kind: 'book' }, today)).toHaveProperty('error');
  });
});

describe('getReleases', () => {
  it('answers "what comes out this year" with today included and both ends counted', () => {
    const result = data(getReleases(args({ to: '2026-12-31' }), ROWS, today));
    expect(result.releases.map(r => `${r.kind}:${r.title}`)).toEqual([
      'movie:Today', 'season:Show', 'episode:Show', 'episode:Show', 'movie:New Year',
    ]);
    // The premiere counts as the season and not again as an episode.
    expect(result.counts).toEqual({ movie: 2, season: 1, episode: 2 });
    expect(result.total).toBe(5);
  });

  it('reaches into the past when asked', () => {
    const result = data(getReleases(args({ from: '2026-10-07', to: '2026-10-07' }), ROWS, today));
    expect(result.releases.map(r => r.title)).toEqual(['Yesterday']);
  });

  it('filters by kind', () => {
    const result = data(getReleases(args({ to: '2026-12-31', kind: 'season' }), ROWS, today));
    expect(result.releases).toEqual([
      { kind: 'season', title: 'Show', date: '2026-11-01', platform: 'Netflix', season: 3, episode: 1, episodeTitle: 'One' },
    ]);
  });

  it('finds one title before the cap, so a busy range cannot hide it', () => {
    const busy = [
      ...Array.from({ length: MAX_RELEASES + 5 }, (_, i) => release({ title: `Film ${i}`, date: '2026-10-10' })),
      release({ kind: 'episode', title: 'Severance', season: 3, episode: 1, date: '2026-12-20' }),
    ];
    const result = data(getReleases(args({ to: '2026-12-31', title: 'severance' }), busy, today));
    expect(result.releases.map(r => r.title)).toEqual(['Severance']);
    expect(result.total).toBe(1);
  });

  it('reads only the tables a kind needs', () => {
    expect([readsMovies(args({ to: '2026-12-31', kind: 'season' })), readsEpisodes(args({ to: '2026-12-31', kind: 'season' }))]).toEqual([false, true]);
    expect([readsMovies(args({ to: '2026-12-31', kind: 'movie' })), readsEpisodes(args({ to: '2026-12-31', kind: 'movie' }))]).toEqual([true, false]);
  });

  it('caps the list but counts the whole range', () => {
    const many = Array.from({ length: MAX_RELEASES + 10 }, (_, i) => release({ kind: 'episode', title: `Ep ${i}`, date: '2026-10-20' }));
    const result = data(getReleases(args({ to: '2026-10-31' }), many, today));
    expect(result.releases).toHaveLength(MAX_RELEASES);
    expect(result.total).toBe(MAX_RELEASES + 10);
    expect(result.counts.episode).toBe(MAX_RELEASES + 10);
  });
});
