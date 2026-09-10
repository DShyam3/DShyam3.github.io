export interface EdcSlotDef {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const EDC_SLOTS: EdcSlotDef[] = [
  {
    key: 'pockets',
    label: 'On Person / Pockets',
    shortLabel: 'Pockets',
    description: 'Carried in pockets or on person daily',
  },
  {
    key: 'wrist',
    label: 'Wrist & Wearables',
    shortLabel: 'Wrist',
    description: 'Watches, rings, eyewear and wearables',
  },
  {
    key: 'bag',
    label: 'Inside the Bag',
    shortLabel: 'Bag',
    description: 'Backpack, laptop, chargers, tech pouches',
  },
  {
    key: 'keychain',
    label: 'Keyring & Tools',
    shortLabel: 'Keyring',
    description: 'Keys, pocket knives, multitools, carabiners',
  },
  {
    key: 'pouches',
    label: 'Pouches & Tech Kit',
    shortLabel: 'Pouches',
    description: 'Cables, dongles, adapters, portable power',
  },
];

export const getSlotDef = (slotKey?: string | null): EdcSlotDef =>
  EDC_SLOTS.find((s) => s.key === slotKey) ?? EDC_SLOTS[0];

export const getDefaultSlotForItem = (item: {
  category: string;
  subcategory?: string | null;
  name: string;
}): string => {
  const name = item.name.toLowerCase();
  const sub = (item.subcategory ?? '').toLowerCase();
  const cat = item.category.toLowerCase();

  if (
    sub.includes('watch') ||
    name.includes('watch') ||
    name.includes('ring') ||
    name.includes('bracelet')
  ) {
    return 'wrist';
  }
  if (
    name.includes('key') ||
    name.includes('knife') ||
    name.includes('tool') ||
    name.includes('heroclip') ||
    name.includes('airtag') ||
    name.includes('carabiner')
  ) {
    return 'keychain';
  }
  if (
    name.includes('cable') ||
    name.includes('dongle') ||
    name.includes('pouch') ||
    name.includes('adapter')
  ) {
    return 'pouches';
  }
  if (
    cat === 'wardrobe' &&
    (sub.includes('bag') || sub.includes('luggage') || sub.includes('backpack'))
  ) {
    return 'bag';
  }
  if (
    name.includes('laptop') ||
    name.includes('charger') ||
    name.includes('bottle') ||
    name.includes('pack') ||
    name.includes('macbook') ||
    name.includes('ipad')
  ) {
    return 'bag';
  }
  return 'pockets';
};
