import { useState, useCallback, useMemo, useEffect } from 'react';
import { InventoryItem, Category, WardrobeSubcategory, WARDROBE_SUBCATEGORIES } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// NOTE: Our generated backend types may not always include legacy/public tables like
// `inventory_items`. To keep the app working, we use an untyped client for this table.
const db = supabase as any;

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'recent'>('recent');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch items from backend
  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await db
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setItems(
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          brand: item.brand || '',
          category: item.category as Exclude<Category, 'all'>,
          subcategory: item.subcategory as WardrobeSubcategory | undefined,
          price: Number(item.price) || 0,
          image: item.image || '',
          link: item.link || undefined,
          isNew: item.is_new || false,
          createdAt: new Date(item.created_at),
        })) || []
      );
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      toast({ title: 'Error fetching items', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(async (item: Omit<InventoryItem, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await db
        .from('inventory_items')
        .insert({
          name: item.name,
          brand: item.brand,
          category: item.category,
          subcategory: item.subcategory || null,
          price: item.price,
          image: item.image,
          link: item.link || null,
          is_new: item.isNew || false,
        })
        .select()
        .single();

      if (error) throw error;

      setItems((prev) => [{
        id: data.id,
        name: data.name,
        brand: data.brand || '',
        category: data.category as Exclude<Category, 'all'>,
        subcategory: data.subcategory as WardrobeSubcategory | undefined,
        price: Number(data.price) || 0,
        image: data.image || '',
        link: data.link || undefined,
        isNew: data.is_new || false,
        createdAt: new Date(data.created_at),
      }, ...prev]);

      toast({ title: 'Item added!' });
    } catch (error) {
      console.error('Error adding item:', error);
      toast({ title: 'Error adding item', variant: 'destructive' });
    }
  }, [toast]);

  const removeItem = useCallback(async (id: string) => {
    try {
      const { error } = await db.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Item removed' });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({ title: 'Error removing item', variant: 'destructive' });
    }
  }, [toast]);

  const updateItem = useCallback(async (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.brand !== undefined) dbUpdates.brand = updates.brand;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.subcategory !== undefined) dbUpdates.subcategory = updates.subcategory;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.image !== undefined) dbUpdates.image = updates.image;
      if (updates.link !== undefined) dbUpdates.link = updates.link;
      if (updates.isNew !== undefined) dbUpdates.is_new = updates.isNew;

      // If category is changed away from wardrobe, clear subcategory
      if (updates.category && updates.category !== 'wardrobe') {
        dbUpdates.subcategory = null;
      }

      const { error } = await db
        .from('inventory_items')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const updated = { ...item, ...updates };
            // Clear subcategory if category changed away from wardrobe
            if (updates.category && updates.category !== 'wardrobe') {
              updated.subcategory = undefined;
            }
            return updated;
          }
          return item;
        })
      );
      toast({ title: 'Item updated!' });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error updating item', variant: 'destructive' });
    }
  }, [toast]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.brand.toLowerCase().includes(query)
      );
    }

    // Special sorting for wardrobe category - sort by subcategory order
    if (activeCategory === 'wardrobe') {
      const subcategoryOrder = WARDROBE_SUBCATEGORIES.map(s => s.key);
      return [...filtered].sort((a, b) => {
        const aIndex = a.subcategory ? subcategoryOrder.indexOf(a.subcategory) : 999;
        const bIndex = b.subcategory ? subcategoryOrder.indexOf(b.subcategory) : 999;
        if (aIndex !== bIndex) return aIndex - bIndex;
        // Within same subcategory, sort alphabetically
        return a.name.localeCompare(b.name);
      });
    }

    // Apply normal sorting for other categories
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'alphabetical') {
        return a.name.localeCompare(b.name);
      } else {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }, [items, activeCategory, searchQuery, sortOrder]);

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'Everything' },
    { key: 'tech-edc', label: 'Tech + EDC' },
    { key: 'wardrobe', label: 'Wardrobe' },
    { key: 'kitchen', label: 'Kitchen' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'home-decor', label: 'Home Decor' },
    { key: 'hygiene', label: 'Hygiene' },
    { key: 'sports-gear', label: 'Sports Gear' },
    { key: 'wishlist', label: 'Wishlist' },
  ];

  const getCategoryCount = (category: Category) => {
    if (category === 'all') return items.length;
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

