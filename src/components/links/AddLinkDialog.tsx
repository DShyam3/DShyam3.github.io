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

interface AddLinkDialogProps {
  onAdd: (link: Omit<LinkItem, 'id' | 'createdAt'>) => void;
}

export function AddLinkDialog({ onAdd }: AddLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Exclude<LinkCategory, 'all'>>('productivity');
  const [icon, setIcon] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !url) {
      toast.error('Please fill in all required fields');
      return;
    }

    onAdd({
      name,
      url,
      description,
      category,
      icon: icon || undefined,
    });

    toast.success('Link added');
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setUrl('');
    setDescription('');
    setCategory('productivity');
    setIcon('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add New Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="link-name">Name *</Label>
            <Input
              id="link-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Figma"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-url">URL *</Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://figma.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-description">Description</Label>
            <Textarea
              id="link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of why you like this..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Exclude<LinkCategory, 'all'>)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="productivity">Productivity</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="entertainment">Entertainment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-icon">Icon URL (optional)</Label>
            <Input
              id="link-icon"
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
              Add Link
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
