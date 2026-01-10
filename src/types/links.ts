export type LinkCategory = 'all' | 'articles' | 'websites' | 'productivity' | 'design' | 'development' | 'entertainment';

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  category: Exclude<LinkCategory, 'all'>;
  icon?: string;
  createdAt: Date;
}
