import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface BeliefRow extends CollectionRow {
  quote: string;
  author: string | null;
  created_at: string;
}

/**
 * The one collection with no image and no categories: the quote is the whole
 * card. Hence the `text` variant, and no facets or search box -- FilterBar
 * renders nothing rather than an empty bordered strip.
 */
export const beliefsCollection: CollectionConfig<BeliefRow> = {
  table: 'beliefs',
  path: '/beliefs',
  adminOnly: true,
  title: 'Beliefs',
  subtitle: 'Principles I live by',
  noun: { singular: 'Belief', plural: 'Beliefs' },

  facets: [],

  card: {
    variant: 'text',
    title: (belief) => belief.quote,
    subtitle: (belief) => belief.author ?? undefined,
  },

  fields: [
    { name: 'quote', label: 'Belief', type: 'textarea', required: true, rows: 3 },
    { name: 'author', label: 'Source / Author', type: 'text' },
  ],

  renderDetail: (belief) => (
    <DetailSection label="Belief">
      <p className="whitespace-pre-wrap font-serif italic">"{belief.quote}"</p>
      {belief.author && (
        <p className="text-sm text-muted-foreground mt-2">— {belief.author}</p>
      )}
    </DetailSection>
  ),
};
