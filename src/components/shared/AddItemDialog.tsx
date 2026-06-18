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
import { Switch } from '@/components/ui/switch';
import { InventoryItem, Category, WardrobeSubcategory, WARDROBE_SUBCATEGORIES, HomeLabSubcategory, HOMELAB_SUBCATEGORIES } from '@/types/inventory';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddItemDialogProps {
    onAdd: (item: Omit<InventoryItem, 'id' | 'createdAt'>) => void;
}

export function AddItemDialog({ onAdd }: AddItemDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState<Category>('tech-edc');
    const [subcategory, setSubcategory] = useState<WardrobeSubcategory | HomeLabSubcategory | ''>('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState('');
    const [link, setLink] = useState('');
    const [isWishlist, setIsWishlist] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!brand.trim()) newErrors.brand = 'Brand is required';
        if (!price.trim()) {
            newErrors.price = 'Price is required';
        } else if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            newErrors.price = 'Price must be a valid positive number';
        }

        if ((category === 'wardrobe' || category === 'homelab') && !subcategory) {
            newErrors.subcategory = 'Subcategory is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Please fill in all required fields');
            return;
        }

        onAdd({
            name,
            brand,
            category,
            subcategory: (category === 'wardrobe' || category === 'homelab') ? subcategory as any : undefined,
            price: parseFloat(price),
            image,
            link: link || undefined,
            isWishlist,
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
        setIsWishlist(false);
        setErrors({});
    };

    const handlePriceBlur = () => {
        if (!price) return;
        const num = parseFloat(price);
        if (!isNaN(num)) {
            setPrice(num.toFixed(2));
        }
    };

    const handleCategoryChange = (value: string) => {
        setCategory(value as Category);
        // Reset subcategory when category changes away from wardrobe/homelab
        if (value !== 'wardrobe' && value !== 'homelab') {
            setSubcategory('');
        }
        if (errors.subcategory) {
            setErrors((prev) => ({ ...prev, subcategory: '' }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Item
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Add New Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className={cn(errors.name && "text-destructive")}>Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                            }}
                            placeholder="MacBook Pro 16"
                            className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brand" className={cn(errors.brand && "text-destructive")}>Brand *</Label>
                        <Input
                            id="brand"
                            value={brand}
                            onChange={(e) => {
                                setBrand(e.target.value);
                                if (errors.brand) setErrors((prev) => ({ ...prev, brand: '' }));
                            }}
                            placeholder="Apple"
                            className={cn(errors.brand && "border-destructive focus-visible:ring-destructive")}
                        />
                        {errors.brand && <p className="text-xs text-destructive">{errors.brand}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={category} onValueChange={handleCategoryChange}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tech-edc">Tech + EDC</SelectItem>
                                <SelectItem value="homelab">HomeLab</SelectItem>
                                <SelectItem value="wardrobe">Wardrobe</SelectItem>
                                <SelectItem value="kitchen">Kitchen</SelectItem>
                                <SelectItem value="home-decor">Home Decor</SelectItem>
                                <SelectItem value="hygiene">Hygiene</SelectItem>
                                <SelectItem value="sports-gear">Sports Gear</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch id="wishlist" checked={isWishlist} onCheckedChange={setIsWishlist} />
                        <Label htmlFor="wishlist" className="cursor-pointer text-sm font-medium">Add to Wishlist</Label>
                    </div>

                    {(category === 'wardrobe' || category === 'homelab') && (
                        <div className="space-y-2">
                            <Label htmlFor="subcategory" className={cn(errors.subcategory && "text-destructive")}>Subcategory *</Label>
                            <Select
                                value={subcategory}
                                onValueChange={(v) => {
                                    setSubcategory(v as any);
                                    if (errors.subcategory) setErrors((prev) => ({ ...prev, subcategory: '' }));
                                }}
                            >
                                <SelectTrigger className={cn(errors.subcategory && "border-destructive focus:ring-destructive")}>
                                    <SelectValue placeholder="Select subcategory..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(category === 'wardrobe' ? WARDROBE_SUBCATEGORIES : HOMELAB_SUBCATEGORIES).map((sub) => (
                                        <SelectItem key={sub.key} value={sub.key}>
                                            {sub.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.subcategory && <p className="text-xs text-destructive">{errors.subcategory}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="price" className={cn(errors.price && "text-destructive")}>Price (£) *</Label>
                        <Input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={price}
                            onChange={(e) => {
                                setPrice(e.target.value);
                                if (errors.price) setErrors((prev) => ({ ...prev, price: '' }));
                            }}
                            onBlur={handlePriceBlur}
                            placeholder="2499.00"
                            className={cn(errors.price && "border-destructive focus-visible:ring-destructive")}
                        />
                        {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
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
                            type="text"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://... or N/A for custom items"
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
