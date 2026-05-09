import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSupabaseTable<T extends Record<string, any>>(
  tableName: string, 
  options?: { 
    filter?: { column: string; value: any };
    orderBy?: { column: string; ascending?: boolean };
    primaryKey?: string;
  }
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pk = options?.primaryKey || 'id';

  const query = useQuery({
    queryKey: [tableName, options?.filter],
    queryFn: async () => {
      let q = supabase.from(tableName as any).select('*');
      
      if (options?.filter) {
        q = q.eq(options.filter.column, options.filter.value);
      }
      
      if (options?.orderBy) {
        q = q.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
      } else {
        // Safe default: try updated_at first as it's more common in this project's newer tables
        q = q.order('updated_at' as any, { ascending: false });
      }

      const { data, error } = await q;

      if (error) {
        // If sorting failed (42703 is column not found, some environments return 400 for bad sort)
        if ((error.code === '42703' || error.message?.includes('column')) && !options?.orderBy) {
           // Try again without sorting at all to be safe
           const { data: dataFallback, error: errorFallback } = await supabase.from(tableName as any).select('*');
           if (errorFallback) throw errorFallback;
           return dataFallback as T[];
        }
        throw error;
      }
      return data as T[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (newItem: any) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;
      return data as T;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast({ title: `${tableName} updated!` });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: 'Error adding item', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: any; updates: Partial<T> }) => {
      const { error } = await supabase
        .from(tableName as any)
        .update(updates as any)
        .eq(pk, id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast({ title: 'Item updated!' });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: 'Error updating item', variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: any) => {
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq(pk, id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast({ title: 'Item removed' });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: 'Error removing item', variant: 'destructive' });
    },
  });

  return {
    data: query.data || [],
    loading: query.isLoading,
    error: query.error,
    addItem: addMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    removeItem: removeMutation.mutateAsync,
    refresh: () => queryClient.invalidateQueries({ queryKey: [tableName] }),
  };
}
