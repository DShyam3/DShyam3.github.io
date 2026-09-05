import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** A value a PostgREST `.eq()` filter can be compared against. */
export type FilterValue = string | number | boolean | null;

/** A row on its way into the database, before the table is known. */
export type TableRowInput = Record<string, unknown>;

// The table name only exists as a string at runtime, so the generated
// per-table types cannot narrow anything in this hook. Drop to the untyped
// client once, here, rather than casting at every call site below.
const db = supabase as unknown as SupabaseClient;

export function useSupabaseTable<T>(
  tableName: string,
  options?: {
    /** PostgREST select list. Defaults to every column. */
    columns?: string;
    filter?: { column: string; value: FilterValue };
    orderBy?: { column: string; ascending?: boolean };
    primaryKey?: string;
  }
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pk = options?.primaryKey || 'id';

  const columns = options?.columns ?? '*';

  const query = useQuery({
    queryKey: [tableName, columns, options?.filter],
    queryFn: async () => {
      let q = db.from(tableName).select(columns);

      if (options?.filter) {
        q = q.eq(options.filter.column, options.filter.value);
      }

      // Every table this hook is pointed at has created_at, so it is the
      // default order. A caller that wants a different one says so.
      q = q.order(options?.orderBy?.column ?? 'created_at', {
        ascending: options?.orderBy?.ascending ?? false,
      });

      const { data, error } = await q;

      // No sort-error fallback. It used to catch 42703 and silently re-run the
      // whole query unordered, which turned a wrong sort column into a second
      // round trip and a quietly unsorted list instead of a visible failure.
      // Sort columns are declared per collection now, so a bad one is a bug to
      // surface, not to paper over.
      if (error) throw error;
      return data as T[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (newItem: TableRowInput) => {
      const { data, error } = await db
        .from(tableName)
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
    mutationFn: async ({ id, updates }: { id: string | number; updates: Partial<T> }) => {
      const { error } = await db
        .from(tableName)
        .update(updates)
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
    mutationFn: async (id: string | number) => {
      const { error } = await db
        .from(tableName)
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
