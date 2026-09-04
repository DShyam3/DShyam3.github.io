import { useState, useMemo, useCallback } from 'react';
import { useSupabaseTable } from '@/hooks/useSupabaseTable';
import type { CollectionConfig, CollectionRow } from './types';

export const ALL = 'all';

/**
 * Data + filtering for one collection, driven entirely by its config.
 *
 * Replaces the near-identical useBooks / useLinks / useArticles / useRecipes /
 * useInspirations / usePhotos / useBeliefs hooks, which differed only in the
 * noun. The facet model also covers the watchlist's six filters, so that page
 * does not need its own copy either.
 */
export function useCollection<T extends CollectionRow, R>(config: CollectionConfig<T, R>) {
  const { data, loading, addItem, updateItem, removeItem } = useSupabaseTable<T>(
    config.table,
    config.sortColumn
      ? { orderBy: { column: config.sortColumn, ascending: config.sortAscending ?? false } }
      : undefined,
  );

  // One entry per facet. Most start at ALL (no filter); a facet that opts out
  // of the All option starts on its declared default, or its first option.
  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.facets.map((f) => [
        f.key,
        f.defaultValue ?? (f.includeAll === false ? f.options[0]?.key : ALL),
      ]),
    ),
  );
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(() => config.sortOptions?.[0]?.key ?? '');

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Applies every facet except one. Used both for the visible list (excluding
   * nothing) and for the option counts, where a facet's own selection must be
   * ignored or every unselected option would read zero.
   */
  const applyFacets = useCallback(
    (items: T[], exceptKey?: string) =>
      config.facets.reduce((acc, facet) => {
        const value = filters[facet.key];
        if (facet.key === exceptKey || !value || value === ALL) return acc;
        // String comparison so boolean columns (is_wishlist) work as facets.
        return acc.filter((item) => String(item[facet.field]) === value);
      }, items),
    [config.facets, filters],
  );

  const searched = useMemo(() => {
    const fields = config.searchFields;
    const query = search.trim().toLowerCase();
    if (!fields?.length || !query) return data;
    return data.filter((item) =>
      fields.some((field) => String(item[field] ?? '').toLowerCase().includes(query)),
    );
  }, [data, search, config.searchFields]);

  const faceted = useMemo(() => applyFacets(searched), [searched, applyFacets]);

  const sortOption = config.sortOptions?.find((o) => o.key === sortKey);

  const items = useMemo(
    () => (sortOption ? [...faceted].sort(sortOption.compare) : faceted),
    [faceted, sortOption],
  );

  /**
   * The grid split into labelled sections, or null when this collection does
   * not group (or the current filters do not call for it).
   */
  const groups = useMemo(() => {
    const spec = config.groupBy;
    const defined = spec?.groupsFor(filters);
    if (!spec || !defined) return null;

    const sections = defined
      .map((group) => ({
        ...group,
        items: items.filter((item) => item[spec.field] === group.key),
      }))
      .filter((group) => group.items.length > 0);

    const ungrouped = items.filter((item) => !item[spec.field]);
    if (ungrouped.length) {
      sections.push({
        key: '__ungrouped',
        label: spec.ungroupedLabel ?? 'Uncategorized',
        items: ungrouped,
      });
    }
    return sections;
  }, [items, config.groupBy, filters]);

  /**
   * How many items an option would show if selected. Counts respect the search
   * box and the *other* facets, so the numbers match what a click produces.
   */
  const countFor = useCallback(
    (facetKey: string, optionKey: string) => {
      const facet = config.facets.find((f) => f.key === facetKey);
      if (!facet) return 0;
      const pool = applyFacets(searched, facetKey);
      if (optionKey === ALL) return pool.length;
      return pool.filter((item) => String(item[facet.field]) === optionKey).length;
    },
    [config.facets, searched, applyFacets],
  );

  return {
    items,
    groups,
    all: data,
    loading,
    sortKey,
    setSortKey,
    sortOptions: config.sortOptions ?? [],
    filters,
    setFilter,
    search,
    setSearch,
    countFor,
    addItem,
    updateItem: (id: string, updates: Partial<T>) => updateItem({ id, updates }),
    removeItem,
  };
}
