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

// Best-effort URL parse: tries the value as-is, then with an https://
// prefix (users often type "figma.com" without a scheme).
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

export function AddLinkDialog({ onAdd }: AddLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Exclude<LinkCategory, 'all'>>('websites');
  const [icon, setIcon] = useState('');
  const [iconLoadFailed, setIconLoadFailed] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [iconAutoFilled, setIconAutoFilled] = useState(false);

  const handleUrlBlur = () => {
    if (!url.trim()) return;
    const parsed = parseUrl(url.trim());
    if (!parsed) {
      setUrlError('Enter a valid URL');
      return;
    }
    setUrlError('');
    // Auto-fill the favicon if the user hasn't set (or hand-edited) one yet.
    if (!icon || iconAutoFilled) {
      setIcon(`https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`);
      setIconAutoFilled(true);
      setIconLoadFailed(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !url) {
      toast.error('Please fill in all required fields');
      return;
    }

    const parsed = parseUrl(url.trim());
    if (!parsed) {
      setUrlError('Enter a valid URL');
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
    setCategory('websites');
    setIcon('');
    setIconLoadFailed(false);
    setUrlError('');
    setIconAutoFilled(false);
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
            <Label htmlFor="link-url" className={urlError ? 'text-destructive' : undefined}>URL *</Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onBlur={handleUrlBlur}
              placeholder="https://figma.com"
              className={urlError ? 'border-destructive focus-visible:ring-destructive' : undefined}
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
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
                <SelectItem value="websites">Websites</SelectItem>
                <SelectItem value="iphone-apps">iPhone Apps</SelectItem>
                <SelectItem value="ipad-apps">iPad Apps</SelectItem>
                <SelectItem value="mac-apps">Mac Apps</SelectItem>
                <SelectItem value="dev-setup">Dev Setup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-icon">Icon URL (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="link-icon"
                type="url"
                value={icon}
                onChange={(e) => {
                  setIcon(e.target.value);
                  setIconAutoFilled(false);
                  setIconLoadFailed(false);
                }}
                placeholder="Auto-filled from URL, or paste your own"
              />
              {icon && !iconLoadFailed && (
                <img
                  src={icon}
                  alt="Icon preview"
                  className="h-8 w-8 shrink-0 rounded object-contain bg-secondary/30"
                  onError={() => setIconLoadFailed(true)}
                />
              )}
            </div>
            {iconLoadFailed && (
              <p className="text-xs text-destructive">Couldn't load an icon from that URL</p>
            )}
            {iconAutoFilled && !iconLoadFailed && (
              <p className="text-xs text-muted-foreground">Auto-filled from the site's favicon</p>
            )}
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
