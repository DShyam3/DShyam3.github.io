export type LinkCategory = 'all' | 'websites' | 'iphone-apps' | 'ipad-apps' | 'mac-apps' | 'dev-setup';

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  category: Exclude<LinkCategory, 'all'>;
  icon?: string;
  createdAt: Date;
}
