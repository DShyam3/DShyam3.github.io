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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InventoryItem, Category, WardrobeSubcategory, WARDROBE_SUBCATEGORIES } from '@/types/inventory';
import { toast } from 'sonner';

interface EditItemDialogProps {
  item: InventoryItem;
  onUpdate: (id: string, updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) => void;
}

export function EditItemDialog({ item, onUpdate }: EditItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand);
  const [category, setCategory] = useState<Category>(item.category);
  const [subcategory, setSubcategory] = useState<WardrobeSubcategory | ''>(item.subcategory || '');
  const [price, setPrice] = useState(item.price.toString());
  const [image, setImage] = useState(item.image);
  const [link, setLink] = useState(item.link || '');

  useEffect(() => {
    if (open) {
      setName(item.name);
      setBrand(item.brand);
      setCategory(item.category);
      setSubcategory(item.subcategory || '');
      setPrice(item.price.toString());
      setImage(item.image);
      setLink(item.link || '');
    }
  }, [open, item]);

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

    onUpdate(item.id, {
      name,
      brand,
      category,
      subcategory: category === 'wardrobe' ? subcategory as WardrobeSubcategory : undefined,
      price: parseFloat(price),
      image,
      link: link || undefined,
    });

    toast.success('Item updated');
    setOpen(false);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value as Category);
    // Reset subcategory when category changes away from wardrobe
    if (value !== 'wardrobe') {
      setSubcategory('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-primary hover:text-primary-foreground w-7 h-7"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Edit Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MacBook Pro 16&quot;"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-brand">Brand *</Label>
            <Input
              id="edit-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Apple"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech-edc">Tech + EDC</SelectItem>
                <SelectItem value="wardrobe">Wardrobe</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="home-decor">Home Decor</SelectItem>
                <SelectItem value="hygiene">Hygiene</SelectItem>
                <SelectItem value="sports-gear">Sports Gear</SelectItem>
                <SelectItem value="wishlist">Wishlist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {category === 'wardrobe' && (
            <div className="space-y-2">
              <Label htmlFor="edit-subcategory">Subcategory *</Label>
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
            <Label htmlFor="edit-price">Price (£) *</Label>
            <Input
              id="edit-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2499"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-image">Image URL</Label>
            <Input
              id="edit-image"
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-link">Product URL</Label>
            <Input
              id="edit-link"
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
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
