import { useState } from 'react';
import { Creator, CreatorCategory } from '@/types/creators';
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
import { Pencil } from 'lucide-react';

interface EditCreatorDialogProps {
  creator: Creator;
  onUpdate: (id: string, updates: Partial<Omit<Creator, 'id' | 'created_at'>>) => void;
}

export function EditCreatorDialog({ creator, onUpdate }: EditCreatorDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(creator.name);
  const [imageUrl, setImageUrl] = useState(creator.image_url || '');
  const [link, setLink] = useState(creator.link || '');
  const [category, setCategory] = useState<Exclude<CreatorCategory, 'all'>>(creator.category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onUpdate(creator.id, {
      name: name.trim(),
      image_url: imageUrl.trim() || undefined,
      link: link.trim() || undefined,
      category,
    });

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-background/80 backdrop-blur-sm"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Creator</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-imageUrl">Image URL</Label>
            <Input
              id="edit-imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-link">Link</Label>
            <Input
              id="edit-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Exclude<CreatorCategory, 'all'>)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="painter">Painter</SelectItem>
                <SelectItem value="photographer">Photographer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
