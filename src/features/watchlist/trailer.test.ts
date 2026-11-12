import { describe, expect, it } from 'vitest';
import { isYouTubeKey, pickTrailerKey, trailerEmbedUrl, trailerWatchUrl } from './trailer';

const yt = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  site: 'YouTube',
  type: 'Trailer',
  official: true,
  iso_639_1: 'en',
  published_at: '2024-01-01T00:00:00.000Z',
  ...extra,
});

describe('pickTrailerKey', () => {
  it('returns null for no videos', () => {
    expect(pickTrailerKey(undefined)).toBeNull();
    expect(pickTrailerKey(null)).toBeNull();
    expect(pickTrailerKey([])).toBeNull();
  });

  it('ignores other sites, other types and malformed keys', () => {
    expect(pickTrailerKey([
      yt('aaaaaaaaaaa', { site: 'Vimeo' }),
      yt('bbbbbbbbbbb', { type: 'Featurette' }),
      yt('bad key!', {}),
      yt('ccccccccccc', { type: 'Behind the Scenes' }),
    ])).toBeNull();
  });

  it('prefers a trailer over a teaser, even an older unofficial one', () => {
    expect(pickTrailerKey([
      yt('teaser00001', { type: 'Teaser', published_at: '2025-01-01T00:00:00Z' }),
      yt('trailer0001', { official: false, iso_639_1: 'fr', published_at: '2020-01-01T00:00:00Z' }),
    ])).toBe('trailer0001');
  });

  it('falls back to a teaser when there is no trailer', () => {
    expect(pickTrailerKey([yt('teaser00001', { type: 'Teaser' })])).toBe('teaser00001');
  });

  it('prefers official, then English, then most recent', () => {
    expect(pickTrailerKey([
      yt('unofficial1', { official: false }),
      yt('official001'),
    ])).toBe('official001');
    expect(pickTrailerKey([
      yt('french00001', { iso_639_1: 'fr' }),
      yt('english0001'),
    ])).toBe('english0001');
    expect(pickTrailerKey([
      yt('older000001', { published_at: '2023-01-01T00:00:00Z' }),
      yt('newer000001', { published_at: '2024-06-01T00:00:00Z' }),
      yt('nodate00001', { published_at: undefined }),
    ])).toBe('newer000001');
  });
});

describe('trailer URLs', () => {
  it('builds the nocookie embed and the watch link for a valid key', () => {
    expect(trailerEmbedUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    );
    expect(trailerWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('refuses anything that is not a bare video id', () => {
    for (const key of ['', 'abc', 'x/../../evil', 'a"onload=1', 'https://youtu.be/x', 'a'.repeat(21)]) {
      expect(isYouTubeKey(key)).toBe(false);
      expect(trailerEmbedUrl(key)).toBeNull();
      expect(trailerWatchUrl(key)).toBeNull();
    }
  });
});
