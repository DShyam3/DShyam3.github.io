import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { useState } from 'react';
import { useRecipes } from '@/hooks/useRecipes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChefHat } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RecipeCategory, Recipe } from '@/types/recipes';
import { cn } from '@/lib/utils';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';
import { EditRecipeDialog } from '@/components/recipes/EditRecipeDialog';

const Recipes = () => {
  const { isAdmin } = useAuth();
  const { recipes, addRecipe, removeRecipe, updateRecipe, loading, categories, activeCategory, setActiveCategory, getCategoryCount } = useRecipes();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [isPersonal, setIsPersonal] = useState(true);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addRecipe({ title: title.trim(), description: description.trim() || undefined, image_url: imageUrl.trim() || undefined, link: link.trim() || undefined, is_personal: isPersonal, ingredients: ingredients.trim() || undefined, instructions: instructions.trim() || undefined, category: 'main' });
    setTitle(''); setDescription(''); setImageUrl(''); setLink(''); setIsPersonal(true); setIngredients(''); setInstructions(''); setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Recipes" subtitle="Dishes I love to make" />

        <nav className="flex flex-wrap items-center justify-center gap-2 md:gap-4 py-4 px-4 border-b border-border/50">
          {categories.map((cat, index) => (
            <div key={cat.key} className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setActiveCategory(cat.key as RecipeCategory)}
                className={cn(
                  'nav-link relative py-1',
                  activeCategory === cat.key && 'nav-link-active'
                )}
              >
                <DotMatrixText text={cat.label.toUpperCase()} size="xs" />
                <span className="ml-1.5 text-xs text-muted-foreground/60">
                  ({getCategoryCount(cat.key as RecipeCategory)})
                </span>
                {activeCategory === cat.key && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-foreground" />
                )}
              </button>
              {index < categories.length - 1 && (
                <span className="text-muted-foreground/30 hidden md:inline">·</span>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${recipes.length} recipes`}</p>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Recipe</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-serif">Add Recipe</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch id="isPersonal" checked={isPersonal} onCheckedChange={setIsPersonal} />
                    <Label htmlFor="isPersonal">{isPersonal ? 'My Recipe' : 'Reference Recipe'}</Label>
                  </div>
                  <div className="space-y-2"><Label htmlFor="title">Title *</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <div className="space-y-2"><Label htmlFor="imageUrl">Image URL</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
                  {!isPersonal && <div className="space-y-2"><Label htmlFor="link">Source Link</Label><Input id="link" value={link} onChange={(e) => setLink(e.target.value)} /></div>}
                  {isPersonal && (
                    <>
                      <div className="space-y-2"><Label htmlFor="ingredients">Ingredients</Label><Textarea id="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} placeholder="One ingredient per line" /></div>
                      <div className="space-y-2"><Label htmlFor="instructions">Instructions</Label><Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} /></div>
                    </>
                  )}
                  <Button type="submit" className="w-full">Add Recipe</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="px-4 md:px-0 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />) :
            recipes.length === 0 ? <p className="col-span-full text-center py-16 text-muted-foreground">No recipes yet</p> :
              recipes.map((r) => <RecipeCard key={r.id} recipe={r} onRemove={isAdmin ? removeRecipe : undefined} onUpdate={isAdmin ? updateRecipe : undefined} />)}
        </div>

        <Footer />
      </div>
    </div>
  );
};

// Recipe Card Component
function RecipeCard({ recipe: r, onRemove, onUpdate }: {
  recipe: Recipe;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Recipe, 'id' | 'created_at'>>) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const handleDelete = () => {
    if (onRemove) {
      onRemove(r.id);
      setDetailOpen(false);
    }
  };

  return (
    <>
      <div className="item-card group relative cursor-pointer" onClick={() => setDetailOpen(true)}>
        <div className="aspect-square bg-muted relative overflow-hidden">
          {r.image_url ? <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ChefHat className="h-14 w-14 text-muted-foreground/30" /></div>}
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onUpdate && <EditRecipeDialog recipe={r} onUpdate={onUpdate} />}
            {onRemove && (
              <Button variant="secondary" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-background/80" onClick={() => onRemove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!r.is_personal && <span className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-background/80 rounded">Reference</span>}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium line-clamp-2">{r.title}</h3>
              {r.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>}
            </div>
          </div>
        </div>
      </div>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={r.title}
        subtitle={r.is_personal ? 'My Recipe' : 'Reference Recipe'}
        imageUrl={r.image_url}
        link={r.link}
        badge={r.is_personal ? 'Personal' : 'Reference'}
        onDelete={onRemove ? handleDelete : undefined}
      >
        {r.description && (
          <DetailSection label="Description">
            <p className="whitespace-pre-wrap">{r.description}</p>
          </DetailSection>
        )}
        {r.ingredients && (
          <DetailSection label="Ingredients">
            <p className="whitespace-pre-wrap">{r.ingredients}</p>
          </DetailSection>
        )}
        {r.instructions && (
          <DetailSection label="Instructions">
            <p className="whitespace-pre-wrap">{r.instructions}</p>
          </DetailSection>
        )}
      </CardDetailDialog>
    </>
  );
}

export default Recipes;
