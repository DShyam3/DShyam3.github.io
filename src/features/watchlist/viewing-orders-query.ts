import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import type { OrderEntryInput } from './franchise';

/** An entry as stored: the pure `OrderEntryInput` plus its row id. */
export interface StoredEntry extends OrderEntryInput {
  entryId: number;
}

export interface StoredOrder {
  id: number;
  name: string;
  description: string | null;
  tmdbCollectionId: number | null;
  entries: StoredEntry[];
}

export const VIEWING_ORDERS_SELECT =
  'id, name, description, tmdb_collection_id, entries:viewing_order_entries(id, media_type, tmdb_id, title, release_date, poster, note, position)';

export const viewingOrdersQueryOptions = queryOptions({
  queryKey: ['watchlist', 'viewing-orders'],
  queryFn: async (): Promise<StoredOrder[]> => {
    const { data, error } = await supabase
      .from('viewing_orders')
      .select(VIEWING_ORDERS_SELECT)
      .order('created_at', { ascending: true })
      .order('position', { referencedTable: 'viewing_order_entries', ascending: true })
      .order('id', { referencedTable: 'viewing_order_entries', ascending: true });
    if (error) throw error;
    return (data ?? []).map((order) => ({
      id: order.id,
      name: order.name,
      description: order.description,
      tmdbCollectionId: order.tmdb_collection_id,
      entries: (order.entries ?? []).map((e) => ({
        entryId: e.id,
        key: `${e.media_type}:${e.tmdb_id}`,
        mediaType: e.media_type === 'tv' ? 'tv' : 'movie',
        tmdbId: e.tmdb_id,
        title: e.title,
        releaseDate: e.release_date,
        poster: e.poster,
        note: e.note,
      })),
    }));
  },
  retry: false,
});

/** A library film that belongs to a TMDB collection. */
export interface LibraryCollectionRow {
  id: string;
  tmdbId: number | null;
  collectionId: number;
  collectionName: string | null;
}

/** Read here, not with the library, so the site-wide warm-up stays small. */
export const libraryCollectionsQueryOptions = queryOptions({
  queryKey: ['watchlist', 'library-collections'],
  queryFn: async (): Promise<LibraryCollectionRow[]> => {
    const { data, error } = await selectAllPages(
      (from, to) =>
        supabase
          .from('movies')
          .select('id, tmdb_id, collection_id, collection_name', { count: 'exact' })
          .not('collection_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      (row) => String(row.id),
    );
    if (error) throw error;
    return data.flatMap((row) =>
      row.collection_id == null
        ? []
        : [{
            id: String(row.id),
            tmdbId: row.tmdb_id,
            collectionId: row.collection_id,
            collectionName: row.collection_name,
          }],
    );
  },
  retry: false,
});

const entryRow = (orderId: number, entry: OrderEntryInput, position: number) => ({
  order_id: orderId,
  position,
  media_type: entry.mediaType,
  tmdb_id: entry.tmdbId,
  title: entry.title,
  release_date: entry.releaseDate,
  poster: entry.poster,
  note: entry.note?.trim() || null,
});

export async function createOrder(input: {
  name: string;
  description?: string;
  tmdbCollectionId?: number;
  entries?: OrderEntryInput[];
}): Promise<number> {
  const { data, error } = await supabase
    .from('viewing_orders')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      tmdb_collection_id: input.tmdbCollectionId ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  const entries = input.entries ?? [];
  if (entries.length > 0) {
    const { error: entriesError } = await supabase
      .from('viewing_order_entries')
      .insert(entries.map((entry, i) => entryRow(data.id, entry, i + 1)));
    if (entriesError) {
      // Do not leave an empty order behind a half-saved series.
      const { error: rollbackError } = await supabase.from('viewing_orders').delete().eq('id', data.id);
      if (rollbackError) {
        throw new Error(`${entriesError.message}; the empty order could not be removed: ${rollbackError.message}`);
      }
      throw entriesError;
    }
  }
  return data.id;
}

export async function renameOrder(orderId: number, name: string) {
  const { error } = await supabase
    .from('viewing_orders')
    .update({ name: name.trim() })
    .eq('id', orderId);
  if (error) throw error;
}

export async function deleteOrder(orderId: number) {
  const { error } = await supabase.from('viewing_orders').delete().eq('id', orderId);
  if (error) throw error;
}

export async function addEntry(orderId: number, entry: OrderEntryInput) {
  const { data: last, error: readError } = await supabase
    .from('viewing_order_entries')
    .select('position')
    .eq('order_id', orderId)
    .order('position', { ascending: false })
    .limit(1);
  if (readError) throw readError;
  const position = (last?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from('viewing_order_entries')
    .insert(entryRow(orderId, entry, position));
  if (error) throw error;
}

export async function removeEntry(entryId: number) {
  const { error } = await supabase.from('viewing_order_entries').delete().eq('id', entryId);
  if (error) throw error;
}

export async function updateEntryNote(entryId: number, note: string) {
  const { error } = await supabase
    .from('viewing_order_entries')
    .update({ note: note.trim() || null })
    .eq('id', entryId);
  if (error) throw error;
}

/** The ids with the one at `from` moved to `to`; the input is not changed. */
export function reorderedIds(entryIds: number[], from: number, to: number): number[] {
  const next = [...entryIds];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** `entryIds` is the order's full current id list, in position order. */
export async function moveEntry(orderId: number, entryIds: number[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= entryIds.length || to >= entryIds.length) return;
  const { error } = await supabase.rpc('reorder_viewing_order', {
    p_order_id: orderId,
    p_entry_ids: reorderedIds(entryIds, from, to),
  });
  if (error) throw error;
}
