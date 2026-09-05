import { Fragment } from 'react';
import { ArrowDownAZ, Clock, Package } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { uploadPhoto } from '@/lib/storage';
import { cn } from '@/lib/utils';
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
 * A spec line is written as "Label: value", one per line, and the values that
 * came out of a build list carry two extras worth pulling apart rather than
 * printing raw: a markdown link around the part name, and a trailing "(£372.00)".
 *
 *   - GPU: [MSI GeForce RTX 5080](https://...) (£1179.90)
 *
 * Left as text that reads as a wall of URLs. Split into label, linked value and
 * price, it reads as a parts table.
 */
interface SpecSegment {
  text: string;
  href?: string;
}

interface SpecLine {
  label: string | null;
  value: SpecSegment[];
  price: string | null;
}

/** "(£372.00)" or "($42)" at the end of a line. */
const TRAILING_PRICE = /\s*\(\s*([£$€]\s*[\d,]+(?:\.\d+)?)\s*\)\s*$/;
/** Markdown link: [text](url). */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Only treat text before a colon as a label when it looks like one: short, and
 * free of the brackets and slashes that mean the colon belongs to a URL.
 */
const splitLabel = (line: string): [string | null, string] => {
  const colon = line.indexOf(':');
  if (colon <= 0) return [null, line];
  const label = line.slice(0, colon);
  if (label.length > 28 || /[[\](/]/.test(label)) return [null, line];
  return [label.trim(), line.slice(colon + 1).trim()];
};

const linkify = (value: string): SpecSegment[] => {
  const segments: SpecSegment[] = [];
  let cursor = 0;
  for (const match of value.matchAll(MARKDOWN_LINK)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ text: value.slice(cursor, start) });
    segments.push({ text: match[1], href: match[2] });
    cursor = start + match[0].length;
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor) });
  return segments.length > 0 ? segments : [{ text: value }];
};

const parseSpecs = (specs: string): SpecLine[] =>
  specs
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const priceMatch = line.match(TRAILING_PRICE);
      const price = priceMatch ? priceMatch[1].replace(/\s+/, '') : null;
      const rest = priceMatch ? line.slice(0, priceMatch.index) : line;
      const [label, value] = splitLabel(rest);
      return { label, value: linkify(value), price };
    });

/**
 * Descriptions predate the specs column, and some of them -- the build lists --
 * were already written in this shape. Render those as a table too rather than
 * as a paragraph of markdown source; a real paragraph stays a paragraph.
 */
const looksLikeSpecs = (text: string) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((line) => /^[-*•]\s+/.test(line) || splitLabel(line)[0] !== null);
};

/**
 * A build list is a list of receipts, so it is worth adding up. The item's own
 * price is what the whole thing cost; this is that same number arrived at from
 * the parts, which is the check you actually want when you edit one of them.
 */
const specsTotal = (lines: SpecLine[]) => {
  const priced = lines.filter((line) => line.price);
  if (priced.length < 2) return null;
  const symbol = priced[0].price!.slice(0, 1);
  const sum = priced.reduce(
    (total, line) => total + Number(line.price!.slice(1).replace(/,/g, '')),
    0,
  );
  if (!Number.isFinite(sum)) return null;
  return `${symbol}${sum.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const SpecTable = ({ lines }: { lines: SpecLine[] }) => {
  const total = specsTotal(lines);
  // A column of prices is worth the width when it adds up to something -- a
  // build list. One lone price right-aligned across empty space lines up with
  // nothing, so it sits next to the value it belongs to instead.
  const priceColumn = total !== null;

  const value = (line: SpecLine) =>
    line.value.map((segment, index) =>
      segment.href ? (
        <a
          key={index}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-primary transition-colors"
        >
          {segment.text}
        </a>
      ) : (
        <Fragment key={index}>{segment.text}</Fragment>
      ),
    );

  return (
    <dl
      className={cn(
        'grid gap-x-4 gap-y-1.5',
        priceColumn ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_1fr]',
      )}
    >
      {lines.map((line, index) => (
        <Fragment key={index}>
          <dt
            className={cn(
              'text-muted-foreground whitespace-nowrap',
              line.label === null && 'sr-only',
            )}
          >
            {line.label ?? `Line ${index + 1}`}
          </dt>
          <dd
            className={cn('min-w-0', line.label === null && 'col-start-1 col-span-2')}
          >
            {value(line)}
            {!priceColumn && line.price && (
              <span className="text-muted-foreground tabular-nums"> · {line.price}</span>
            )}
          </dd>
          {priceColumn && (
            <dd className="text-muted-foreground tabular-nums text-right whitespace-nowrap">
              {line.price ?? '\u00a0'}
            </dd>
          )}
        </Fragment>
      ))}
      {total && (
        <>
          <dt className="col-span-2 mt-2 pt-2 border-t border-border/60 text-muted-foreground">
            Total
          </dt>
          <dd className="mt-2 pt-2 border-t border-border/60 tabular-nums text-right whitespace-nowrap font-medium">
            {total}
          </dd>
        </>
      )}
    </dl>
  );
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
    badge: (item) => (item.is_wishlist ? 'Wishlist' : undefined),
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
    const description = item.description ?? '';
    return (
      <>
        {specs.length > 0 && (
          <DetailSection label="Specs">
            <SpecTable lines={specs} />
          </DetailSection>
        )}
        {description && (
          <DetailSection label="Notes">
            {looksLikeSpecs(description) ? (
              <SpecTable lines={parseSpecs(description)} />
            ) : (
              <p className="whitespace-pre-wrap">{description}</p>
            )}
          </DetailSection>
        )}
      </>
    );
  },
};
