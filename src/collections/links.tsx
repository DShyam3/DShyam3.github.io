import { DetailSection } from '@/components/cards/CardDetailDialog';
import { uploadPhoto } from '@/lib/storage';
import { LinkCheckStatus } from './components/LinkCheckStatus';
import { buildHighDpiFaviconUrl, parseLinkUrl, resolveLinkIcon } from './link-icons';
import { fetchLinkMetadata } from './link-metadata';
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
  { key: 'dev-setup', label: 'Dev Setup' },
  { key: 'websites', label: 'Websites' },
  { key: 'iphone-apps', label: 'iPhone' },
  { key: 'ipad-apps', label: 'iPad' },
  { key: 'mac-apps', label: 'Mac' },
];

const labelFor = (key: string) =>
  CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const linksCollection: CollectionConfig<LinkRow> = {
  table: 'links',
  columns: 'id, name, url, description, category, icon, created_at',
  path: '/links',
  title: 'Links',
  subtitle: 'Useful resources',
  noun: { singular: 'Link', plural: 'Links' },

  searchFields: ['name', 'description'],

  // The daily link check, for the owner only: its results are readable by no
  // one else. Every link, not the filtered ones, so a failing link is never
  // hidden by a category filter.
  summary: (_shown, isAdmin, all) => (isAdmin ? <LinkCheckStatus links={all} /> : null),

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'media',
    // Favicons, square and never cropped.
    aspect: '1 / 1',
    // Favicons are logos, not artwork -- fit them whole, on a logo's plate.
    imageFit: 'logo',
    title: (link) => link.name,
    subtitle: (link) => labelFor(link.category),
    image: (link) => resolveLinkIcon(link.icon, link.url),
    // A logo's white plate is lifted off so the mark sits on the theme; a
    // mark that has stopped loading is replaced by the site's own icon.
    cleanImage: {
      want: 'icon',
      page: (link) => link.url,
      field: 'icon',
      fallbacks: (link) => {
        const host = parseLinkUrl(link.url)?.hostname;
        return host ? [buildHighDpiFaviconUrl(host)] : [];
      },
    },
    href: (link) => link.url,
    excerpt: (link) => link.description ?? undefined,
  },

  // Image fields take a pasted URL or an upload; uploads go to the photos
  // bucket, which avoids depending on a third-party URL staying alive.
  uploadFile: uploadPhoto,

  // The URL comes first: pasting it fills in the name and description below.
  fields: [
    { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://figma.com' },
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Figma' },
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
    const parsed = parseLinkUrl(values.url.trim());
    if (!parsed || values.icon?.trim()) return null;
    return {
      icon: buildHighDpiFaviconUrl(parsed.hostname),
    };
  },

  // Once a URL is pasted or entered, the page's own name and description fill
  // whichever of those fields are still empty. Read by the links-metadata
  // function, since a browser cannot read another site's page.
  fillFrom: {
    field: 'url',
    fill: (value) => {
      const parsed = parseLinkUrl(value);
      // Only a web page has a page to read; a mailto: link has none.
      const readable = parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:');
      return readable ? fetchLinkMetadata(parsed.href) : Promise.resolve(null);
    },
    hint: 'Pasting a link fills in an empty name and description.',
    pending: 'Reading the page…',
    filled: 'Filled in from the page.',
    nothing: 'The page gives no name or description.',
    failed: "Couldn't read that page. Fill in the name and description yourself.",
  },

  // No URL row: the dialog title is already a link out, so repeating the
  // address underneath was noise.
  renderDetail: (link) =>
    link.description ? (
      <DetailSection label="Description">
        <p className="whitespace-pre-wrap">{link.description}</p>
      </DetailSection>
    ) : null,
};
