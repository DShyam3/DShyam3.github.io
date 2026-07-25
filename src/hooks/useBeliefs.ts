import { useState, useMemo } from 'react';
import { Belief } from '@/types/beliefs';
import { useSupabaseTable } from './useSupabaseTable';

export function useBeliefs() {
  const { data: rawBeliefs, loading, addItem, removeItem, updateItem } = useSupabaseTable<any>('beliefs');
  const [searchQuery, setSearchQuery] = useState('');

  const beliefs = useMemo(
    () => rawBeliefs.map((b) => ({ ...b, created_at: new Date(b.created_at) })) as Belief[],
    [rawBeliefs],
  );

  const filteredBeliefs = useMemo(() => {
    if (!searchQuery) return beliefs;

    const query = searchQuery.toLowerCase();
    return beliefs.filter(
      (belief) =>
        belief.quote.toLowerCase().includes(query) ||
        (belief.author && belief.author.toLowerCase().includes(query))
    );
  }, [beliefs, searchQuery]);

  const addBelief = (belief: Omit<Belief, 'id' | 'created_at'>) =>
    addItem({ quote: belief.quote, author: belief.author });

  const updateBelief = (id: string, updates: Partial<Omit<Belief, 'id' | 'created_at'>>) =>
    updateItem({ id, updates });

  return {
    beliefs: filteredBeliefs,
    allBeliefs: beliefs,
    searchQuery,
    setSearchQuery,
    addBelief,
    removeBelief: removeItem,
    updateBelief,
    loading,
  };
}
