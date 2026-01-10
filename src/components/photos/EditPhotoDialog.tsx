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
import { Photo } from '@/types/photos';
import { toast } from 'sonner';

interface EditPhotoDialogProps {
    photo: Photo;
    onUpdate: (id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditPhotoDialog({ photo, onUpdate, trigger }: EditPhotoDialogProps) {
    const [open, setOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState(photo.image_url);
    const [caption, setCaption] = useState(photo.caption || '');
    const [location, setLocation] = useState(photo.location || '');

    useEffect(() => {
        if (open) {
            setImageUrl(photo.image_url);
            setCaption(photo.caption || '');
            setLocation(photo.location || '');
        }
    }, [open, photo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!imageUrl) {
            toast.error('Please provide an image URL');
            return;
        }

        onUpdate(photo.id, {
            image_url: imageUrl,
            caption: caption || undefined,
            location: location || undefined,
        });

        toast.success('Photo updated');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Edit Photo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-photo-url">Image URL *</Label>
                        <Input
                            id="edit-photo-url"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-photo-caption">Caption</Label>
                        <Input
                            id="edit-photo-caption"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-photo-location">Location</Label>
                        <Input
                            id="edit-photo-location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
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
