/** Public catalogue metadata, shared by interactive lookup and the backfill. */
export interface BookMetadataResult {
  id: string;
  source?: 'google' | 'openlibrary';
  workKey?: string;
  saleInfo?: { buyLink?: string };
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    imageLinks?: { smallThumbnail: string; thumbnail: string };
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
}

export function bookshopLinks(title: string, author: string) {
  const query = encodeURIComponent(`${title.trim()} ${author.trim()}`.trim());
  return {
    amazon: `https://www.amazon.co.uk/s?k=${query}&i=stripbooks`,
    waterstones: `https://www.waterstones.com/books/search/term/${query}`,
  };
}

async function catalogueJson(url: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
  return response.json();
}

export async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<BookMetadataResult[]> {
  const params = new URLSearchParams({ q: query, limit: '10', lang: 'en', fields: 'key,title,author_name,cover_i,first_publish_year' });
  const data = await catalogueJson(`https://openlibrary.org/search.json?${params}`, signal);
  if (!Array.isArray(data.docs)) return [];
  return data.docs.flatMap((doc: { key?: string; title?: string; author_name?: string[]; cover_i?: number; first_publish_year?: number }) => {
    if (!doc.title || !doc.key || !/^\/works\/OL\d+W$/.test(doc.key)) return [];
    const cover = Number.isSafeInteger(doc.cover_i) && doc.cover_i! > 0
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false` : undefined;
    return [{
      id: doc.key, source: 'openlibrary' as const, workKey: doc.key,
      volumeInfo: {
        title: doc.title,
        authors: Array.isArray(doc.author_name) ? doc.author_name : [],
        publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
        infoLink: `https://openlibrary.org${doc.key}`,
        imageLinks: cover ? { thumbnail: cover, smallThumbnail: cover } : undefined,
      },
    }];
  });
}

export async function searchBookMetadata(query: string, signal?: AbortSignal): Promise<BookMetadataResult[]> {
  try {
    const params = new URLSearchParams({ q: query, maxResults: '10', printType: 'all' });
    const data = await catalogueJson(`https://www.googleapis.com/books/v1/volumes?${params}`, signal);
    const items = Array.isArray(data.items) ? data.items.filter((item: BookMetadataResult) => item.id && item.volumeInfo?.title) : [];
    if (items.length) return items.map((item: BookMetadataResult) => ({ ...item, source: 'google' as const }));
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return searchOpenLibrary(query, signal);
}

export async function completeBookMetadata(result: BookMetadataResult, signal?: AbortSignal): Promise<BookMetadataResult> {
  if (result.source !== 'openlibrary' || !result.workKey || !/^\/works\/OL\d+W$/.test(result.workKey)) return result;
  const work = await catalogueJson(`https://openlibrary.org${result.workKey}.json`, signal);
  const description = typeof work.description === 'string' ? work.description : work.description?.value;
  return { ...result, volumeInfo: { ...result.volumeInfo, description: typeof description === 'string' ? description : undefined } };
}

const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Conservative automatic matching; edition choice remains available in the editor. */
export function isConfidentBookMatch(title: string, author: string, result: BookMetadataResult): boolean {
  const requested = normalized(title);
  const candidateTitle = normalized(result.volumeInfo.title);
  for (const qualifier of ['workbook', 'study guide', 'summary', 'companion', 'social sectors']) {
    if (candidateTitle.includes(qualifier) && !requested.includes(qualifier)) return false;
  }
  const baseTitle = (value: string) => normalized(value.split(':')[0].replace(/\([^)]*\)/g, '')).replace(/^the /, '');
  if (baseTitle(title) !== baseTitle(result.volumeInfo.title)) return false;
  const authorWords = normalized(author).split(' ').filter((word) => word.length > 1);
  if (!authorWords.length || ['various', 'unknown', 'ad'].includes(normalized(author))) return false;
  return (result.volumeInfo.authors ?? []).some((candidate) => {
    const words = normalized(candidate).split(' ');
    return authorWords.every((word) => words.includes(word));
  });
}
