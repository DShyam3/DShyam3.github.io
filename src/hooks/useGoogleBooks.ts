import { useState, useCallback, useRef, useEffect } from 'react';

import { searchBookMetadata, type BookMetadataResult } from '@/lib/book-metadata';

export type GoogleBookResult = BookMetadataResult;

export function useGoogleBooks() {
  const [results, setResults] = useState<GoogleBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const revisionRef = useRef(0);

  const search = useCallback((query: string) => {
    const revision = ++revisionRef.current;
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    controllerRef.current?.abort();
    setResults([]);
    setError(null);
    const trimmed = query.trim();
    setLoading(trimmed.length >= 2);
    if (trimmed.length < 2) return;

    debounceTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        const items = await searchBookMetadata(trimmed, controller.signal);
        if (revision !== revisionRef.current) return;
        setResults(items);
      } catch {
        if (revision !== revisionRef.current || controller.signal.aborted) return;
        setError('Book catalogues are unavailable. Try again or use Manual entry.');
      } finally {
        if (revision === revisionRef.current) setLoading(false);
      }
    }, 350);
  }, []);

  useEffect(() => () => {
    ++revisionRef.current;
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    controllerRef.current?.abort();
  }, []);

  return { results, loading, error, search };
}
