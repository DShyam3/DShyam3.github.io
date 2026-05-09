import { useState, useMemo } from 'react';
import { Article, ArticleCategory } from '@/types/articles';
import { useSupabaseTable } from './useSupabaseTable';

export function useArticles() {
  const { data: articles, loading, addItem, removeItem, updateItem } = useSupabaseTable<Article>('articles');
  const [activeCategory, setActiveCategory] = useState<ArticleCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = useMemo(() => {
    let filtered = articles;
    if (activeCategory !== 'all') {
      filtered = filtered.filter((a) => a.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.author && a.author.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [articles, activeCategory, searchQuery]);

  const categories: { key: ArticleCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'articles', label: 'Articles' },
    { key: 'publications', label: 'Publications' },
  ];

  const getCategoryCount = (category: ArticleCategory) =>
    category === 'all'
      ? articles.length
      : articles.filter((a) => a.category === category).length;

  return {
    articles: filteredArticles,
    allArticles: articles,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addArticle: addItem,
    removeArticle: removeItem,
    updateArticle: (id: string, updates: Partial<Article>) => updateItem({ id, updates }),
    categories,
    getCategoryCount,
    loading,
  };
}