import { ChefHat } from 'lucide-react';
import { DetailSection } from '@/components/cards/CardDetailDialog';
import type { CollectionConfig, CollectionRow } from './types';

export interface RecipeRow extends CollectionRow {
  title: string;
  description: string | null;
  image_url: string | null;
  link: string | null;
  is_personal: boolean | null;
  ingredients: string | null;
  instructions: string | null;
  category: string;
  created_at: string;
}

/**
 * The categories that actually exist in the `recipes` table.
 *
 * The old nav filtered on `category` using the values 'personal' and
 * 'reference', but those are not categories at all -- personal-vs-reference is
 * the separate `is_personal` boolean, and `category` holds meal types. Every
 * row has category main|breakfast|desserts, so both tabs matched nothing and
 * only "All" worked. The add dialog compounded it by hardcoding
 * `category: 'main'` regardless of what the user picked.
 */
const CATEGORIES = [
  { key: 'main', label: 'Main' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'desserts', label: 'Desserts' },
];

export const recipesCollection: CollectionConfig<RecipeRow> = {
  table: 'recipes',
  path: '/recipes',
  title: 'Recipes',
  subtitle: 'Dishes I love to make',
  noun: { singular: 'Recipe', plural: 'Recipes' },

  searchFields: ['title', 'description'],

  facets: [{ key: 'category', field: 'category', options: CATEGORIES }],

  card: {
    variant: 'square',
    fallbackIcon: ChefHat,
    title: (recipe) => recipe.title,
    subtitle: (recipe) => (recipe.is_personal ? 'My Recipe' : 'Reference Recipe'),
    image: (recipe) => recipe.image_url ?? undefined,
    href: (recipe) => recipe.link ?? undefined,
    excerpt: (recipe) => recipe.description ?? undefined,
    badge: (recipe) => (recipe.is_personal ? 'Personal' : 'Reference'),
  },

  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'select', defaultValue: 'main' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
    { name: 'image_url', label: 'Image URL', type: 'image' },
    { name: 'link', label: 'Source Link', type: 'url' },
    {
      name: 'ingredients',
      label: 'Ingredients',
      type: 'textarea',
      rows: 4,
      placeholder: 'One ingredient per line',
    },
    { name: 'instructions', label: 'Instructions', type: 'textarea', rows: 4 },
  ],

  renderDetail: (recipe) => (
    <>
      {recipe.description && (
        <DetailSection label="Description">
          <p className="whitespace-pre-wrap">{recipe.description}</p>
        </DetailSection>
      )}
      {recipe.ingredients && (
        <DetailSection label="Ingredients">
          <p className="whitespace-pre-wrap">{recipe.ingredients}</p>
        </DetailSection>
      )}
      {recipe.instructions && (
        <DetailSection label="Instructions">
          <p className="whitespace-pre-wrap">{recipe.instructions}</p>
        </DetailSection>
      )}
    </>
  ),
};
