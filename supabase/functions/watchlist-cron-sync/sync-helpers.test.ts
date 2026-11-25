import { assertEquals, assertJsonEquals } from '../_shared/test-assert.ts'
import {
  getPlatform,
  hasAirDate,
  isImdbId,
  isMissingRpcError,
  omdbDecimal,
  omdbImdbRating,
  omdbPercent,
  omdbRatingValue,
  omdbText,
  omdbVotes,
  parseItemTarget,
  parseOmdbResponse,
  parseOmdbSeasonResponse,
  parseShard,
  pickCollection,
  pickCreators,
  pickDirectors,
  pickTmdbEpisodeScores,
  pickTopCast,
  pickTrailerKey,
  uniqueNames,
} from './sync-helpers.ts'

Deno.test('parseItemTarget accepts empty bodies, valid targets, and rejects malformed ones', () => {
  assertEquals(parseItemTarget(null), null)
  assertEquals(parseItemTarget(undefined), null)
  assertEquals(parseItemTarget('nope'), null)
  assertEquals(parseItemTarget({}), null)

  assertJsonEquals(parseItemTarget({ category: 'Movies', id: 42 }), { category: 'Movies', id: 42 })
  assertJsonEquals(parseItemTarget({ category: 'TV Shows', id: '99' }), { category: 'TV Shows', id: 99 })

  assertEquals(parseItemTarget({ category: 'Anime', id: 1 }), 'invalid')
  assertEquals(parseItemTarget({ category: 'Movies' }), 'invalid')
  assertEquals(parseItemTarget({ id: 1 }), 'invalid')
  assertEquals(parseItemTarget({ category: 'Movies', id: 1.5 }), 'invalid')
  assertEquals(parseItemTarget({ category: 'Movies', id: 'abc' }), 'invalid')
  assertEquals(parseItemTarget({ category: 'Movies', id: Number.MAX_SAFE_INTEGER + 1 }), 'invalid')
})

Deno.test('parseShard accepts empty bodies, valid shard ranges, and rejects invalid shards', () => {
  assertEquals(parseShard(null), null)
  assertEquals(parseShard(undefined), null)
  assertEquals(parseShard({}), null)

  assertJsonEquals(parseShard({ shard: 0, shards: 1 }), { index: 0, count: 1 })
  assertJsonEquals(parseShard({ shard: 2, shards: 3 }), { index: 2, count: 3 })
  assertJsonEquals(parseShard({ shard: 9, shards: 10 }), { index: 9, count: 10 })

  assertEquals(parseShard({ shard: -1, shards: 3 }), 'invalid')
  assertEquals(parseShard({ shard: 3, shards: 3 }), 'invalid')
  assertEquals(parseShard({ shard: 0, shards: 0 }), 'invalid')
  assertEquals(parseShard({ shard: 0, shards: 11 }), 'invalid')
  assertEquals(parseShard({ shard: 0 }), 'invalid')
  assertEquals(parseShard({ shards: 3 }), 'invalid')
  assertEquals(parseShard({ shard: '0', shards: 3 }), 'invalid')
  assertEquals(parseShard({ shard: 0.5, shards: 3 }), 'invalid')
})

Deno.test('isImdbId validates tt-prefixed 7-to-10-digit IDs', () => {
  assertEquals(isImdbId('tt0111161'), true)
  assertEquals(isImdbId('tt1234567890'), true)

  assertEquals(isImdbId('tt123456'), false)
  assertEquals(isImdbId('tt12345678901'), false)
  assertEquals(isImdbId('nm0111161'), false)
  assertEquals(isImdbId(' tt0111161 '), false)
  assertEquals(isImdbId(null), false)
  assertEquals(isImdbId(1234567), false)
})

Deno.test('hasAirDate filters episodes with a non-empty air_date', () => {
  assertEquals(hasAirDate({ episode_number: 1, air_date: '2025-01-01' }), true)
  assertEquals(hasAirDate({ episode_number: 2, air_date: '' }), false)
  assertEquals(hasAirDate({ episode_number: 3, air_date: null }), false)
  assertEquals(hasAirDate({ episode_number: 4 }), false)
})

Deno.test('getPlatform resolves priority order, aliases, case-insensitivity, and fallback', () => {
  assertEquals(getPlatform(undefined), 'Online')
  assertEquals(getPlatform({}), 'Online')
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'Unknown Streamer' }] }), 'Online')

  // Netflix outranks Disney+ and Prime Video regardless of bucket or order.
  assertEquals(
    getPlatform({
      flatrate: [{ provider_name: 'Amazon Prime Video' }, { provider_name: 'Disney Plus' }],
      ads: [{ provider_name: 'netflix' }],
    }),
    'Netflix',
  )

  // Aliases and free/ads tiers.
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'disney+' }] }), 'Disney+')
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'Apple TV' }] }), 'Apple TV+')
  assertEquals(getPlatform({ free: [{ provider_name: 'BBC iPlayer' }] }), 'BBC iPlayer')
  assertEquals(getPlatform({ ads: [{ provider_name: 'ITVX' }] }), 'ITVX')
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'Sky Go' }] }), 'NOW')
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'Paramount+ Amazon Channel' }] }), 'Paramount+')
  assertEquals(getPlatform({ free: [{ provider_name: 'All 4' }] }), 'Channel 4')
  assertEquals(getPlatform({ flatrate: [{ provider_name: 'Crunchyroll Amazon Channel' }] }), 'Crunchyroll')

  // Priority between mid-tier services.
  assertEquals(
    getPlatform({
      flatrate: [{ provider_name: 'Crunchyroll' }, { provider_name: 'NOW' }],
    }),
    'NOW',
  )
})

Deno.test('pickTrailerKey filters invalid entries and ranks Trailer > Teaser > official > en > newest', () => {
  assertEquals(pickTrailerKey(undefined), null)
  assertEquals(pickTrailerKey(null), null)
  assertEquals(pickTrailerKey([]), null)

  // Rejects non-YouTube, bad keys, and non-trailer types.
  assertEquals(
    pickTrailerKey([
      { site: 'Vimeo', key: 'abcdef123', type: 'Trailer', official: true, iso_639_1: 'en' },
      { site: 'YouTube', key: 'short', type: 'Trailer', official: true, iso_639_1: 'en' },
      { site: 'YouTube', key: 'bad key!', type: 'Trailer', official: true, iso_639_1: 'en' },
      { site: 'YouTube', key: 'clip_12345', type: 'Clip', official: true, iso_639_1: 'en' },
    ]),
    null,
  )

  // Trailer beats official English Teaser.
  assertEquals(
    pickTrailerKey([
      { site: 'YouTube', key: 'teaser_key1', type: 'Teaser', official: true, iso_639_1: 'en', published_at: '2026-01-01T00:00:00Z' },
      { site: 'YouTube', key: 'trailer_k1', type: 'Trailer', official: false, iso_639_1: null, published_at: '2020-01-01T00:00:00Z' },
    ]),
    'trailer_k1',
  )

  // Official beats unofficial; English beats non-English; newer published_at breaks ties.
  assertEquals(
    pickTrailerKey([
      { site: 'YouTube', key: 'older_en_off', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '2024-01-01T00:00:00Z' },
      { site: 'YouTube', key: 'newer_fr_off', type: 'Trailer', official: true, iso_639_1: 'fr', published_at: '2026-01-01T00:00:00Z' },
      { site: 'YouTube', key: 'newer_en_off', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '2025-06-01T00:00:00Z' },
      { site: 'YouTube', key: 'bad_date_off', type: 'Trailer', official: true, iso_639_1: 'en', published_at: 'not-a-date' },
    ]),
    'newer_en_off',
  )
})

Deno.test('pickCollection distinguishes absent field, null/invalid collection, and valid collection', () => {
  assertEquals(pickCollection({}), undefined)
  assertJsonEquals(pickCollection({ belongs_to_collection: null }), { collection_id: null, collection_name: null })
  assertJsonEquals(pickCollection({ belongs_to_collection: { id: 0, name: 'Bad' } }), { collection_id: null, collection_name: null })
  assertJsonEquals(
    pickCollection({ belongs_to_collection: { id: 10, name: '  Star Wars Collection  ' } }),
    { collection_id: 10, collection_name: 'Star Wars Collection' },
  )
  assertJsonEquals(
    pickCollection({ belongs_to_collection: { id: 10, name: '   ' } }),
    { collection_id: 10, collection_name: null },
  )
})

Deno.test('OMDb primitive parsers handle valid inputs, N/A, and malformed values', () => {
  assertEquals(omdbText('  hello  '), 'hello')
  assertEquals(omdbText(123), null)

  assertEquals(omdbDecimal('8.5'), 8.5)
  assertEquals(omdbDecimal('10'), 10)
  assertEquals(omdbDecimal('N/A'), null)
  assertEquals(omdbDecimal('-1'), null)
  assertEquals(omdbDecimal(null), null)

  assertEquals(omdbPercent('94'), 94)
  assertEquals(omdbPercent('94.6'), 95)
  assertEquals(omdbPercent('101'), null)
  assertEquals(omdbPercent('N/A'), null)

  assertEquals(
    omdbRatingValue(
      [
        { Source: 'Internet Movie Database', Value: '8.7/10' },
        { Source: 'Rotten Tomatoes', Value: ' 93% ' },
      ],
      'Rotten Tomatoes',
    ),
    '93%',
  )
  assertEquals(omdbRatingValue([], 'Rotten Tomatoes'), null)
  assertEquals(omdbRatingValue('not-an-array', 'Rotten Tomatoes'), null)

  assertEquals(omdbImdbRating('8.76'), 8.8)
  assertEquals(omdbImdbRating('12.5'), 10)
  assertEquals(omdbImdbRating('N/A'), null)

  assertEquals(omdbVotes('1,234,567'), 1234567)
  assertEquals(omdbVotes('42'), 42)
  assertEquals(omdbVotes('N/A'), null)
  assertEquals(omdbVotes('12.5'), null)
  assertEquals(omdbVotes(null), null)
})

Deno.test('parseOmdbResponse parses scores, Ratings fallbacks, N/A, limits, not-found, and errors', () => {
  assertJsonEquals(parseOmdbResponse(null), { kind: 'error', message: 'OMDb returned no JSON object' })
  assertJsonEquals(parseOmdbResponse({}), { kind: 'error', message: 'OMDb response had no Response flag' })

  assertJsonEquals(parseOmdbResponse({ Response: 'False', Error: 'Request limit reached!' }), { kind: 'limit' })
  assertJsonEquals(parseOmdbResponse({ Response: 'False', Error: 'Movie not found!' }), { kind: 'not-found' })
  assertJsonEquals(parseOmdbResponse({ Response: 'False', Error: 'Incorrect IMDb ID.' }), { kind: 'not-found' })
  assertJsonEquals(
    parseOmdbResponse({ Response: 'False', Error: 'Invalid API key!' }),
    { kind: 'error', message: 'Invalid API key!' },
  )

  // Full response.
  assertJsonEquals(
    parseOmdbResponse({
      Response: 'True',
      imdbRating: '8.8',
      imdbVotes: '2,500,000',
      Metascore: '74',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.8/10' },
        { Source: 'Rotten Tomatoes', Value: '87%' },
        { Source: 'Metacritic', Value: '74/100' },
      ],
    }),
    {
      kind: 'scores',
      scores: { imdb_rating: 8.8, imdb_votes: 2500000, rt_score: 87, metascore: 74 },
    },
  )

  // Top-level N/A falls back to Ratings array.
  assertJsonEquals(
    parseOmdbResponse({
      Response: 'True',
      imdbRating: 'N/A',
      imdbVotes: 'N/A',
      Metascore: 'N/A',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '7.4/10' },
        { Source: 'Rotten Tomatoes', Value: 'N/A' },
        { Source: 'Metacritic', Value: '68/100' },
      ],
    }),
    {
      kind: 'scores',
      scores: { imdb_rating: 7.4, imdb_votes: null, rt_score: null, metascore: 68 },
    },
  )
})

Deno.test('uniqueNames, pickDirectors, pickCreators, and pickTopCast deduplicate, rank, and cap', () => {
  assertJsonEquals(uniqueNames([' Alice ', undefined, '', 'Bob', 'Alice', '  ']), ['Alice', 'Bob'])

  assertJsonEquals(
    pickDirectors([
      { name: 'Chris Nolan', job: 'Director' },
      { name: 'Hans Zimmer', job: 'Composer' },
      { name: ' Chris Nolan ', job: 'Director' },
      { name: 'Emma Thomas', job: 'Producer' },
    ]),
    ['Chris Nolan'],
  )
  assertJsonEquals(pickDirectors(null), [])

  assertJsonEquals(
    pickCreators([{ name: 'Vince Gilligan' }, { name: '  ' }, { name: 'Vince Gilligan' }, { name: 'Peter Gould' }]),
    ['Vince Gilligan', 'Peter Gould'],
  )
  assertJsonEquals(pickCreators(undefined), [])

  // Movie cast: ranked by `order`, deduplicated, capped at 3.
  assertJsonEquals(
    pickTopCast([
      { name: 'Fourth', order: 3 },
      { name: 'Second', order: 1 },
      { name: 'First', order: 0 },
      { name: 'Second', order: 2 },
      { name: '   ', order: 0 },
      { name: 'Third', order: 2 },
    ]),
    ['First', 'Second', 'Third'],
  )

  // TV aggregate_credits: `total_episode_count` outranks `order`, ties fall back to `order` then index.
  assertJsonEquals(
    pickTopCast([
      { name: 'Guest Star', order: 0, total_episode_count: 2 },
      { name: 'Lead B', order: 1, total_episode_count: 50 },
      { name: 'Lead A', order: 0, total_episode_count: 50 },
      { name: 'Regular C', order: 2, total_episode_count: 40 },
      { name: 'Regular D', order: 3, total_episode_count: 10 },
    ]),
    ['Lead A', 'Lead B', 'Regular C'],
  )
  assertJsonEquals(pickTopCast(null), [])
})

Deno.test('isMissingRpcError detects Postgres 42883 and PostgREST PGRST202 only', () => {
  assertEquals(isMissingRpcError({ code: '42883' }), true)
  assertEquals(isMissingRpcError({ code: 'PGRST202' }), true)
  assertEquals(isMissingRpcError({ code: '42501' }), false)
  assertEquals(isMissingRpcError({ code: null }), false)
  assertEquals(isMissingRpcError(null), false)
  assertEquals(isMissingRpcError(undefined), false)
})

Deno.test('pickTmdbEpisodeScores rounds and clamps finite ratings and normalizes missing/zero values', () => {
  assertJsonEquals(pickTmdbEpisodeScores({ vote_average: 8.36, vote_count: 142 }), {
    tmdb_rating: 8.4,
    tmdb_votes: 142,
  })
  assertJsonEquals(pickTmdbEpisodeScores({ vote_average: 11.4, vote_count: 12.6 }), {
    tmdb_rating: 10,
    tmdb_votes: 13,
  })
  assertJsonEquals(pickTmdbEpisodeScores({ vote_average: 0, vote_count: 0 }), {
    tmdb_rating: null,
    tmdb_votes: 0,
  })
  assertJsonEquals(pickTmdbEpisodeScores({ vote_average: -2, vote_count: -5 }), {
    tmdb_rating: null,
    tmdb_votes: 0,
  })
  assertJsonEquals(pickTmdbEpisodeScores({ vote_average: Number.NaN, vote_count: Number.POSITIVE_INFINITY }), {
    tmdb_rating: null,
    tmdb_votes: 0,
  })
  assertJsonEquals(pickTmdbEpisodeScores({}), {
    tmdb_rating: null,
    tmdb_votes: 0,
  })
})

Deno.test('parseOmdbSeasonResponse classifies errors and parses deduplicated positive-integer episodes', () => {
  assertJsonEquals(parseOmdbSeasonResponse(null), { kind: 'error', message: 'OMDb returned no JSON object' })
  assertJsonEquals(parseOmdbSeasonResponse({}), { kind: 'error', message: 'OMDb response had no Response flag' })
  assertJsonEquals(parseOmdbSeasonResponse({ Response: 'False', Error: 'Daily request limit reached!' }), { kind: 'limit' })
  assertJsonEquals(parseOmdbSeasonResponse({ Response: 'False', Error: 'Series or season not found!' }), { kind: 'not-found' })
  assertJsonEquals(parseOmdbSeasonResponse({ Response: 'False', Error: 'Incorrect IMDb ID.' }), { kind: 'not-found' })
  assertJsonEquals(
    parseOmdbSeasonResponse({ Response: 'False', Error: 'Invalid API key!' }),
    { kind: 'error', message: 'Invalid API key!' },
  )
  assertJsonEquals(parseOmdbSeasonResponse({ Response: 'True' }), { kind: 'episodes', episodes: [] })
  assertJsonEquals(parseOmdbSeasonResponse({ Response: 'True', Episodes: 'N/A' }), { kind: 'episodes', episodes: [] })

  assertJsonEquals(
    parseOmdbSeasonResponse({
      Response: 'True',
      Episodes: [
        null,
        'x',
        { Episode: '0', imdbID: 'tt0000001', imdbRating: '8.0' },
        { Episode: '-1', imdbID: 'tt0000002', imdbRating: '8.0' },
        { Episode: '1.5', imdbID: 'tt0000003', imdbRating: '8.0' },
        { Episode: 1, imdbID: 'tt0000004', imdbRating: '8.0' },
        { Episode: '99999999999999999999', imdbID: 'tt0000005', imdbRating: '8.0' },
        { Episode: ' 1 ', imdbID: 'tt0959621', imdbRating: '9.0' },
        { Episode: '01', imdbID: 'tt9999999', imdbRating: '4.0' },
        { Episode: '2', imdbID: 'tt1054724', imdbRating: '8.76' },
        { Episode: '3', imdbID: 'tt1054725', imdbRating: '0.0' },
        { Episode: '4', imdbID: 'N/A', imdbRating: 'N/A' },
        { Episode: '5', imdbID: 'bad', imdbRating: '11.5' },
      ],
    }),
    {
      kind: 'episodes',
      episodes: [
        { episode_number: 1, imdb_id: 'tt0959621', imdb_rating: 9 },
        { episode_number: 2, imdb_id: 'tt1054724', imdb_rating: 8.8 },
        { episode_number: 3, imdb_id: 'tt1054725', imdb_rating: null },
        { episode_number: 4, imdb_id: null, imdb_rating: null },
        { episode_number: 5, imdb_id: null, imdb_rating: 10 },
      ],
    },
  )
})
