import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { selectAllPages } from '@/integrations/supabase/select-all-pages';
import { collections } from './registry';
import type { CollectionRow } from './types';

const db = supabase as unknown as SupabaseClient;

/**
 * Every picture a card shows, across every collection that keeps cleaned
 * copies -- what `pruneImageCache` must not delete. Read fresh, in the
 * owner's session, so rows only the owner can see count too, and read whole,
 * past the server's row cap.
 *
 * Null, and nothing pruned, if any read fails or comes back empty: a source
 * left out here would have its copy deleted.
 */
export async function imageSourcesInUse(): Promise<ReadonlySet<string> | null> {
  const sources = new Set<string>();
  for (const config of collections) {
    const image = config.card.image;
    if (!config.card.cleanImage || !image) continue;
    const { data, error } = await selectAllPages<CollectionRow>(
      (from, to) =>
        db
          .from(config.table)
          .select(config.columns ?? '*', { count: 'exact' })
          .order('id')
          .range(from, to)
          .overrideTypes<CollectionRow[], { merge: false }>(),
      (row) => row.id,
    );
    if (error || data.length === 0) {
      console.warn(`Card image copies: ${config.table} could not be read whole, so nothing was pruned.`);
      return null;
    }
    for (const row of data) {
      const source = image(row);
      if (source) sources.add(source);
    }
  }
  return sources;
}
