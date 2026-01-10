export type Category = 'all' | 'tech-edc' | 'wardrobe' | 'kitchen' | 'vehicles' | 'home-decor' | 'hygiene' | 'sports-gear' | 'wishlist';

export interface InventoryItem {
  id: string;
  name: string;
  brand: string;
  category: Exclude<Category, 'all'>;
  price: number;
  image: string;
  link?: string;
  isNew?: boolean;
  createdAt: Date;
}