import { useArticlesContext } from '@/contexts/ArticlesContext';

export function useArticles() {
  const context = useArticlesContext();
  if (!context) throw new Error('useArticles must be used within an ArticlesProvider');
  return context;
}