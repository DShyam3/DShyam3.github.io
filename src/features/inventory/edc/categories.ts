import type { InventoryRow } from '@/collections/inventory';

/** Display the inventory's existing categories consistently in the EDC view and editor. */
export function edcCategoryLabel(item: InventoryRow): string {
  if (item.category === 'wardrobe' && item.subcategory === 'jewellery') return 'Jewellery';
  const labels: Record<string, string> = {
    tech: 'Tech',
    wardrobe: 'Wardrobe',
    hygiene: 'Toiletries',
    homelab: 'HomeLab',
    'sports-gear': 'Sports Gear',
    edc: 'Essentials',
  };
  return labels[item.category] ?? (item.category || 'Uncategorised')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
