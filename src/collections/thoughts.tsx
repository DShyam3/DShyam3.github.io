import { PenLine } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import { uploadPhoto } from '@/lib/storage';
import type { CollectionConfig, CollectionRow } from './types';

export interface ThoughtRow extends CollectionRow {
  title: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  category: string;
  created_at: string;
}

/**
 * Longer-form writing, sitting next to Beliefs. A belief is one line; a
 * thought is a piece with a body you open and read.
 */
const CATEGORIES = [
  { key: 'essay', label: 'Essays' },
  { key: 'note', label: 'Notes' },
  { key: 'reflection', label: 'Reflections' },
];

const labelFor = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const thoughtsCollection: CollectionConfig<ThoughtRow> = {
  table: 'thoughts',
  path: '/thoughts',
  title: 'Thoughts',
  subtitle: 'Things I have been thinking about',
  noun: { singular: 'Thought', plural: 'Thoughts' },

  searchFields: ['title', 'excerpt'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'media',
    // Wider than tall, like an article hero rather than a portrait.
    aspect: '16 / 9',
    fallbackIcon: PenLine,
    title: (thought) => thought.title,
    subtitle: (thought) => labelFor(thought.category),
    image: (thought) => thought.image_url ?? undefined,
    excerpt: (thought) => thought.excerpt ?? undefined,
    badge: (thought) => labelFor(thought.category),
  },

  uploadFile: uploadPhoto,

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'category', label: 'Type', type: 'select', defaultValue: 'essay' },
    {
      name: 'excerpt',
      label: 'Excerpt',
      type: 'textarea',
      rows: 2,
      placeholder: 'The line that appears on the card',
    },
    { name: 'body', label: 'Body', type: 'textarea', rows: 12 },
    { name: 'image_url', label: 'Header image', type: 'image' },
  ],

  renderDetail: (thought) => (
    <>
      {thought.excerpt && (
        <DetailSection label="In short">
          <p className="whitespace-pre-wrap">{thought.excerpt}</p>
        </DetailSection>
      )}
      {thought.body && (
        <DetailSection label="Thought">
          {/* Paragraphs are split on blank lines; the body is plain text, not
              markdown, so nothing here needs sanitising. */}
          <div className="space-y-3 leading-relaxed">
            {thought.body.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>
        </DetailSection>
      )}
    </>
  ),
};
