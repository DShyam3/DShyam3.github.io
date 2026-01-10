import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Article, ArticleCategory } from '@/types/articles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ArticlesContextType {
    articles: Article[];
    allArticles: Article[];
    activeCategory: ArticleCategory;
    setActiveCategory: (category: ArticleCategory) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addArticle: (article: Omit<Article, 'id' | 'created_at'>) => Promise<void>;
    removeArticle: (id: string) => Promise<void>;
    updateArticle: (id: string, updates: Partial<Omit<Article, 'id' | 'created_at'>>) => Promise<void>;
    categories: { key: ArticleCategory; label: string }[];
    getCategoryCount: (category: ArticleCategory) => number;
    loading: boolean;
    refreshArticles: () => Promise<void>;
}

const ArticlesContext = createContext<ArticlesContextType | undefined>(undefined);

export const ArticlesProvider = ({ children }: { children: ReactNode }) => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [activeCategory, setActiveCategory] = useState<ArticleCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchArticles = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setArticles(data?.map(a => ({ ...a, created_at: new Date(a.created_at) })) || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchArticles(); }, [fetchArticles]);

    const addArticle = async (article: Omit<Article, 'id' | 'created_at'>) => {
        try {
            const { data, error } = await supabase.from('articles').insert(article).select().single();
            if (error) throw error;
            setArticles(prev => [{ ...data, created_at: new Date(data.created_at) }, ...prev]);
            toast({ title: 'Article added!' });
        } catch (error) { toast({ title: 'Error adding article', variant: 'destructive' }); }
    };

    const removeArticle = async (id: string) => {
        try {
            const { error } = await supabase.from('articles').delete().eq('id', id);
            if (error) throw error;
            setArticles(prev => prev.filter(a => a.id !== id));
            toast({ title: 'Article removed' });
        } catch (error) { toast({ title: 'Error removing article', variant: 'destructive' }); }
    };

    const updateArticle = async (id: string, updates: Partial<Omit<Article, 'id' | 'created_at'>>) => {
        try {
            const { error } = await supabase.from('articles').update(updates).eq('id', id);
            if (error) throw error;
            setArticles(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
            toast({ title: 'Article updated!' });
        } catch (error) { toast({ title: 'Error updating article', variant: 'destructive' }); }
    };

    const filteredArticles = useMemo(() => {
        let filtered = articles;
        if (activeCategory !== 'all') filtered = filtered.filter(a => a.category === activeCategory);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || (a.author && a.author.toLowerCase().includes(q)));
        }
        return filtered;
    }, [articles, activeCategory, searchQuery]);

    const categories: { key: ArticleCategory; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'articles', label: 'Articles' },
        { key: 'publications', label: 'Publications' },
    ];

    const getCategoryCount = (category: ArticleCategory) => category === 'all' ? articles.length : articles.filter(a => a.category === category).length;

    return (
        <ArticlesContext.Provider value={{ articles: filteredArticles, allArticles: articles, activeCategory, setActiveCategory, searchQuery, setSearchQuery, addArticle, removeArticle, updateArticle, categories, getCategoryCount, loading, refreshArticles: fetchArticles }}>
            {children}
        </ArticlesContext.Provider>
    );
};

export const useArticlesContext = () => useContext(ArticlesContext);
