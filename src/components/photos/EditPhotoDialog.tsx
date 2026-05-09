import { useState, useEffect, useRef } from 'react';
import { Pencil, Upload, Loader2, ImageIcon } from 'lucide-react';
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
import { uploadPhoto, deletePhotoFromStorage } from '@/lib/storage';

interface EditPhotoDialogProps {
    photo: Photo;
    onUpdate: (id: string, updates: Partial<Omit<Photo, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditPhotoDialog({ photo, onUpdate, trigger }: EditPhotoDialogProps) {
    const [open, setOpen] = useState(false);
    const [caption, setCaption] = useState(photo.caption || '');
    const [location, setLocation] = useState(photo.location || '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setCaption(photo.caption || '');
            setLocation(photo.location || '');
            setSelectedFile(null);
            setPreviewUrl(null);
        }
    }, [open, photo]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid file type. Please select a JPEG, PNG, WebP, GIF, or HEIC image.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            toast.error('File too large. Maximum size is 50MB.');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        try {
            const updates: Partial<Omit<Photo, 'id' | 'created_at'>> = {
                caption: caption || undefined,
                location: location || undefined,
            };

            // If a new file was selected, upload it and update the URL
            if (selectedFile) {
                const newUrl = await uploadPhoto(selectedFile);
                // Delete the old image from storage
                await deletePhotoFromStorage(photo.image_url);
                updates.image_url = newUrl;
            }

            onUpdate(photo.id, updates);
            toast.success('Photo updated');
            setOpen(false);
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Failed to update photo');
        } finally {
            setUploading(false);
        }
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
                    {/* Replace Image (optional) */}
                    <div className="space-y-2">
                        <Label>Replace Image (optional)</Label>
                        <div
                            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <div className="space-y-2">
                                    <img src={previewUrl} alt="New preview" className="max-h-32 mx-auto rounded-md object-cover" />
                                    <p className="text-xs text-muted-foreground">Click to change</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <ImageIcon className="h-5 w-5 mx-auto text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Click to select a new image</p>
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
                        <Button type="submit" className="flex-1 gap-2" disabled={uploading}>
                            {uploading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                            ) : (
                                <>Save Changes</>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
