import { Fragment } from 'react';
import { ArrowDownAZ, Clock, Package } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { uploadPhoto } from '@/lib/storage';
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
  specs: string | null;
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

/**
 * Specs are written one per line as "Label: value" -- "CPU: Ryzen 9 5950X".
 * Anything without a colon is kept as a line of its own, so a rushed note is
 * still shown rather than swallowed.
 */
const parseSpecs = (specs: string) =>
  specs
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(':');
      if (colon === -1) return { label: null, value: line };
      return { label: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() };
    });

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
      // Each category is its own set of things, so picking one starts from
      // Owned rather than inheriting whatever the last category was showing.
      resetsOthers: true,
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
      // The page is called "things I own", so it opens on what is owned and
      // keeps All as the last stop rather than the first.
      allLast: true,
      defaultValue: 'false',
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
      // Dot matrix, like the count on the left of this row and the button on
      // its right -- everything the toolbar says about the collection is set
      // in the same face.
      <div className="flex flex-col items-end leading-tight">
        <DotMatrixText
          text="Total Value"
          size="xs"
          wrap={false}
          className="text-muted-foreground"
        />
        <DotMatrixText text={formatPrice(total)} size="xs" wrap={false} />
      </div>
    );
  },

  card: {
    variant: 'media',
    // Product shots, square.
    aspect: '1 / 1',
    fallbackIcon: Package,
    // Most items need no dialog: a picture, a name, a brand and a price, with
    // the title linking straight to where you'd buy it. The exceptions are the
    // homelab boxes, where the specs and the notes are the whole point -- those
    // open, the rest stay flat.
    openable: (item) => Boolean(item.specs || item.description),
    title: (item) => item.name,
    subtitle: (item) => item.brand ?? undefined,
    image: (item) => item.image ?? undefined,
    href: (item) => item.link ?? undefined,
    meta: (item) =>
      item.price != null && Number(item.price) > 0
        ? formatPrice(Number(item.price))
        : undefined,
    // Wishlist items are things not owned yet, so they sit back until hovered.
    dimmed: (item) => Boolean(item.is_wishlist),
  },

  // Image fields take a pasted URL or an upload; uploads go to the photos
  // bucket, which avoids depending on a third-party URL staying alive.
  uploadFile: uploadPhoto,

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
    {
      name: 'specs',
      label: 'Specs',
      type: 'textarea',
      rows: 6,
      placeholder: 'One per line, e.g.\nCPU: Ryzen 9 5950X\nRAM: 128GB DDR4\nStorage: 2x 4TB NVMe',
    },
  ],

  renderDetail: (item) => {
    const specs = item.specs ? parseSpecs(item.specs) : [];
    return (
      <>
        {specs.length > 0 && (
          <DetailSection label="Specs">
            <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-1">
              {specs.map((spec, index) =>
                spec.label ? (
                  <Fragment key={index}>
                    <dt className="text-muted-foreground truncate">{spec.label}</dt>
                    <dd className="min-w-0">{spec.value}</dd>
                  </Fragment>
                ) : (
                  <dd key={index} className="col-span-2 min-w-0">
                    {spec.value}
                  </dd>
                ),
              )}
            </dl>
          </DetailSection>
        )}
        {item.description && (
          <DetailSection label="Notes">
            <p className="whitespace-pre-wrap">{item.description}</p>
          </DetailSection>
        )}
      </>
    );
  },
};
