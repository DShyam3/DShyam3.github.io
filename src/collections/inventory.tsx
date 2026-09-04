import { ArrowDownAZ, Clock, Package } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface InventoryRow extends CollectionRow {
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  price: number | null;
  image: string | null;
  link: string | null;
  is_new: boolean | null;
  is_wishlist: boolean | null;
  description: string | null;
  created_at: string;
}

/**
 * Inventory always shows exactly one category -- there is no "everything"
 * view -- so the facet opts out of the All option and starts on tech-edc.
 */
const CATEGORIES = [
  { key: 'tech-edc', label: 'Tech + EDC' },
  { key: 'homelab', label: 'HomeLab' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'home-decor', label: 'Home Decor' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'sports-gear', label: 'Sports Gear' },
];

/** Display order for the subcategory sections shown under Wardrobe. */
const WARDROBE_SUBCATEGORIES = [
  { key: 'accessories', label: 'Accessories' },
  { key: 'sunglasses', label: 'Sunglasses' },
  { key: 'watches', label: 'Watches' },
  { key: 'perfumes-colognes', label: 'Perfumes / Colognes' },
  { key: 'shoes', label: 'Shoes' },
  { key: 'jewellery', label: 'Jewellery' },
  { key: 'cold-weather', label: 'Cold Weather' },
  { key: 'hoodies', label: 'Hoodies' },
  { key: 'sweaters', label: 'Sweaters' },
  { key: 'jackets', label: 'Jackets' },
  { key: 'shirts', label: 'Shirts' },
  { key: 't-shirts', label: 'T-Shirts' },
  { key: 'trousers', label: 'Trousers' },
  { key: 'jeans', label: 'Jeans' },
  { key: 'joggers', label: 'Joggers' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'socks', label: 'Socks' },
  { key: 'vests', label: 'Vests' },
  { key: 'sports', label: 'Sports' },
  { key: 'suits', label: 'Suits' },
  { key: 'suit-accessories', label: 'Suit Accessories' },
];

const HOMELAB_SUBCATEGORIES = [
  { key: 'compute', label: 'Compute' },
  { key: 'networking', label: 'Networking' },
  { key: 'general-homelab', label: 'General HomeLab' },
];

const SUBCATEGORIES: Record<string, { key: string; label: string }[]> = {
  wardrobe: WARDROBE_SUBCATEGORIES,
  homelab: HOMELAB_SUBCATEGORIES,
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const inventoryCollection: CollectionConfig<InventoryRow> = {
  table: 'inventory_items',
  path: '/inventory',
  title: 'Inventory',
  subtitle: 'Things I own',
  noun: { singular: 'Item', plural: 'Items' },

  searchFields: ['name', 'brand'],

  facets: [
    {
      key: 'category',
      field: 'category',
      options: CATEGORIES,
      includeAll: false,
      defaultValue: 'tech-edc',
    },
    {
      // is_wishlist is a boolean column; facet values are compared as strings.
      // The old page split owned and wishlist into two stacked sections, which
      // meant scrolling past everything owned to reach the wishlist.
      key: 'owned',
      field: 'is_wishlist',
      options: [
        { key: 'false', label: 'Owned' },
        { key: 'true', label: 'Wishlist' },
      ],
    },
  ],

  groupBy: {
    field: 'subcategory',
    // Only wardrobe and homelab have subcategories worth sectioning.
    groupsFor: (filters) => SUBCATEGORIES[filters.category],
  },

  sortOptions: [
    {
      key: 'alphabetical',
      label: 'A-Z',
      icon: ArrowDownAZ,
      compare: (a, b) => a.name.localeCompare(b.name),
      // Wardrobe and homelab are grouped by subcategory, so a global sort
      // would fight the section order.
      hiddenWhen: (filters) => Boolean(SUBCATEGORIES[filters.category]),
    },
    {
      key: 'recent',
      label: 'Recent',
      icon: Clock,
      compare: (a, b) => b.created_at.localeCompare(a.created_at),
      hiddenWhen: (filters) => Boolean(SUBCATEGORIES[filters.category]),
    },
  ],

  summary: (items, isAdmin) => {
    if (!isAdmin) return null;
    const total = items.reduce(
      (sum, item) => (item.is_wishlist ? sum : sum + Number(item.price ?? 0)),
      0,
    );
    return (
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Total Value</p>
        <p className="text-sm font-semibold">{formatPrice(total)}</p>
      </div>
    );
  },

  card: {
    variant: 'square',
    fallbackIcon: Package,
    title: (item) => item.name,
    subtitle: (item) => item.brand ?? undefined,
    image: (item) => item.image ?? undefined,
    href: (item) => item.link ?? undefined,
    excerpt: (item) => item.description ?? undefined,
    badge: (item) =>
      item.is_wishlist ? 'Wishlist' : item.is_new ? 'New' : undefined,
  },

  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'category', label: 'Category', type: 'select', defaultValue: 'tech-edc' },
    {
      name: 'subcategory',
      label: 'Subcategory (wardrobe and homelab only)',
      type: 'select',
      options: [...WARDROBE_SUBCATEGORIES, ...HOMELAB_SUBCATEGORIES],
    },
    { name: 'price', label: 'Price', type: 'text', placeholder: '0.00' },
    { name: 'image', label: 'Image URL', type: 'image' },
    { name: 'link', label: 'Link', type: 'url' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],

  renderDetail: (item) => (
    <>
      {item.description && (
        <DetailSection label="Description">
          <p className="whitespace-pre-wrap">{item.description}</p>
        </DetailSection>
      )}
      {item.price != null && Number(item.price) > 0 && (
        <DetailSection label="Price">{formatPrice(Number(item.price))}</DetailSection>
      )}
    </>
  ),
};
