import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface LinkRow extends CollectionRow {
  name: string;
  url: string;
  description: string | null;
  category: string;
  icon: string | null;
  created_at: string;
}

/** Single source of truth for the categories: nav, form select and card badge. */
const CATEGORIES = [
  { key: 'websites', label: 'Websites' },
  { key: 'iphone-apps', label: 'iPhone Apps' },
  { key: 'ipad-apps', label: 'iPad Apps' },
  { key: 'mac-apps', label: 'Mac Apps' },
  { key: 'dev-setup', label: 'Dev Setup' },
];

const labelFor = (key: string) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

/**
 * Best-effort URL parse: tries the value as-is, then with an https:// prefix,
 * since people type "figma.com" without a scheme.
 */
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

export const linksCollection: CollectionConfig<LinkRow> = {
  table: 'links',
  path: '/links',
  title: 'Links',
  subtitle: 'Useful resources',
  noun: { singular: 'Link', plural: 'Links' },

  searchFields: ['name', 'description'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'media',
    // Favicons are logos, not artwork -- fit them whole rather than cropping.
    imageFit: 'contain',
    title: (link) => link.name,
    subtitle: (link) => labelFor(link.category),
    image: (link) => link.icon ?? undefined,
    href: (link) => link.url,
    excerpt: (link) => link.description ?? undefined,
  },

  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Figma' },
    { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://figma.com' },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'A brief description of why you like this...',
    },
    { name: 'category', label: 'Category', type: 'select', defaultValue: 'websites' },
    {
      name: 'icon',
      label: 'Icon URL (optional)',
      type: 'image',
      placeholder: "Auto-filled from URL, or paste your own",
    },
  ],

  // Fill the favicon in once a URL is entered, unless one is already set.
  onFieldBlur: (field, values) => {
    if (field !== 'url' || !values.url?.trim()) return null;
    const parsed = parseUrl(values.url.trim());
    if (!parsed || values.icon?.trim()) return null;
    return {
      icon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
    };
  },

  validate: (values) =>
    values.url && !parseUrl(values.url.trim())
      ? { url: 'Enter a valid URL' }
      : null,

  // No URL row: the dialog title is already a link out, so repeating the
  // address underneath was noise.
  renderDetail: (link) =>
    link.description ? (
      <DetailSection label="Description">
        <p className="whitespace-pre-wrap">{link.description}</p>
      </DetailSection>
    ) : null,
};
