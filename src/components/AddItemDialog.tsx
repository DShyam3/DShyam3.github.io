import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { InventoryItem, Category, WardrobeSubcategory, WARDROBE_SUBCATEGORIES } from '@/types/inventory';
import { toast } from 'sonner';

interface AddItemDialogProps {
    onAdd: (item: Omit<InventoryItem, 'id' | 'createdAt'>) => void;
}

export function AddItemDialog({ onAdd }: AddItemDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState<Exclude<Category, 'all'>>('tech-edc');
    const [subcategory, setSubcategory] = useState<WardrobeSubcategory | ''>('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState('');
    const [link, setLink] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !brand || !price) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (category === 'wardrobe' && !subcategory) {
            toast.error('Please select a subcategory for wardrobe items');
            return;
        }

        onAdd({
            name,
            brand,
            category,
            subcategory: category === 'wardrobe' ? subcategory as WardrobeSubcategory : undefined,
            price: parseFloat(price),
            image,
            link: link || undefined,
        });

        toast.success('Item added to collection');
        setOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setBrand('');
        setCategory('tech-edc');
        setSubcategory('');
        setPrice('');
        setImage('');
        setLink('');
    };

    const handleCategoryChange = (value: string) => {
        setCategory(value as Exclude<Category, 'all'>);
        // Reset subcategory when category changes
        if (value !== 'wardrobe') {
            setSubcategory('');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Item
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Add New Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="MacBook Pro 16"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand">Brand *</Label>
                        <Input
                            id="brand"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="Apple"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={category} onValueChange={handleCategoryChange}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tech-edc">Tech + EDC</SelectItem>
                                <SelectItem value="wardrobe">Wardrobe</SelectItem>
                                <SelectItem value="kitchen">Kitchen</SelectItem>
                                <SelectItem value="vehicles">Vehicles</SelectItem>
                                <SelectItem value="home-decor">Home Decor</SelectItem>
                                <SelectItem value="hygiene">Hygiene</SelectItem>
                                <SelectItem value="sports-gear">Sports Gear</SelectItem>
                                <SelectItem value="wishlist">Wishlist</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {category === 'wardrobe' && (
                        <div className="space-y-2">
                            <Label htmlFor="subcategory">Subcategory *</Label>
                            <Select value={subcategory} onValueChange={(v) => setSubcategory(v as WardrobeSubcategory)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subcategory..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {WARDROBE_SUBCATEGORIES.map((sub) => (
                                        <SelectItem key={sub.key} value={sub.key}>
                                            {sub.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="price">Price (£) *</Label>
                        <Input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="2499"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Image URL</Label>
                        <Input
                            id="image"
                            type="url"
                            value={image}
                            onChange={(e) => setImage(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="link">Product URL</Label>
                        <Input
                            id="link"
                            type="url"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            Add Item
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

