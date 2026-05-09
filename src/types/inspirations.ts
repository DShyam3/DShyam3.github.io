export type InspirationCategory = 'all' | 'entrepreneurs' | 'thinkers' | 'creators' | 'artists-painters' | 'photographers';

export interface Inspiration {
  id: string;
  name: string;
  image_url?: string;
  link?: string;
  description?: string;
  category: string;
  why_i_like?: string;
  created_at: Date;
}