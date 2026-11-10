import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { EMPTY_JOURNAL, type JournalDraft, type JournalRows, type JournalTable, type TravelItinerary, type TravelJournal } from './journal-types';

// Same dynamic-table boundary as useSupabaseTable. Row contracts live beside the feature.
const db = supabase as unknown as SupabaseClient;
const tables = { trips: 'travel_trips', visits: 'travel_visits', memories: 'travel_memories', itinerary: 'travel_itinerary' } as const;
const commonColumns = 'id,owner_id,created_at,updated_at,is_public';
const columns = {
  trips: `${commonColumns},title,start_date,end_date,status,notes`,
  visits: `${commonColumns},trip_id,country_code,city_key,city_name,start_date,end_date,status,notes`,
  memories: `${commonColumns},trip_id,visit_id,country_code,city_key,city_name,kind,title,body,category,link_url,photo_path,is_cover,sort_order`,
  itinerary: `${commonColumns},trip_id,kind,title,start_date,end_date,start_time,end_time,time_zone,arrival_time_zone,origin,destination,notes,source_key,source_name,status`,
};
// Anonymous readers have no grant on source_key / source_name, so the public list omits them.
const publicItineraryColumns = `${commonColumns},trip_id,kind,title,start_date,end_date,start_time,end_time,time_zone,arrival_time_zone,origin,destination,notes,status`;

export function useTravelJournal() {
  const { session, isAdmin, isAuthLoading } = useAuth();
  const userId = session?.user.id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['travel-journal', userId ?? 'public', isAdmin],
    enabled: !isAuthLoading,
    queryFn: async ({ signal }) => {
      async function read<K extends JournalTable>(table: K): Promise<JournalRows[K][]> {
        const result = await selectAllPages<JournalRows[K]>(
          async (from, to) => {
            const { data, error, count } = await db.from(tables[table]).select(table === 'itinerary' && !isAdmin ? publicItineraryColumns : columns[table], { count: 'exact' })
              .order('id').range(from, to).abortSignal(signal);
            return { data: data as unknown as JournalRows[K][] | null, error, count };
          },
          row => row.id,
        );
        if (result.error) throw new Error('Travel journal could not be loaded.');
        if (table === 'itinerary' && !isAdmin) return result.data.map(row => ({ ...row, source_key: null, source_name: null })) as JournalRows[K][];
        return result.data;
      }
      const [trips, visits, memories, itinerary] = await Promise.all([
        read('trips'), read('visits'), read('memories'), read('itinerary'),
      ]);
      return { trips, visits, memories, itinerary };
    },
  });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['travel-journal'] }), [client]);
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => {
      if (!userId || !isAdmin) throw new Error('Sign in as the owner to edit travel.');
      await action();
    },
    onSuccess: refresh,
  });
  const { mutateAsync } = mutation;

  const save = useCallback(async <K extends JournalTable>(table: K, draft: JournalDraft<JournalRows[K]>, existing?: JournalRows[K]) => {
    await mutateAsync(async () => {
      const values = { ...draft, owner_id: userId };
      const result = existing
        ? await db.from(tables[table]).update(values).eq('id', existing.id).eq('owner_id', userId)
          .eq('updated_at', existing.updated_at).select('id').single()
        : await db.from(tables[table]).insert(values).select('id').single();
      if (result.error || !result.data) throw new Error('Could not save. Refresh if this record changed in another tab.');
    });
  }, [mutateAsync, userId]);

  const remove = useCallback(async <K extends JournalTable>(table: K, row: JournalRows[K]) => {
    await mutateAsync(async () => {
      const { data, error } = await db.from(tables[table]).delete().eq('id', row.id).eq('owner_id', userId)
        .eq('updated_at', row.updated_at).select('id').single();
      if (error || !data) throw new Error('Could not remove. Unlink dependent records first, or refresh if the record changed.');
    });
  }, [mutateAsync, userId]);

  const importItinerary = useCallback(async (rows: JournalDraft<TravelItinerary>[]) => {
    if (!rows.length || rows.length > 2000) throw new Error('Choose between 1 and 2,000 rows.');
    await mutateAsync(async () => {
      // One statement: either the entire reviewed batch saves, or none does.
      const { error } = await db.from('travel_itinerary').insert(rows.map(row => ({ ...row, owner_id: userId, is_public: false })));
      if (error) throw new Error('Import was not saved. Refresh and check for duplicate journeys before retrying.');
    });
  }, [mutateAsync, userId]);

  const restore = useCallback(async (backup: TravelJournal & { version: 1 }) => {
    await mutateAsync(async () => {
      const { error } = await db.rpc('travel_restore', { payload: backup });
      if (error) throw new Error('Restore was not saved. Existing records or missing photo files may conflict with this backup.');
    });
  }, [mutateAsync]);

  return useMemo(() => ({ data: isAuthLoading ? EMPTY_JOURNAL : query.data ?? EMPTY_JOURNAL, loading: isAuthLoading || query.isLoading,
    error: query.error, busy: mutation.isPending, refresh, save, remove, importItinerary, restore }),
  [isAuthLoading, query.data, query.isLoading, query.error, mutation.isPending, refresh, save, remove, importItinerary, restore]);
}

export type JournalController = ReturnType<typeof useTravelJournal>;
