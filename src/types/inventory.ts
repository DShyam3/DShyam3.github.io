export type Category = 'tech-edc' | 'wardrobe' | 'kitchen' | 'home-decor' | 'hygiene' | 'sports-gear';

export type WardrobeSubcategory =
  | 'accessories'
  | 'sunglasses'
  | 'watches'
  | 'perfumes-colognes'
  | 'shoes'
  | 'jewellery'
  | 'cold-weather'
  | 'hoodies'
  | 'sweaters'
  | 'jackets'
  | 'shirts'
  | 't-shirts'
  | 'trousers'
  | 'jeans'
  | 'joggers'
  | 'shorts'
  | 'socks'
  | 'vests'
  | 'sports'
  | 'suits'
  | 'suit-accessories';

// Order for displaying wardrobe subcategories
export const WARDROBE_SUBCATEGORIES: { key: WardrobeSubcategory; label: string }[] = [
  { key: 'accessories', label: 'Accessories' },
  { key: 'sunglasses', label: 'Sunglasses' },
  { key: 'watches', label: 'Watches' },
  { key: 'perfumes-colognes', label: 'Perfumes / Colognes' },
  { key: 'shoes', label: 'Shoes' },
  { key: 'jewellery', label: 'Jewellery' },
  { key: 'cold-weather', label: 'Cold Weather' },
  { key: 'hoodies', label: 'Hoodies' },
  { key: 'sweaters', label: 'Sweaters' },
  { key: 'jackets', label: 'Jackets' },
  { key: 'shirts', label: 'Shirts' },
  { key: 't-shirts', label: 'T-Shirts' },
  { key: 'trousers', label: 'Trousers' },
  { key: 'jeans', label: 'Jeans' },
  { key: 'joggers', label: 'Joggers' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'socks', label: 'Socks' },
  { key: 'vests', label: 'Vests' },
  { key: 'sports', label: 'Sports' },
  { key: 'suits', label: 'Suits' },
  { key: 'suit-accessories', label: 'Suit Accessories' },
];

export interface InventoryItem {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory?: WardrobeSubcategory;
  price: number;
  image: string;
  link?: string;
  isNew?: boolean;
  isWishlist?: boolean;
  createdAt: Date;
}
