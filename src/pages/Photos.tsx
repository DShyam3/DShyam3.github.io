import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useState, useRef } from 'react';
import { usePhotos } from '@/hooks/usePhotos';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MapPin, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Photo } from '@/types/photos';
import { EditPhotoDialog } from '@/components/photos/EditPhotoDialog';
import { uploadPhoto } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

const Photos = () => {
  const { isAdmin } = useAuth();
  const { photos, addPhoto, removePhoto, updatePhoto, loading } = usePhotos();
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please select a JPEG, PNG, WebP, GIF, or HEIC image.', variant: 'destructive' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 50MB.', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setLocation('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const publicUrl = await uploadPhoto(selectedFile);

      // Save to database
      addPhoto({
        image_url: publicUrl,
        caption: caption.trim() || undefined,
        location: location.trim() || undefined,
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Failed to upload photo', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Photos" subtitle="Moments I've captured" />

        <div className="flex items-center justify-between px-4 md:px-0 pt-8">
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${photos.length} photos`}</p>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Photo</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="font-serif">Upload Photo</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* File Upload Area */}
                  <div className="space-y-2">
                    <Label>Image *</Label>
                    <div
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {previewUrl ? (
                        <div className="space-y-2">
                          <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-md object-cover" />
                          <p className="text-xs text-muted-foreground">{selectedFile?.name} ({(selectedFile?.size ?? 0 / 1024 / 1024).toFixed(1)} KB)</p>
                          <p className="text-xs text-muted-foreground">Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">Click to select an image</p>
                          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, GIF up to 50MB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  <div className="space-y-2"><Label htmlFor="caption">Caption</Label><Input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Describe this moment..." /></div>
                  <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where was this taken?" /></div>

                  <Button type="submit" className="w-full gap-2" disabled={!selectedFile || uploading}>
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" />Upload Photo</>
                    )}
                  </Button>
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