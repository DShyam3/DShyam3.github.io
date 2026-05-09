import { useState, useCallback, useMemo, useEffect } from 'react';
import { Inspiration, InspirationCategory } from '@/types/inspirations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInspirations() {
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [activeCategory, setActiveCategory] = useState<InspirationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInspirations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inspirations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInspirations(
        data?.map((i) => ({
          ...i,
          created_at: new Date(i.created_at),
        })) || []
      );
    } catch (error) {
      console.error('Error fetching inspirations:', error);
      toast({ title: 'Error fetching inspirations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInspirations();
  }, [fetchInspirations]);

  const addInspiration = useCallback(async (inspiration: Omit<Inspiration, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('inspirations')
        .insert({
          name: inspiration.name,
          image_url: inspiration.image_url,
          link: inspiration.link,
          description: inspiration.description,
          category: inspiration.category,
          why_i_like: inspiration.why_i_like,
        })
        .select()
        .single();

      if (error) throw error;

      setInspirations((prev) => [{
        ...data,
        created_at: new Date(data.created_at),
      }, ...prev]);
      
      toast({ title: 'Inspiration added!' });
    } catch (error) {
      console.error('Error adding inspiration:', error);
      toast({ title: 'Error adding inspiration', variant: 'destructive' });
    }
  }, [toast]);

  const removeInspiration = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('inspirations').delete().eq('id', id);
      if (error) throw error;
      setInspirations((prev) => prev.filter((inspiration) => inspiration.id !== id));
      toast({ title: 'Inspiration removed' });
    } catch (error) {
      console.error('Error removing inspiration:', error);
      toast({ title: 'Error removing inspiration', variant: 'destructive' });
    }
  }, [toast]);

  const updateInspiration = useCallback(async (id: string, updates: Partial<Omit<Inspiration, 'id' | 'created_at'>>) => {
    try {
      const { error } = await supabase
        .from('inspirations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setInspirations((prev) =>
        prev.map((inspiration) => (inspiration.id === id ? { ...inspiration, ...updates } : inspiration))
      );
      toast({ title: 'Inspiration updated!' });
    } catch (error) {
      console.error('Error updating inspiration:', error);
      toast({ title: 'Error updating inspiration', variant: 'destructive' });
    }
  }, [toast]);

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
    removeInspiration,
    updateInspiration,
    categories,
    getCategoryCount,
    loading,
  };
}