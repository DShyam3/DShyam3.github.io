export type RecipeCategory = 'all' | 'personal' | 'reference';

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  link?: string;
  is_personal: boolean;
  ingredients?: string;
  instructions?: string;
  category: string;
  created_at: Date;
}