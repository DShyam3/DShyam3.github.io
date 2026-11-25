import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import {
  WIKIDATA_CACHE_MAX_AGE_MS,
  filmUniverseMembersFromCacheRow,
  spinoffLinksFromCacheRow,
  spinoffSeedList,
  tvSeedIdsOf,
  type WikidataCacheRow,
} from './wikidata-cache-query';
import { visibleLibraryFor } from './library-state';
import { filmUniversesFromMembers, tvFranchisesFromLinks, type UniverseLibraryFilm } from './franchise';
import type { WatchlistItem } from './WatchlistContext';
import {
  fetchFilmUniverses,
  fetchTvSpinoffs,
  filmUniverseCacheRow,
  spinoffSeedIds,
  tvSpinoffCacheRow,
  visitorTvSeedIds,
} from '../../../supabase/functions/_shared/wikidata-lookups';

const NIGHT = '2026-11-22T06:20:00.000Z';
const NOW = Date.parse('2026-11-22T16:00:00Z');

const link = (seedTmdbId: number, relatedTmdbId: number, extra: Record<string, unknown> = {}) => ({
  seedTmdbId,
  seedTitle: `Show ${seedTmdbId}`,
  franchiseId: null,
  franchiseName: null,
  relatedMediaType: 'tv',
  relatedTmdbId,
  relatedTitle: `Show ${relatedTmdbId}`,
  releaseDate: '2020-01-01',
  posterPath: null,
  ...extra,
});

const spinoffRow = (extra: Partial<WikidataCacheRow> = {}): WikidataCacheRow => ({
  lookup: 'tv-spinoffs',
  seed_ids: [1, 2, 3],
  results: [link(1, 10), link(2, 20)],
  synced_at: NIGHT,
  ...extra,
});

const member = (tmdbId: number, extra: Record<string, unknown> = {}) => ({
  universeId: 'Q642878',
  universeName: 'Marvel Cinematic Universe',
  tmdbId,
  title: `Film ${tmdbId}`,
  releaseDate: '2008-05-02',
  posterPath: `/p${tmdbId}.jpg`,
  ...extra,
});

describe('spinoffLinksFromCacheRow', () => {
  it('answers the seed list the row was built for', () => {
    expect(spinoffLinksFromCacheRow(spinoffRow(), [1, 2, 3], NOW)).toEqual([link(1, 10), link(2, 20)]);
  });

  it('keeps an empty answer, which means no spin-offs', () => {
    expect(spinoffLinksFromCacheRow(spinoffRow({ results: [] }), [1, 2, 3], NOW)).toEqual([]);
  });

  it('leaves any other seed list to the proxy', () => {
    expect(spinoffLinksFromCacheRow(spinoffRow(), [1, 2], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(spinoffRow(), [1, 2, 3, 4], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(spinoffRow(), [1, 2, 4], NOW)).toBeNull();
  });

  it('leaves a stale, missing or unreadable row to the proxy', () => {
    const tooOld = new Date(NOW - WIKIDATA_CACHE_MAX_AGE_MS - 1).toISOString();
    expect(spinoffLinksFromCacheRow(spinoffRow({ synced_at: tooOld }), [1, 2, 3], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(spinoffRow({ synced_at: 'never' }), [1, 2, 3], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(null, [1, 2, 3], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(spinoffRow({ lookup: 'film-universes' }), [1, 2, 3], NOW)).toBeNull();
    expect(spinoffLinksFromCacheRow(spinoffRow({ results: {} }), [1, 2, 3], NOW)).toBeNull();
  });

  it('leaves a row with any link not in the proxy shape to the proxy', () => {
    for (const bad of [
      link(0, 10),
      link(1, 10, { relatedMediaType: 'person' }),
      link(1, 10, { seedTitle: null }),
      link(1, 10, { releaseDate: 2020 }),
      link(1, 10, { posterPath: 5 }),
      null,
    ]) {
      expect(spinoffLinksFromCacheRow(spinoffRow({ results: [link(1, 10), bad] }), [1, 2, 3], NOW)).toBeNull();
    }
  });
});

describe('filmUniverseMembersFromCacheRow', () => {
  const universeRow = (extra: Partial<WikidataCacheRow> = {}): WikidataCacheRow => ({
    lookup: 'film-universes',
    seed_ids: [],
    results: [member(1726), member(1724, { title: null, posterPath: null })],
    synced_at: NIGHT,
    ...extra,
  });

  it('answers with the stored films', () => {
    expect(filmUniverseMembersFromCacheRow(universeRow(), NOW)).toEqual([member(1726), member(1724, { title: null, posterPath: null })]);
  });

  it('leaves a stale, empty or malformed row to the proxy', () => {
    const tooOld = new Date(NOW - WIKIDATA_CACHE_MAX_AGE_MS - 1).toISOString();
    expect(filmUniverseMembersFromCacheRow(universeRow({ synced_at: tooOld }), NOW)).toBeNull();
    expect(filmUniverseMembersFromCacheRow(universeRow({ results: [] }), NOW)).toBeNull();
    expect(filmUniverseMembersFromCacheRow(universeRow({ results: [member(0)] }), NOW)).toBeNull();
    expect(filmUniverseMembersFromCacheRow(universeRow({ lookup: 'tv-spinoffs' }), NOW)).toBeNull();
    expect(filmUniverseMembersFromCacheRow(null, NOW)).toBeNull();
  });
});

describe('the visitor seed list', () => {
  it('is the list a signed-out browser sends', () => {
    const library = [
      { category: 'TV Shows', tmdb_id: 30, library_state: null },
      { category: 'TV Shows', tmdb_id: 10, library_state: 'active' },
      { category: 'TV Shows', tmdb_id: 20, library_state: 'hidden' },
      { category: 'TV Shows', tmdb_id: 40, library_state: 'stopped' },
      { category: 'TV Shows', tmdb_id: 10, library_state: null },
      { category: 'TV Shows', tmdb_id: null, library_state: null },
      { category: 'TV Shows', tmdb_id: 5, library_state: 'paused' },
      { category: 'Movies', tmdb_id: 7, library_state: null },
    ] as unknown as WatchlistItem[];
    // As useDiscovery and WatchlistFranchises build `tvSeedIds` for a
    // visitor, then getTvSpinoffs cleans them. The cron reads tv_shows only.
    const browser = spinoffSeedList(tvSeedIdsOf(visibleLibraryFor(library, false)));
    expect(browser).toEqual([5, 10, 30]);
    expect(visitorTvSeedIds(library.filter((item) => item.category === 'TV Shows'))).toEqual(browser);
    // The owner sends hidden and stopped shows too, so never matches the row.
    expect(spinoffSeedList(tvSeedIdsOf(visibleLibraryFor(library, true)))).toEqual([5, 10, 20, 30, 40]);
  });

  it('reads a 434-show library whole, newest shows included', () => {
    const seeds = Array.from({ length: 434 }, (_, index) => index + 1);
    expect(spinoffSeedIds(seeds)).toEqual(seeds);
  });

  it('is stored whole, though the lookup reads only the first 1,000', () => {
    const seeds = Array.from({ length: 1050 }, (_, index) => index + 1);
    expect(spinoffSeedIds(seeds)).toHaveLength(1000);
    expect(tvSpinoffCacheRow(seeds, [], NIGHT).seed_ids).toEqual(seeds);
  });
});

// --- End to end: the cron's lookup and row through the browser's reader ---

const sparqlRows = (rows: Record<string, string>[]) => ({
  results: { bindings: rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, { value }]))) },
});

/** The SPARQL a lookup sent, from its URL (GET) or its form body (POST). */
const sparqlOf = (input: string | URL, init?: RequestInit): string =>
  new URL(String(input)).searchParams.get('query') ?? new URLSearchParams(String(init?.body ?? '')).get('query') ?? '';

/** Wikidata and TMDB as the lookups ask them, from fixtures. */
function stubUpstreams(
  tmdb: Record<string, { status: number; body?: unknown }>,
  seedFranchises: Record<string, string>[] = [],
) {
  const fetchStub = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'query.wikidata.org') {
      const query = sparqlOf(input, init);
      if (query.includes('VALUES ?seedShowTmdb')) {
        return Response.json(sparqlRows(seedFranchises));
      }
      if (query.includes('VALUES ?seedTmdb')) {
        return Response.json(sparqlRows([
          { seedTmdb: '1418', seedLabel: 'The Big Bang Theory', franchiseId: 'Q100', franchiseLabel: 'Big Bang Theory franchise', relatedLabel: 'Young Sheldon', relatedTvTmdb: '71728', relDate: '2017-09-25T00:00:00Z' },
          { seedTmdb: '71728', seedLabel: 'Young Sheldon', franchiseId: 'Q100', franchiseLabel: 'Big Bang Theory franchise', relatedLabel: 'The Big Bang Theory', relatedTvTmdb: '1418', relDate: '2007-09-24T00:00:00Z' },
          { seedTmdb: '1418', seedLabel: 'The Big Bang Theory', franchiseId: 'Q100', franchiseLabel: 'Big Bang Theory franchise', relatedLabel: 'Young Sheldon', relatedTvTmdb: '71728', relDate: '2017-09-25T00:00:00Z' },
          { seedTmdb: '1399', seedLabel: 'Game of Thrones', relatedLabel: 'House of the Dragon', relatedTvTmdb: '94997' },
          { seedTmdb: '1399', seedLabel: 'Game of Thrones', relatedLabel: 'A Knight of the Seven Kingdoms', relatedTvTmdb: '224372' },
          { seedTmdb: '60059', seedLabel: 'Better Call Saul', relatedLabel: 'El Camino', relatedMovieTmdb: '559969', relDate: '2019-10-11T00:00:00Z' },
        ]));
      }
      if (query.includes('VALUES ?franchise')) {
        return Response.json(sparqlRows([
          { franchise: 'http://www.wikidata.org/entity/Q100', relatedLabel: "Georgie & Mandy's First Marriage", relatedTvTmdb: '248888', relDate: '2024-10-17T00:00:00Z' },
          { franchise: 'http://www.wikidata.org/entity/Q100', relatedLabel: 'The Big Bang Theory', relatedTvTmdb: '1418' },
        ]));
      }
      if (query.includes('VALUES ?universe')) {
        return Response.json(sparqlRows([
          { universe: 'http://www.wikidata.org/entity/Q642878', tmdb: '1726', label: 'Iron Man', date: '2008-04-14T00:00:00Z' },
          { universe: 'http://www.wikidata.org/entity/Q642878', tmdb: '1726', label: 'Iron Man', date: '2008-05-02T00:00:00Z' },
          { universe: 'http://www.wikidata.org/entity/Q642878', tmdb: '1724', date: '2008-06-13T00:00:00Z' },
          { universe: 'http://www.wikidata.org/entity/Q642878', tmdb: '24428', label: 'The Avengers', date: '2012-04-11T00:00:00Z' },
        ]));
      }
      return new Response('unknown query', { status: 500 });
    }
    const key = url.pathname.replace(/^\/3\//, '');
    const answer = tmdb[key] ?? { status: 404 };
    return answer.body === undefined
      ? new Response('{}', { status: answer.status })
      : Response.json(answer.body, { status: answer.status });
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

const TMDB_DETAILS = {
  'tv/71728': { status: 200, body: { poster_path: '/young.jpg', first_air_date: '2017-09-25' } },
  'tv/1418': { status: 200, body: { poster_path: '/tbbt.jpg', first_air_date: '2007-09-24' } },
  'tv/94997': { status: 200, body: { poster_path: '/hotd.jpg', first_air_date: '2022-08-21' } },
  'tv/224372': { status: 200, body: { poster_path: '/knight.jpg', first_air_date: '' } },
  'movie/559969': { status: 200, body: { poster_path: '/elcamino.jpg', release_date: '2019-10-11' } },
  'tv/248888': { status: 200, body: { poster_path: '/georgie.jpg', first_air_date: '2024-10-17' } },
  'movie/1726': { status: 200, body: { title: 'Iron Man', poster_path: '/ironman.jpg', release_date: '2008-04-30' } },
  'movie/1724': { status: 200, body: { title: 'The Incredible Hulk', poster_path: '/hulk.jpg', release_date: '2008-06-12' } },
  'movie/24428': { status: 200, body: { title: 'The Avengers', poster_path: '/avengers.jpg', release_date: '2012-04-25' } },
};

/** jsonb keeps values, not key order: read the row back with its keys reordered. */
const throughJsonb = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).reverse())
      : inner,
  ));

const library = [
  { id: 's1', category: 'TV Shows', tmdb_id: 1418, title: 'The Big Bang Theory (2007)', release_date: '2007-09-24', image_url: 'lib-tbbt.jpg', library_state: null },
  { id: 's2', category: 'TV Shows', tmdb_id: 1399, title: 'Game of Thrones', release_date: '2011-04-17', image_url: null, library_state: 'finished' },
  { id: 's3', category: 'TV Shows', tmdb_id: 60059, title: 'Better Call Saul', release_date: '2015-02-08', image_url: null, library_state: null },
  { id: 's4', category: 'TV Shows', tmdb_id: 71728, title: 'Young Sheldon', release_date: '2017-09-25', image_url: null, library_state: 'hidden' },
] as unknown as WatchlistItem[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the cache answers as the proxy does', () => {
  it('makes the same TV groups from the stored row as from the proxy response', async () => {
    stubUpstreams(TMDB_DETAILS);
    const seeds = visitorTvSeedIds(library);
    const lookup = await fetchTvSpinoffs(spinoffSeedIds(seeds), { tmdbApiKey: 'test-key' });
    expect(lookup.complete).toBe(true);
    expect(lookup.siblings).toBe('answered');

    const fromProxy = (JSON.parse(JSON.stringify({ results: lookup.links })) as { results: unknown[] }).results;
    const row = throughJsonb(tvSpinoffCacheRow(seeds, lookup.links, NIGHT));
    const visible = visibleLibraryFor(library, false);
    const browserSeeds = spinoffSeedList(tvSeedIdsOf(visible));
    const fromCache = spinoffLinksFromCacheRow(row, browserSeeds, NOW);

    expect(fromCache).toEqual(fromProxy);
    const groups = tvFranchisesFromLinks(fromCache!, visible, 'https://img');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups).toEqual(tvFranchisesFromLinks(fromProxy as never, visible, 'https://img'));
  });

  it('marks an answer missing a poster or date lookup incomplete', async () => {
    stubUpstreams({ ...TMDB_DETAILS, 'tv/94997': { status: 429 } });
    const lookup = await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key' });
    expect(lookup.complete).toBe(false);
    expect(lookup.links.length).toBeGreaterThan(0);
  });

  it('counts a 404 from TMDB as an answer', async () => {
    const { 'tv/224372': _knight, ...rest } = TMDB_DETAILS;
    stubUpstreams(rest);
    expect((await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key' })).complete).toBe(true);
  });

  it('keeps an answer whose sibling franchise query failed complete, as the proxy sends it', async () => {
    const fetchStub = stubUpstreams(TMDB_DETAILS);
    const answer = fetchStub.getMockImplementation()!;
    fetchStub.mockImplementation(async (input: string | URL, init?: RequestInit) =>
      sparqlOf(input, init).includes('VALUES ?franchise')
        ? new Response('busy', { status: 503 })
        : answer(input, init),
    );
    const lookup = await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key' });
    expect(lookup.siblings).toBe('failed');
    expect(lookup.complete).toBe(true);
    expect(lookup.links.some((link) => link.relatedTmdbId === 248888)).toBe(false);
  });

  it("lists a franchise's series through the seeds' own franchise when no spin-off link names it", async () => {
    // Wikidata records no P2512 link between any two Star Wars series: the
    // franchise is found only from the seeds' media franchise (P8345).
    const fetchStub = stubUpstreams(
      {
        ...TMDB_DETAILS,
        'tv/60554': { status: 200, body: { poster_path: '/rebels.jpg', first_air_date: '2014-10-03' } },
        'tv/82856': { status: 200, body: { poster_path: '/mando.jpg', first_air_date: '2019-11-12' } },
      },
      [
        { seedShowTmdb: '82856', seedLabel: 'The Mandalorian', franchise: 'http://www.wikidata.org/entity/Q462', franchiseLabel: 'Star Wars' },
        { seedShowTmdb: '4194', seedLabel: 'Star Wars: The Clone Wars', franchise: 'http://www.wikidata.org/entity/Q462', franchiseLabel: 'Star Wars' },
      ],
    );
    const answer = fetchStub.getMockImplementation()!;
    fetchStub.mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const query = sparqlOf(input, init);
      if (query.includes('VALUES ?seedTmdb')) return Response.json(sparqlRows([]));
      if (query.includes('VALUES ?franchise')) {
        expect(query).toContain('wd:Q462');
        return Response.json(sparqlRows([
          { franchise: 'http://www.wikidata.org/entity/Q462', relatedLabel: 'Star Wars: The Clone Wars', relatedTvTmdb: '4194', relDate: '2008-10-03T00:00:00Z' },
          { franchise: 'http://www.wikidata.org/entity/Q462', relatedLabel: 'Star Wars Rebels', relatedTvTmdb: '60554', relDate: '2014-10-03T00:00:00Z' },
          { franchise: 'http://www.wikidata.org/entity/Q462', relatedLabel: 'The Mandalorian', relatedTvTmdb: '82856', relDate: '2019-11-12T00:00:00Z' },
        ]));
      }
      return answer(input, init);
    });

    const lookup = await fetchTvSpinoffs([4194, 82856], { tmdbApiKey: 'test-key' });
    expect(lookup.siblings).toBe('answered');
    expect(lookup.complete).toBe(true);
    // Anchored on the smallest seed id, whatever order Wikidata answers in.
    expect(lookup.links.map((l) => [l.seedTmdbId, l.relatedTmdbId, l.franchiseName])).toEqual([
      [4194, 60554, 'Star Wars'],
      [4194, 82856, 'Star Wars'],
    ]);

    const starWars = [
      { id: 'sw1', category: 'TV Shows', tmdb_id: 4194, title: 'Star Wars: The Clone Wars', release_date: '2008-10-03', image_url: null, library_state: null },
      { id: 'sw2', category: 'TV Shows', tmdb_id: 82856, title: 'The Mandalorian (2019)', release_date: '2019-11-12', image_url: null, library_state: null },
    ] as unknown as WatchlistItem[];
    const groups = tvFranchisesFromLinks(lookup.links, starWars, 'https://img');
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Star Wars Universe');
    expect(groups[0].entries.map((entry) => entry.title)).toEqual([
      'Star Wars: The Clone Wars',
      'Star Wars Rebels',
      'The Mandalorian',
    ]);
  });

  it('retries a TMDB 429 once and records each details call', async () => {
    const fetchStub = stubUpstreams(TMDB_DETAILS);
    const answer = fetchStub.getMockImplementation()!;
    let limited = 0;
    fetchStub.mockImplementation(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/tv/94997') && limited === 0) {
        limited++;
        return new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
      }
      return answer(input, init);
    });
    const events: { endpoint: string; statusCode?: number | null }[] = [];
    const lookup = await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key', usage: { record: (event) => events.push(event) } });
    expect(limited).toBe(1);
    expect(lookup.complete).toBe(true);
    expect(lookup.links.find((link) => link.relatedTmdbId === 94997)?.posterPath).toBe('/hotd.jpg');
    expect(events.filter((event) => event.endpoint === 'tv/:id' && event.statusCode === 429)).toHaveLength(1);
  });

  it('looks up no poster for a series the seeds already hold', async () => {
    const fetchStub = stubUpstreams(TMDB_DETAILS);
    await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key' });
    const asked = fetchStub.mock.calls.map(([input]) => String(input));
    expect(asked.some((url) => url.includes('/tv/1418?'))).toBe(false);
    expect(asked.some((url) => url.includes('/tv/71728?'))).toBe(true);
  });

  it('keeps the spin-off links when the seed franchise query fails', async () => {
    const fetchStub = stubUpstreams(TMDB_DETAILS);
    const answer = fetchStub.getMockImplementation()!;
    fetchStub.mockImplementation(async (input: string | URL, init?: RequestInit) =>
      sparqlOf(input, init).includes('VALUES ?seedShowTmdb')
        ? new Response('busy', { status: 503 })
        : answer(input, init),
    );
    const lookup = await fetchTvSpinoffs([1399, 1418, 60059], { tmdbApiKey: 'test-key' });
    expect(lookup.siblings).toBe('failed');
    expect(lookup.complete).toBe(true);
    expect(lookup.links.some((link) => link.relatedTmdbId === 71728)).toBe(true);
    // The franchise a spin-off link named is still asked about.
    expect(lookup.links.some((link) => link.relatedTmdbId === 248888)).toBe(true);
  });

  it('marks an answer with no TMDB key incomplete', async () => {
    stubUpstreams(TMDB_DETAILS);
    expect((await fetchTvSpinoffs([1399, 1418, 60059])).complete).toBe(false);
  });

  it('makes the same film universes from the stored row as from the proxy response', async () => {
    stubUpstreams(TMDB_DETAILS);
    const members = await fetchFilmUniverses({ record: () => {} }, { tmdbApiKey: 'test-key' });
    const fromProxy = (JSON.parse(JSON.stringify({ results: members })) as { results: unknown[] }).results;
    const fromCache = filmUniverseMembersFromCacheRow(throughJsonb(filmUniverseCacheRow(members, NIGHT)), NOW);
    expect(fromCache).toEqual(fromProxy);

    const films = new Map<number, UniverseLibraryFilm>([
      [1726, { id: 'm1', title: 'Iron Man', releaseDate: '2008-04-30', poster: null }],
    ]);
    const universes = filmUniversesFromMembers(fromCache!, films, 'https://img');
    expect(universes).toHaveLength(1);
    expect(universes).toEqual(filmUniversesFromMembers(fromProxy as never, films, 'https://img'));
  });
});
