import type { CollectionRow, FacetDef } from './types';

export const ALL = 'all';

/**
 * The option a facet starts on, and returns to when a resetsOthers facet
 * changes. One function so first render and reset cannot disagree.
 */
export function defaultFor<T extends CollectionRow>(facet: FacetDef<T>): string {
  return facet.defaultValue ?? (facet.includeAll === false ? facet.options[0]?.key : ALL);
}

/**
 * The filters that keep one row in view, for a record picked in the command
 * palette. A facet with an All option goes to All; one without goes to the
 * option the row belongs to. A row no option claims (a category the config
 * does not list) would stay hidden under every real option, so that facet
 * goes to All, and the filter bar shows All until another option is picked.
 */
export function revealFilters<T extends CollectionRow>(
  facets: FacetDef<T>[],
  row: T,
): Record<string, string> {
  return Object.fromEntries(
    facets.map((facet) => {
      if (facet.includeAll !== false) return [facet.key, ALL];
      const option = facet.options.find((o) =>
        facet.match ? facet.match(row, o.key) : String(row[facet.field]) === o.key,
      );
      return [facet.key, option?.key ?? ALL];
    }),
  );
}

/**
 * The filters after picking `value` on facet `key`. A resetsOthers facet puts
 * every other facet back on its default.
 */
export function nextFilters<T extends CollectionRow>(
  facets: FacetDef<T>[],
  current: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const changed = facets.find((facet) => facet.key === key);
  const next = { ...current, [key]: value };
  if (changed?.resetsOthers) {
    for (const facet of facets) {
      if (facet.key !== key) next[facet.key] = defaultFor(facet);
    }
  }
  return next;
}

/**
 * The filters an option's count is taken under: what picking it would give,
 * except for the option already selected, which counts what is on screen.
 * Picking it again changes nothing, and after a palette reveal the other
 * facets can sit off their defaults (Inventory's category on All with
 * Ownership on All), so resetting them would count a different list.
 */
export function countFilters<T extends CollectionRow>(
  facets: FacetDef<T>[],
  current: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  return current[key] === value ? current : nextFilters(facets, current, key, value);
}
