import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';
import { usePhotos } from '@/hooks/usePhotos';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Photo } from '@/types/photos';
import { EditPhotoDialog } from '@/components/photos/EditPhotoDialog';

const Photos = () => {
  const { isAdmin } = useAuth();
  const { photos, addPhoto, removePhoto, updatePhoto, loading } = usePhotos();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;
    addPhoto({ image_url: imageUrl.trim(), caption: caption.trim() || undefined, location: location.trim() || undefined });
    setImageUrl(''); setCaption(''); setLocation(''); setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Photos" subtitle="Moments I've captured" />

        <div className="flex items-center justify-between px-4 md:px-0 pt-8">
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${photos.length} photos`}</p>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Photo</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="font-serif">Add Photo</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="imageUrl">Image URL *</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="caption">Caption</Label><Input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                  <Button type="submit" className="w-full">Add Photo</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="px-4 md:px-0 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />) :
            photos.length === 0 ? <p className="col-span-full text-center py-16 text-muted-foreground">No photos yet</p> :
              photos.map((p) => (
                <PhotoCard key={p.id} photo={p} onRemove={isAdmin ? removePhoto : undefined} onUpdate={isAdmin ? updatePhoto : undefined} />
              ))}
        </div>

        <Footer />
      </div>
    </div>
  );
};

// Photo Card Component
function PhotoCard({ photo: p, onRemove, onUpdate }: {
  photo: Photo;
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>) => void;
}) {
  return (
    <div className="item-card group relative">
      <div className="aspect-square bg-muted relative overflow-hidden">
        <img src={p.image_url} alt={p.caption || 'Photo'} className="w-full h-full object-cover" />
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          {onUpdate && <EditPhotoDialog photo={p} onUpdate={onUpdate} />}
          {onRemove && (
            <Button variant="secondary" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 bg-background/80" onClick={() => onRemove(p.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {p.caption && <p className="text-sm line-clamp-2">{p.caption}</p>}
            {p.location && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Photos;