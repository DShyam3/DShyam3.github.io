import { useState, useMemo } from 'react';
import { Recipe, RecipeCategory } from '@/types/recipes';
import { useSupabaseTable } from './useSupabaseTable';

export function useRecipes() {
  const { data: recipes, loading, addItem, removeItem, updateItem } = useSupabaseTable<Recipe>('recipes');
  const [activeCategory, setActiveCategory] = useState<RecipeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipes = useMemo(() => {
    let filtered = recipes;
    if (activeCategory !== 'all') {
      filtered = filtered.filter((r) => r.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [recipes, activeCategory, searchQuery]);

  const categories: { key: RecipeCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'personal', label: 'Personal' },
    { key: 'reference', label: 'Reference' },
  ];

  const getCategoryCount = (category: RecipeCategory) =>
    category === 'all'
      ? recipes.length
      : recipes.filter((r) => r.category === category).length;

  return {
    recipes: filteredRecipes,
    allRecipes: recipes,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addRecipe: addItem,
    removeRecipe: removeItem,
    updateRecipe: (id: string, updates: Partial<Recipe>) => updateItem({ id, updates }),
    categories,
    getCategoryCount,
    loading,
  };
}