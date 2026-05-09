export type CreatorCategory = 'all' | 'artist' | 'painter' | 'photographer';

export interface Creator {
  id: string;
  name: string;
  image_url?: string;
  link?: string;
  category: Exclude<CreatorCategory, 'all'>;
  created_at: Date;
}
