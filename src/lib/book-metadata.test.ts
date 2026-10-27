import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookshopLinks, completeBookMetadata, isConfidentBookMatch, searchBookMetadata, type BookMetadataResult } from './book-metadata';

const book = (title: string, author: string): BookMetadataResult => ({ id: 'example', volumeInfo: { title, authors: [author] } });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('safe automatic book matching', () => {
  it('accepts punctuation, accents and subtitles but rejects a different title or author', () => {
    expect(isConfidentBookMatch('The Prince', 'Niccolò Machiavelli', book('Prince: A new translation', 'Niccolo Machiavelli'))).toBe(true);
    expect(isConfidentBookMatch('The Prince', 'Niccolò Machiavelli', book('The Little Prince', 'Antoine de Saint-Exupéry'))).toBe(false);
    expect(isConfidentBookMatch('The Prince', 'Niccolò Machiavelli', book('The Prince', 'Someone Else'))).toBe(false);
  });
  it('does not choose a catalogue edition for unspecified authors', () => {
    expect(isConfidentBookMatch('Akbar and Birbal', 'Various', book('Akbar and Birbal', 'Various'))).toBe(false);
  });
  it('rejects a companion even when its title starts with the requested book', () => {
    expect(isConfidentBookMatch('Good to Great', 'Jim Collins', book('Good to Great: The Social Sectors', 'Jim Collins'))).toBe(false);
  });
  it('encodes user text in shop search links', () => {
    const links = bookshopLinks('Books & More?', 'A/B');
    expect(new URL(links.amazon).searchParams.get('k')).toBe('Books & More? A/B');
    expect(links.waterstones).toContain('Books%20%26%20More%3F%20A%2FB');
  });
});

describe('catalogue fallback', () => {
  it('uses Open Library after Google rate limiting and uses only reported cover IDs', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(Response.json({ docs: [{ key: '/works/OL123W', title: 'The Prince', author_name: ['Machiavelli'], cover_i: 123 }] }));
    vi.stubGlobal('fetch', fetcher);
    const [result] = await searchBookMetadata('The Prince');
    expect(result.source).toBe('openlibrary');
    expect(result.volumeInfo.imageLinks?.thumbnail).toBe('https://covers.openlibrary.org/b/id/123-L.jpg?default=false');
    expect(fetcher.mock.calls[1][0]).toMatch(/^https:\/\/openlibrary.org\/search.json\?/);
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('printType')).toBe('all');
  });
  it('times out a stalled interactive search and falls back without cancelling the caller', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds);
      return controller.signal;
    });
    const controller = new AbortController();
    const fetcher = vi.fn()
      .mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
      }))
      .mockResolvedValueOnce(Response.json({ docs: [{ key: '/works/OL123W', title: 'The Prince' }] }));
    vi.stubGlobal('fetch', fetcher);
    const search = searchBookMetadata('The Prince', controller.signal);
    await vi.advanceTimersByTimeAsync(14999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await search)[0].source).toBe('openlibrary');
    expect(controller.signal.aborted).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not start a fallback for an aborted search', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetcher);
    await expect(searchBookMetadata('The Prince', controller.signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fetches work descriptions only from a validated Open Library work ID', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ description: { value: 'A work description.' } }));
    vi.stubGlobal('fetch', fetcher);
    const result = { ...book('Title', 'Author'), source: 'openlibrary' as const, workKey: '/works/OL123W' };
    expect((await completeBookMetadata(result)).volumeInfo.description).toBe('A work description.');
    await completeBookMetadata({ ...result, workKey: '//evil.example/work' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
