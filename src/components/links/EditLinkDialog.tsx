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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LinkItem, LinkCategory } from '@/types/links';
import { toast } from 'sonner';

interface EditLinkDialogProps {
  link: LinkItem;
  onUpdate: (id: string, updates: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => void;
}

export function EditLinkDialog({ link, onUpdate }: EditLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(link.name);
  const [url, setUrl] = useState(link.url);
  const [description, setDescription] = useState(link.description);
  const [category, setCategory] = useState<Exclude<LinkCategory, 'all'>>(link.category);
  const [icon, setIcon] = useState(link.icon || '');

  useEffect(() => {
    if (open) {
      setName(link.name);
      setUrl(link.url);
      setDescription(link.description);
      setCategory(link.category);
      setIcon(link.icon || '');
    }
  }, [open, link]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !url) {
      toast.error('Please fill in all required fields');
      return;
    }

    onUpdate(link.id, {
      name,
      url,
      description,
      category,
      icon: icon || undefined,
    });

    toast.success('Link updated');
    setOpen(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Edit Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-link-name">Name *</Label>
            <Input
              id="edit-link-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Figma"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-link-url">URL *</Label>
            <Input
              id="edit-link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://figma.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-link-description">Description</Label>
            <Textarea
              id="edit-link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of why you like this..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-link-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Exclude<LinkCategory, 'all'>)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="websites">Websites</SelectItem>
                <SelectItem value="iphone-apps">iPhone Apps</SelectItem>
                <SelectItem value="ipad-apps">iPad Apps</SelectItem>
                <SelectItem value="mac-apps">Mac Apps</SelectItem>
                <SelectItem value="dev-setup">Dev Setup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-link-icon">Icon URL (optional)</Label>
            <Input
              id="edit-link-icon"
              type="url"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="https://..."
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
