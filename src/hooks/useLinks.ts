import { useState, useMemo } from 'react';
import { LinkItem, LinkCategory } from '@/types/links';
import { useSupabaseTable } from './useSupabaseTable';

export function useLinks() {
  const { data: links, loading, addItem, removeItem, updateItem } = useSupabaseTable<LinkItem>('links');
  const [activeCategory, setActiveCategory] = useState<LinkCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLinks = useMemo(() => {
    let filtered = links;
    if (activeCategory !== 'all') {
      filtered = filtered.filter((l) => l.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [links, activeCategory, searchQuery]);

  const categories: { key: LinkCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'websites', label: 'Websites' },
    { key: 'iphone-apps', label: 'iPhone Apps' },
    { key: 'ipad-apps', label: 'iPad Apps' },
    { key: 'mac-apps', label: 'Mac Apps' },
    { key: 'dev-setup', label: 'Dev Setup' },
  ];

  const getCategoryCount = (category: LinkCategory) =>
    category === 'all'
      ? links.length
      : links.filter((l) => l.category === category).length;

  return {
    links: filteredLinks,
    allLinks: links,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addLink: addItem,
    removeLink: removeItem,
    updateLink: (id: string, updates: Partial<LinkItem>) => updateItem({ id, updates }),
    categories,
    getCategoryCount,
    loading,
  };
}
