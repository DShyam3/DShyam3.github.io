import { describe, expect, it } from 'vitest';
import { ALL, countFilters, defaultFor, nextFilters, revealFilters } from './facets';
import type { CollectionRow, FacetDef } from './types';

interface Item extends CollectionRow {
  category: string;
  is_edc: boolean;
  is_wishlist: boolean;
}

const row = (overrides: Partial<Item>): Item => ({
  id: 'item-1',
  category: 'tech',
  is_edc: false,
  is_wishlist: false,
  ...overrides,
});

// Shaped like Inventory's facets: a category with no All option and a custom
// match, plus an ordinary facet that has one.
const category: FacetDef<Item> = {
  key: 'category',
  field: 'category',
  options: [
    { key: 'edc', label: 'EDC' },
    { key: 'tech', label: 'Tech' },
  ],
  includeAll: false,
  defaultValue: 'edc',
  match: (item, value) => (value === 'edc' ? item.is_edc && !item.is_wishlist : item.category === value),
};
const owned: FacetDef<Item> = {
  key: 'owned',
  field: 'is_wishlist',
  options: [
    { key: 'false', label: 'Owned' },
    { key: 'true', label: 'Wishlist' },
  ],
};

describe('revealFilters', () => {
  it('puts a facet with an All option on All', () => {
    expect(revealFilters([owned], row({ is_wishlist: true }))).toEqual({ owned: ALL });
  });

  it('puts a facet without All on the option the row belongs to', () => {
    expect(revealFilters([category, owned], row({ category: 'tech' }))).toEqual({
      category: 'tech',
      owned: ALL,
    });
  });

  it('uses the facet match, so an EDC row lands on EDC', () => {
    expect(revealFilters([category], row({ category: 'tech', is_edc: true }))).toEqual({ category: 'edc' });
  });

  it('puts a facet without All on All when no option claims the row', () => {
    // Under the default (EDC) or any other real option this row is filtered out.
    expect(defaultFor(category)).toBe('edc');
    expect(revealFilters([category], row({ category: 'garden' }))).toEqual({ category: ALL });
  });
});

describe('nextFilters', () => {
  const resetting: FacetDef<Item> = { ...category, resetsOthers: true };
  const ownedByDefault: FacetDef<Item> = { ...owned, defaultValue: 'false' };

  it('sets one facet and leaves the others', () => {
    expect(nextFilters([category, ownedByDefault], { category: 'edc', owned: 'true' }, 'category', 'tech'))
      .toEqual({ category: 'tech', owned: 'true' });
  });

  it('puts the other facets back on their defaults for a resetsOthers facet', () => {
    expect(nextFilters([resetting, ownedByDefault], { category: 'edc', owned: 'true' }, 'category', 'tech'))
      .toEqual({ category: 'tech', owned: 'false' });
  });
});

describe('countFilters', () => {
  const resetting: FacetDef<Item> = { ...category, resetsOthers: true };
  const ownedByDefault: FacetDef<Item> = { ...owned, defaultValue: 'false' };
  // What a palette reveal of a wishlist row in an unlisted category leaves.
  const revealed = { category: ALL, owned: ALL };

  it('counts the selected option under the filters on screen', () => {
    // Resetting Ownership to Owned here would count the revealed wishlist row out: "All (0)".
    expect(countFilters([resetting, ownedByDefault], revealed, 'category', ALL)).toBe(revealed);
  });

  it('counts any other option under what picking it would give', () => {
    expect(countFilters([resetting, ownedByDefault], revealed, 'category', 'tech'))
      .toEqual({ category: 'tech', owned: 'false' });
  });
});
