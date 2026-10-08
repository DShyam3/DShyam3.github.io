import { describe, expect, it } from 'vitest';
import { INVENTORY_COLUMNS, MAX_INVENTORY_ITEMS, searchInventory, type InventoryToolRow } from './inventory-tool';

const row = (overrides: Partial<InventoryToolRow>): InventoryToolRow => ({
  id: overrides.name ?? 'id',
  name: 'Thing',
  brand: null,
  category: 'tech',
  subcategory: null,
  price: null,
  specs: null,
  description: null,
  is_wishlist: false,
  is_edc: false,
  ...overrides,
});

const PC = row({
  name: 'Gaming PC',
  category: 'tech',
  subcategory: 'computers',
  price: 2100,
  specs: [
    '- CPU: [AMD Ryzen 7 9800X3D](https://example.com/cpu) (£449.99)',
    '- GPU: [MSI GeForce RTX 5080](https://example.com/gpu) (£1,179.90)',
    '- Case: Fractal North',
  ].join('\n'),
});

const ROWS: InventoryToolRow[] = [
  PC,
  row({ name: 'Sony WH-1000XM5', brand: 'Sony', subcategory: 'audio', price: 299.99, description: 'Headphones for the commute.' }),
  row({ name: 'AirPods Pro', brand: 'Apple', subcategory: 'audio', price: 229, description: 'Earbuds.' }),
  row({ name: 'Leica Q3', brand: 'Leica', price: 5300, is_wishlist: true }),
  row({ name: 'Wool coat', category: 'wardrobe', price: 0.1 }),
  row({ name: 'Linen shirt', category: 'wardrobe', price: 0.2 }),
];

const data = (result: ReturnType<typeof searchInventory>) => {
  if (!('data' in result)) throw new Error(result.error);
  return result.data;
};

describe('searchInventory', () => {
  it('finds a PC and lists its parts with the parts total already added', () => {
    const result = data(searchInventory({ query: 'what is in my PC' }, ROWS));
    expect(result.matched).toBe(1);
    const [pc] = result.items;
    expect(pc.name).toBe('Gaming PC');
    expect(pc.partsTotal).toBe(1629.89);
    expect(pc.partsCurrency).toBe('£');
    expect(pc.specs).toEqual([
      { label: 'CPU', value: 'AMD Ryzen 7 9800X3D', price: 449.99, currency: '£' },
      { label: 'GPU', value: 'MSI GeForce RTX 5080', price: 1179.9, currency: '£' },
      { label: 'Case', value: 'Fractal North', price: null, currency: null },
    ]);
  });

  it('sends the part names but never the links around them', () => {
    expect(JSON.stringify(searchInventory({ query: 'pc' }, ROWS))).not.toContain('example.com');
  });

  it('matches the start of a word, so "pc" does not find "spec"', () => {
    const rows = [row({ name: 'Notebook', description: 'Full spec sheet inside' })];
    expect(data(searchInventory({ query: 'pc' }, rows)).matched).toBe(0);
  });

  it('finds a plural through the description', () => {
    const result = data(searchInventory({ query: 'headphones' }, ROWS));
    expect(result.items.map(item => item.name)).toEqual(['Sony WH-1000XM5']);
  });

  it('sums every match itself, in pence', () => {
    const result = data(searchInventory({ query: '', category: 'wardrobe' }, ROWS));
    expect(result.owned).toEqual({ count: 2, pricedCount: 2, total: 0.3 });
  });

  it('totals owned and wishlist items apart, so a wish never counts as spent', () => {
    const result = data(searchInventory({ query: '', category: 'tech' }, ROWS));
    expect(result.owned.total).toBe(2628.99);
    expect(result.wishlist).toEqual({ count: 1, pricedCount: 1, total: 5300 });
  });

  it('reads a build list written into the description, as the page does', () => {
    const old = row({
      name: 'Old PC',
      description: '- CPU: [Ryzen 5](https://example.com/a) (£150.00)\n- GPU: [RX 6600](https://example.com/b) (£199.99)',
    });
    const [item] = data(searchInventory({ query: 'old pc' }, [old])).items;
    expect(item.partsTotal).toBe(349.99);
    expect(item.specs.map(spec => spec.value)).toEqual(['Ryzen 5', 'RX 6600']);
    expect(item.description).toBeNull();
    expect(JSON.stringify(item)).not.toContain('example.com');
  });

  it('finds the everyday carry by its flag, across categories', () => {
    const rows = [
      row({ name: 'Watch', category: 'wardrobe', is_edc: true }),
      row({ name: 'Knife', category: 'edc', is_edc: true }),
      row({ name: 'Sofa', category: 'home-decor' }),
    ];
    const result = data(searchInventory({ query: '', category: 'edc' }, rows));
    expect(result.items.map(item => item.name)).toEqual(['Knife', 'Watch']);
    expect(result.items.every(item => item.inEdc)).toBe(true);
  });

  it('gives no parts total across currencies', () => {
    const mixed = row({ name: 'Rig', specs: 'A: x (£10.00)\nB: y ($5)' });
    const [item] = data(searchInventory({ query: 'rig' }, [mixed])).items;
    expect(item.partsTotal).toBeNull();
    expect(item.specs.map(spec => spec.currency)).toEqual(['£', '$']);
  });

  it('marks wishlist entries as not owned', () => {
    const [leica] = data(searchInventory({ query: 'leica' }, ROWS)).items;
    expect(leica.owned).toBe(false);
  });

  it('prefers items with every word, falling back to any word', () => {
    expect(data(searchInventory({ query: 'sony audio' }, ROWS)).items.map(i => i.name)).toEqual(['Sony WH-1000XM5']);
    expect(data(searchInventory({ query: 'sony leica' }, ROWS)).matched).toBe(2);
  });

  it('caps the list but not the totals', () => {
    const many = Array.from({ length: MAX_INVENTORY_ITEMS + 5 }, (_, i) => row({ name: `Cable ${i}`, price: 1 }));
    const result = data(searchInventory({ query: 'cable' }, many));
    expect(result.items).toHaveLength(MAX_INVENTORY_ITEMS);
    expect(result.matched).toBe(MAX_INVENTORY_ITEMS + 5);
    expect(result.owned.total).toBe(MAX_INVENTORY_ITEMS + 5);
  });

  it('asks for something to search by rather than dumping everything', () => {
    expect(searchInventory({ query: '' }, ROWS)).toHaveProperty('error');
    expect(searchInventory({}, ROWS)).toHaveProperty('error');
  });

  it('projects only the fields it lists', () => {
    const widened = [{ ...PC, image: 'https://cdn/x.jpg', link: 'https://shop/x', created_at: '2026-01-01' }];
    const [item] = data(searchInventory({ query: 'pc' }, widened)).items;
    expect(Object.keys(item).sort()).toEqual([
      'brand', 'category', 'description', 'inEdc', 'name', 'owned', 'partsCurrency', 'partsTotal', 'price', 'specs',
      'subcategory',
    ]);
  });

  it('reads only the columns it projects', () => {
    expect(INVENTORY_COLUMNS).not.toMatch(/image|link|created_at/);
  });
});
