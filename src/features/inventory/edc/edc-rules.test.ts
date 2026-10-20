import { describe, it, expect, vi } from 'vitest';
import { inventoryCollection, type InventoryRow } from '@/collections/inventory';
import { isInEdc } from './categories';

// The collection config pulls in the photo uploader, whose client reads
// localStorage at import; nothing here touches the database.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const row = (overrides: Partial<InventoryRow>) => ({ is_edc: false, is_wishlist: false, ...overrides }) as InventoryRow;

describe('isInEdc', () => {
  it('counts an owned item flagged EDC', () => {
    expect(isInEdc(row({ is_edc: true }))).toBe(true);
  });

  it('never counts a wishlist item, even flagged EDC', () => {
    expect(isInEdc(row({ is_edc: true, is_wishlist: true }))).toBe(false);
  });

  it('treats null flags as false', () => {
    expect(isInEdc(row({ is_edc: null, is_wishlist: null }))).toBe(false);
    expect(isInEdc(row({ is_edc: true, is_wishlist: null }))).toBe(true);
  });
});

describe('inventory form validate', () => {
  const validate = inventoryCollection.validate!;

  it('refuses EDC on a wishlist item being edited', () => {
    expect(validate({ is_edc: 'true' }, row({ is_wishlist: true }))).toEqual({
      is_edc: 'Wishlist items cannot be in your EDC',
    });
  });

  it('allows EDC on an owned item, and allows clearing it on a wishlist item', () => {
    expect(validate({ is_edc: 'true' }, row({}))).toBeNull();
    expect(validate({ is_edc: 'false' }, row({ is_wishlist: true }))).toBeNull();
  });

  it('allows EDC when adding, since a new item is owned', () => {
    expect(validate({ is_edc: 'true' })).toBeNull();
  });
});
