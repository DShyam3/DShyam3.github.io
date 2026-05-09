export type ArticleCategory = 'all' | 'articles' | 'publications';

export interface Article {
  id: string;
  title: string;
  author?: string;
  link?: string;
  image_url?: string;
  notes?: string;
  category: string;
  created_at: Date;
}