import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Recipe, RecipeCategory } from '@/types/recipes';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RecipesContextType {
    recipes: Recipe[];
    allRecipes: Recipe[];
    activeCategory: RecipeCategory;
    setActiveCategory: (category: RecipeCategory) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addRecipe: (recipe: Omit<Recipe, 'id' | 'created_at'>) => Promise<void>;
    removeRecipe: (id: string) => Promise<void>;
    updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id' | 'created_at'>>) => Promise<void>;
    categories: { key: RecipeCategory; label: string }[];
    getCategoryCount: (category: RecipeCategory) => number;
    loading: boolean;
    refreshRecipes: () => Promise<void>;
}

const RecipesContext = createContext<RecipesContextType | undefined>(undefined);

export const RecipesProvider = ({ children }: { children: ReactNode }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [activeCategory, setActiveCategory] = useState<RecipeCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchRecipes = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setRecipes(data?.map(r => ({ ...r, created_at: new Date(r.created_at) })) || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

    const addRecipe = async (recipe: Omit<Recipe, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase.from('recipes').insert(recipe).select().single();
            if (error) throw error;
            setRecipes(prev => [{ ...data, created_at: new Date(data.created_at) }, ...prev]);
            toast({ title: 'Recipe added!' });
        } catch (error) { toast({ title: 'Error adding recipe', variant: 'destructive' }); }
    };

    const removeRecipe = async (id: string) => {
        try {
            const { error } = await supabase.from('recipes').delete().eq('id', id);
            if (error) throw error;
            setRecipes(prev => prev.filter(r => r.id !== id));
            toast({ title: 'Recipe removed' });
        } catch (error) { toast({ title: 'Error removing recipe', variant: 'destructive' }); }
    };

    const updateRecipe = async (id: string, updates: Partial<Omit<Recipe, 'id' | 'created_at'>>) => {
        try {
            const { error } = await supabase.from('recipes').update(updates).eq('id', id);
            if (error) throw error;
            setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
            toast({ title: 'Recipe updated!' });
        } catch (error) { toast({ title: 'Error updating recipe', variant: 'destructive' }); }
    };

    const filteredRecipes = useMemo(() => {
        let filtered = recipes;
        if (activeCategory !== 'all') filtered = filtered.filter(r => r.category === activeCategory);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.details?.toLowerCase().includes(q));
        }
        return filtered;
    }, [recipes, activeCategory, searchQuery]);

    const categories: { key: RecipeCategory; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'mains', label: 'Mains' },
        { key: 'desserts', label: 'Desserts' },
        { key: 'snacks', label: 'Snacks' },
        { key: 'drinks', label: 'Drinks' },
    ];

    const getCategoryCount = (category: RecipeCategory) => category === 'all' ? recipes.length : recipes.filter(r => r.category === category).length;

    return (
        <RecipesContext.Provider value={{ recipes: filteredRecipes, allRecipes: recipes, activeCategory, setActiveCategory, searchQuery, setSearchQuery, addRecipe, removeRecipe, updateRecipe, categories, getCategoryCount, loading, refreshRecipes: fetchRecipes }}>
            {children}
        </RecipesContext.Provider>
    );
};

export const useRecipesContext = () => useContext(RecipesContext);
