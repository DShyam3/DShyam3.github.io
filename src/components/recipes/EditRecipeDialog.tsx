import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Recipe } from '@/types/recipes';
import { toast } from 'sonner';

interface EditRecipeDialogProps {
    recipe: Recipe;
    onUpdate: (id: string, updates: Partial<Omit<Recipe, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditRecipeDialog({ recipe, onUpdate, trigger }: EditRecipeDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(recipe.title);
    const [description, setDescription] = useState(recipe.description || '');
    const [imageUrl, setImageUrl] = useState(recipe.image_url || '');
    const [link, setLink] = useState(recipe.link || '');
    const [isPersonal, setIsPersonal] = useState(recipe.is_personal);
    const [ingredients, setIngredients] = useState(recipe.ingredients || '');
    const [instructions, setInstructions] = useState(recipe.instructions || '');

    useEffect(() => {
        if (open) {
            setTitle(recipe.title);
            setDescription(recipe.description || '');
            setImageUrl(recipe.image_url || '');
            setLink(recipe.link || '');
            setIsPersonal(recipe.is_personal);
            setIngredients(recipe.ingredients || '');
            setInstructions(recipe.instructions || '');
        }
    }, [open, recipe]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title) {
            toast.error('Please fill in required fields');
            return;
        }

        onUpdate(recipe.id, {
            title,
            description: description || undefined,
            image_url: imageUrl || undefined,
            link: link || undefined,
            is_personal: isPersonal,
            ingredients: ingredients || undefined,
            instructions: instructions || undefined,
        });

        toast.success('Recipe updated');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Edit Recipe</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="flex items-center gap-2">
                        <Switch id="edit-isPersonal" checked={isPersonal} onCheckedChange={setIsPersonal} />
                        <Label htmlFor="edit-isPersonal">{isPersonal ? 'My Recipe' : 'Reference Recipe'}</Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-recipe-title">Title *</Label>
                        <Input
                            id="edit-recipe-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-recipe-description">Description</Label>
                        <Textarea
                            id="edit-recipe-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-recipe-image">Image URL</Label>
                        <Input
                            id="edit-recipe-image"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    {!isPersonal && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-recipe-link">Source Link</Label>
                            <Input
                                id="edit-recipe-link"
                                type="url"
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                            />
                        </div>
                    )}

                    {isPersonal && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="edit-recipe-ingredients">Ingredients</Label>
                                <Textarea
                                    id="edit-recipe-ingredients"
                                    value={ingredients}
                                    onChange={(e) => setIngredients(e.target.value)}
                                    rows={4}
                                    placeholder="One ingredient per line"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-recipe-instructions">Instructions</Label>
                                <Textarea
                                    id="edit-recipe-instructions"
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
