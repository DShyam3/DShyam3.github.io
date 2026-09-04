import { linksCollection } from './links';
import type { CollectionConfig, CollectionRow } from './types';

/**
 * Every collection the site has, in nav order.
 *
 * This exists to be read. It is the one place that answers "what does this
 * site list?" without opening the router or the nav component, and each entry
 * points at the single file that defines that collection end to end.
 *
 * Adding a collection: write `src/collections/<name>.tsx`, add it here, add a
 * route in App.tsx, and add the schema file in `supabase/schemas/`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const collections: CollectionConfig<any>[] = [
  linksCollection,
  // books, articles, recipes, inspirations, photos, inventory and beliefs
  // land here as Phase 4 converts them.
];

export function collectionByPath(
  path: string,
): CollectionConfig<CollectionRow> | undefined {
  return collections.find((c) => c.path === path);
}
