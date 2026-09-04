import { FileText } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface ArticleRow extends CollectionRow {
  title: string;
  author: string | null;
  link: string | null;
  image_url: string | null;
  notes: string | null;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  { key: 'articles', label: 'Articles' },
  { key: 'publications', label: 'Publications' },
];

const labelFor = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const articlesCollection: CollectionConfig<ArticleRow> = {
  table: 'articles',
  path: '/articles',
  title: 'Articles',
  subtitle: 'Cool things on the internet',
  noun: { singular: 'Article', plural: 'Articles' },

  searchFields: ['title', 'author'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'feature',
    fallbackIcon: FileText,
    title: (article) => article.title,
    subtitle: (article) => (article.author ? `by ${article.author}` : undefined),
    image: (article) => article.image_url ?? undefined,
    href: (article) => article.link ?? undefined,
    excerpt: (article) => article.notes ?? undefined,
    badge: (article) => labelFor(article.category),
  },

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'author', label: 'Author', type: 'text' },
    { name: 'category', label: 'Type', type: 'select', defaultValue: 'articles' },
    { name: 'link', label: 'Link', type: 'url' },
    { name: 'image_url', label: 'Image URL', type: 'image' },
    { name: 'notes', label: 'What I liked about it', type: 'textarea' },
  ],

  renderDetail: (article) =>
    article.notes ? (
      <DetailSection label="Notes">
        <p className="whitespace-pre-wrap">{article.notes}</p>
      </DetailSection>
    ) : null,
};
