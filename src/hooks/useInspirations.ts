import { useState, useMemo } from 'react';
import { Inspiration, InspirationCategory } from '@/types/inspirations';
import { useSupabaseTable } from './useSupabaseTable';

export function useInspirations() {
  const { data: rawInspirations, loading, addItem, removeItem, updateItem } = useSupabaseTable<any>('inspirations');
  const [activeCategory, setActiveCategory] = useState<InspirationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const inspirations = useMemo(
    () => rawInspirations.map((i) => ({ ...i, created_at: new Date(i.created_at) })) as Inspiration[],
    [rawInspirations],
  );

  const addInspiration = (inspiration: Omit<Inspiration, 'id' | 'created_at'>) =>
    addItem({
      name: inspiration.name,
      image_url: inspiration.image_url,
      link: inspiration.link,
      description: inspiration.description,
      category: inspiration.category,
      why_i_like: inspiration.why_i_like,
    });

  const updateInspiration = (id: string, updates: Partial<Omit<Inspiration, 'id' | 'created_at'>>) =>
    updateItem({ id, updates });

  const categories: { key: InspirationCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'entrepreneurs', label: 'Entrepreneurs' },
    { key: 'thinkers', label: 'Thinkers' },
    { key: 'creators', label: 'Creators' },
    { key: 'artists-painters', label: 'Artists / Painters' },
    { key: 'photographers', label: 'Photographers' },
  ];

  const getCategoryCount = (category: InspirationCategory) => {
    if (category === 'all') return inspirations.length;
    return inspirations.filter((i) => i.category === category).length;
  };

  const filteredInspirations = useMemo(() => {
    let filtered = inspirations;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((i) => i.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query)) ||
          (i.why_i_like && i.why_i_like.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [inspirations, activeCategory, searchQuery]);

  return {
    inspirations: filteredInspirations,
    allInspirations: inspirations,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addInspiration,
    removeInspiration: removeItem,
    updateInspiration,
    categories,
    getCategoryCount,
    loading,
  };
}
