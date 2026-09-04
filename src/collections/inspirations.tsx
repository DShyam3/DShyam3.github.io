import { User } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface InspirationRow extends CollectionRow {
  name: string;
  image_url: string | null;
  link: string | null;
  description: string | null;
  category: string;
  why_i_like: string | null;
  created_at: string;
}

const CATEGORIES = [
  { key: 'entrepreneurs', label: 'Entrepreneurs' },
  { key: 'thinkers', label: 'Thinkers' },
  { key: 'creators', label: 'Creators' },
  { key: 'artists-painters', label: 'Artists / Painters' },
  { key: 'photographers', label: 'Photographers' },
];

const labelFor = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const inspirationsCollection: CollectionConfig<InspirationRow> = {
  table: 'inspirations',
  path: '/inspiration',
  title: 'Inspiration',
  subtitle: 'People I look up to',
  noun: { singular: 'Person', plural: 'People' },

  searchFields: ['name', 'description'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'square',
    fallbackIcon: User,
    title: (person) => person.name,
    subtitle: (person) => labelFor(person.category),
    image: (person) => person.image_url ?? undefined,
    href: (person) => person.link ?? undefined,
    excerpt: (person) => person.why_i_like ?? undefined,
    badge: (person) => labelFor(person.category),
  },

  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', defaultValue: 'creators' },
    { name: 'image_url', label: 'Image URL', type: 'image' },
    { name: 'link', label: 'Link', type: 'url' },
    { name: 'why_i_like', label: 'Why I like them', type: 'textarea' },
    { name: 'description', label: 'Notes', type: 'textarea' },
  ],

  renderDetail: (person) => (
    <>
      {person.why_i_like && (
        <DetailSection label="Why I Like Them">
          <p className="whitespace-pre-wrap">{person.why_i_like}</p>
        </DetailSection>
      )}
      {person.description && (
        <DetailSection label="Notes">
          <p className="whitespace-pre-wrap">{person.description}</p>
        </DetailSection>
      )}
    </>
  ),
};
