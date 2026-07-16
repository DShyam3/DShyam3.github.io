import { useState, useMemo } from 'react';
import { InventoryItem, Category, WardrobeSubcategory, WARDROBE_SUBCATEGORIES, HomeLabSubcategory, HOMELAB_SUBCATEGORIES } from '@/types/inventory';
import { useSupabaseTable } from './useSupabaseTable';

export function useInventory() {
  const { data: rawItems, loading, addItem: baseAddItem, removeItem, updateItem: baseUpdateItem } = useSupabaseTable<any>('inventory_items');
  const [activeCategory, setActiveCategory] = useState<Category>('tech-edc');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'recent'>('alphabetical');

  const items = useMemo(() => {
    return rawItems.map((item) => ({
      id: item.id,
      name: item.name,
      brand: item.brand || '',
      category: item.category as Category,
      subcategory: item.subcategory as WardrobeSubcategory | undefined,
      price: Number(item.price) || 0,
      image: item.image || '',
      link: item.link || undefined,
      isNew: item.is_new || false,
      isWishlist: item.is_wishlist || false,
      createdAt: new Date(item.created_at),
      description: item.description || '',
    }));
  }, [rawItems]);

  const addItem = async (item: Omit<InventoryItem, 'id' | 'createdAt'>) => {
    return baseAddItem({
      name: item.name,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory || null,
      price: item.price,
      image: item.image,
      link: item.link || null,
      is_new: item.isNew || false,
      is_wishlist: item.isWishlist || false,
      description: item.description || null,
    });
  };

  const updateItem = async (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.subcategory !== undefined) dbUpdates.subcategory = updates.subcategory;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.image !== undefined) dbUpdates.image = updates.image;
    if (updates.link !== undefined) dbUpdates.link = updates.link;
    if (updates.isNew !== undefined) dbUpdates.is_new = updates.isNew;
    if (updates.isWishlist !== undefined) dbUpdates.is_wishlist = updates.isWishlist;
    if (updates.description !== undefined) dbUpdates.description = updates.description;

    if (updates.category && updates.category !== 'wardrobe' && updates.category !== 'homelab') {
      dbUpdates.subcategory = null;
    }

    return baseUpdateItem({ id, updates: dbUpdates });
  };

  const filteredItems = useMemo(() => {
    let filtered = items.filter((item) => item.category === activeCategory);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.brand.toLowerCase().includes(query)
      );
    }

    if (activeCategory === 'wardrobe' || activeCategory === 'homelab') {
      const subcategories = activeCategory === 'wardrobe' ? WARDROBE_SUBCATEGORIES : HOMELAB_SUBCATEGORIES;
      const subcategoryOrder = subcategories.map(s => s.key);
      return [...filtered].sort((a, b) => {
        const aIndex = a.subcategory ? subcategoryOrder.indexOf(a.subcategory as any) : 999;
        const bIndex = b.subcategory ? subcategoryOrder.indexOf(b.subcategory as any) : 999;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.name.localeCompare(b.name);
      });
    }

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'alphabetical') {
        return a.name.localeCompare(b.name);
      } else {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }, [items, activeCategory, searchQuery, sortOrder]);

  const categories: { key: Category; label: string }[] = [
    { key: 'tech-edc', label: 'Tech + EDC' },
    { key: 'homelab', label: 'HomeLab' },
    { key: 'wardrobe', label: 'Wardrobe' },
    { key: 'kitchen', label: 'Kitchen' },
    { key: 'home-decor', label: 'Home Decor' },
    { key: 'hygiene', label: 'Hygiene' },
    { key: 'sports-gear', label: 'Sports Gear' },
  ];

  const getCategoryCount = (category: Category) => {
    return items.filter((item) => item.category === category).length;
  };

  return {
    items: filteredItems,
    allItems: items,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addItem,
    removeItem,
    updateItem,
    categories,
    getCategoryCount,
    sortOrder,
    setSortOrder,
    loading,
  };
}
