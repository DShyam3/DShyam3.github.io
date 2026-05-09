import { useState, useCallback, useRef } from 'react';

export interface GoogleBookResult {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    imageLinks?: {
      smallThumbnail: string;
      thumbnail: string;
    };
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
}

export function useGoogleBooks() {
  const [results, setResults] = useState<GoogleBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const performSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Using printType=all to ensure magazines like POPEYE can be found
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(trimmedQuery)}&maxResults=10&printType=all`,
      );
      const data = await response.json();

      const filteredResults = (data.items || []).filter(
        (item: any) => item.volumeInfo,
      );
      setResults(filteredResults);
    } catch (error) {
      console.error('Google Books Search Error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(
    (query: string) => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      debounceTimerRef.current = window.setTimeout(() => {
        performSearch(trimmed);
      }, 350);
    },
    [performSearch],
  );

  const getBookDetails = useCallback(async (volumeId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${volumeId}`,
      );
      const data = await response.json();

      const info = data.volumeInfo;
      return {
        title: info.title,
        author: info.authors?.join(', ') || 'Unknown Author',
        description: info.description || '',
        cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:'),
        link: info.infoLink || info.previewLink,
        pages: info.pageCount,
        publishedDate: info.publishedDate,
        categories: info.categories || [],
      };
    } catch (error) {
      console.error('Google Books Detail Error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    search,
    getBookDetails,
  };
}
