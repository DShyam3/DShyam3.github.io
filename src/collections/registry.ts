import { articlesCollection } from './articles';
import { beliefsCollection } from './beliefs';
import { booksCollection } from './books';
import { inspirationsCollection } from './inspirations';
import { inventoryCollection } from './inventory';
import { linksCollection } from './links';
import { photosCollection } from './photos';
import { recipesCollection } from './recipes';
import { thoughtsCollection } from './thoughts';
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
 *
 * Nothing imports this, and that is the intended state -- the pages import
 * their own config directly. Dead-code scanners flag it as orphaned; it is
 * documentation that happens to typecheck, which is what keeps it honest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the registry holds
   configs with different row and search-result types. */
export const collections: CollectionConfig<any, any>[] = [
  linksCollection,
  booksCollection,
  articlesCollection,
  inspirationsCollection,
  recipesCollection,
  photosCollection,
  inventoryCollection,
  beliefsCollection,
  thoughtsCollection,
];

export function collectionByPath(
  path: string,
): CollectionConfig<CollectionRow, any> | undefined {
  return collections.find((c) => c.path === path);
}
