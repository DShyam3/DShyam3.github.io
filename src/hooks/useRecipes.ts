import { useRecipesContext } from '@/contexts/RecipesContext';

export function useRecipes() {
  const context = useRecipesContext();
  if (!context) throw new Error('useRecipes must be used within a RecipesProvider');
  return context;
}