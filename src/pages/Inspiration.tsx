import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DotMatrixText } from '@/components/DotMatrixText';
import { useState } from 'react';
import { useInspirations } from '@/hooks/useInspirations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InspirationCategory, type Inspiration as InspirationType } from '@/types/inspirations';
import { cn } from '@/lib/utils';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';
import { EditInspirationDialog } from '@/components/inspirations/EditInspirationDialog';

const Inspiration = () => {
  const { isAdmin } = useAuth();
  const { inspirations, addInspiration, removeInspiration, updateInspiration, loading, categories, activeCategory, setActiveCategory, getCategoryCount } = useInspirations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('creators');
  const [whyILike, setWhyILike] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addInspiration({
      name: name.trim(),
      image_url: imageUrl.trim() || undefined,
      link: link.trim() || undefined,
      description: description.trim() || undefined,
      category,
      why_i_like: whyILike.trim() || undefined,
    });
    setName(''); setImageUrl(''); setLink(''); setDescription(''); setCategory('creators'); setWhyILike(''); setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Inspiration" subtitle="People I look up to" />

        <nav className="flex flex-wrap items-center justify-center gap-2 md:gap-4 py-4 px-4 border-b border-border/50">
          {categories.map((cat, index) => (
            <div key={cat.key} className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setActiveCategory(cat.key as InspirationCategory)}
                className={cn(
                  'nav-link relative py-1',
                  activeCategory === cat.key && 'nav-link-active'
                )}
              >
                <DotMatrixText text={cat.label.toUpperCase()} size="xs" />
                <span className="ml-1.5 text-xs text-muted-foreground/60">
                  ({getCategoryCount(cat.key as InspirationCategory)})
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
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${inspirations.length} people`}</p>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Person</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="font-serif">Add Inspiration</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="name">Name *</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                        <SelectItem value="thinkers">Thinkers</SelectItem>
                        <SelectItem value="creators">Creators</SelectItem>
                        <SelectItem value="artists-painters">Artists / Painters</SelectItem>
                        <SelectItem value="photographers">Photographers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="imageUrl">Image URL</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="link">Link</Label><Input id="link" value={link} onChange={(e) => setLink(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="whyILike">Why I like them *</Label><Textarea id="whyILike" value={whyILike} onChange={(e) => setWhyILike(e.target.value)} rows={2} /></div>
                  <div className="space-y-2"><Label htmlFor="description">Additional notes</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
                  <Button type="submit" className="w-full">Add Person</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="px-4 md:px-0 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />) :
            inspirations.length === 0 ? <p className="col-span-full text-center py-16 text-muted-foreground">No inspirations yet</p> :
              inspirations.map((p) => <InspirationCard key={p.id} inspiration={p} onRemove={isAdmin ? removeInspiration : undefined} onUpdate={isAdmin ? updateInspiration : undefined} />)}
        </div>

        <Footer />
      </div>
    </div>
  );
};

// Inspiration Card Component
const categoryLabels: Record<string, string> = {
  entrepreneurs: 'Entrepreneurs',
  thinkers: 'Thinkers',
  creators: 'Creators',
  'artists-painters': 'Artists / Painters',
  photographers: 'Photographers',
};

function InspirationCard({ inspiration: p, onRemove, onUpdate }: {
  inspiration: InspirationType;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<InspirationType, 'id' | 'created_at'>>) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  const handleDelete = () => {
    if (onRemove) {
      onRemove(p.id);
      setDetailOpen(false);
    }
  };

  return (
    <>
      <div className="item-card group relative cursor-pointer" onClick={() => setDetailOpen(true)}>
        <div className="aspect-square bg-muted relative overflow-hidden">
          {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="h-14 w-14 text-muted-foreground/30" /></div>}
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
            {onUpdate && <EditInspirationDialog inspiration={p} onUpdate={onUpdate} />}
            {onRemove && (
              <Button variant="secondary" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-background/80" onClick={() => onRemove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium line-clamp-2">{p.name}</h3>
              {p.why_i_like && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.why_i_like}</p>}
            </div>
          </div>
        </div>
      </div>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={p.name}
        subtitle={categoryLabels[p.category] || p.category}
        imageUrl={p.image_url}
        link={p.link}
        badge={categoryLabels[p.category] || p.category}
        onDelete={onRemove ? handleDelete : undefined}
      >
        {p.why_i_like && (
          <DetailSection label="Why I Like Them">
            <p className="whitespace-pre-wrap">{p.why_i_like}</p>
          </DetailSection>
        )}
        {p.description && (
          <DetailSection label="Notes">
            <p className="whitespace-pre-wrap">{p.description}</p>
          </DetailSection>
        )}
      </CardDetailDialog>
    </>
  );
}

export default Inspiration;
