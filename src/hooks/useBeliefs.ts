import { useState, useCallback, useMemo, useEffect } from 'react';
import { Belief } from '@/types/beliefs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useBeliefs() {
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBeliefs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('beliefs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBeliefs(
        data?.map((b) => ({
          ...b,
          created_at: new Date(b.created_at),
        })) || []
      );
    } catch (error) {
      console.error('Error fetching beliefs:', error);
      toast({ title: 'Error fetching beliefs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBeliefs();
  }, [fetchBeliefs]);

  const addBelief = useCallback(async (belief: Omit<Belief, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('beliefs')
        .insert({
          quote: belief.quote,
          author: belief.author,
        })
        .select()
        .single();

      if (error) throw error;

      setBeliefs((prev) => [{
        ...data,
        created_at: new Date(data.created_at),
      }, ...prev]);
      
      toast({ title: 'Belief added!' });
    } catch (error) {
      console.error('Error adding belief:', error);
      toast({ title: 'Error adding belief', variant: 'destructive' });
    }
  }, [toast]);

  const removeBelief = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('beliefs').delete().eq('id', id);
      if (error) throw error;
      setBeliefs((prev) => prev.filter((belief) => belief.id !== id));
      toast({ title: 'Belief removed' });
    } catch (error) {
      console.error('Error removing belief:', error);
      toast({ title: 'Error removing belief', variant: 'destructive' });
    }
  }, [toast]);

  const updateBelief = useCallback(async (id: string, updates: Partial<Omit<Belief, 'id' | 'created_at'>>) => {
    try {
      const { error } = await supabase
        .from('beliefs')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setBeliefs((prev) =>
        prev.map((belief) => (belief.id === id ? { ...belief, ...updates } : belief))
      );
      toast({ title: 'Belief updated!' });
    } catch (error) {
      console.error('Error updating belief:', error);
      toast({ title: 'Error updating belief', variant: 'destructive' });
    }
  }, [toast]);

  const filteredBeliefs = useMemo(() => {
    if (!searchQuery) return beliefs;

    const query = searchQuery.toLowerCase();
    return beliefs.filter(
      (belief) =>
        belief.quote.toLowerCase().includes(query) ||
        (belief.author && belief.author.toLowerCase().includes(query))
    );
  }, [beliefs, searchQuery]);

  return {
    beliefs: filteredBeliefs,
    allBeliefs: beliefs,
    searchQuery,
    setSearchQuery,
    addBelief,
    removeBelief,
    updateBelief,
    loading,
  };
}