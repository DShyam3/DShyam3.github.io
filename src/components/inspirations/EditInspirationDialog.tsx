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
import { Inspiration, InspirationCategory } from '@/types/inspirations';
import { toast } from 'sonner';

interface EditInspirationDialogProps {
    inspiration: Inspiration;
    onUpdate: (id: string, updates: Partial<Omit<Inspiration, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditInspirationDialog({ inspiration, onUpdate, trigger }: EditInspirationDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(inspiration.name);
    const [category, setCategory] = useState<Exclude<InspirationCategory, 'all'>>(inspiration.category as Exclude<InspirationCategory, 'all'>);
    const [imageUrl, setImageUrl] = useState(inspiration.image_url || '');
    const [link, setLink] = useState(inspiration.link || '');
    const [whyILike, setWhyILike] = useState(inspiration.why_i_like || '');
    const [description, setDescription] = useState(inspiration.description || '');

    useEffect(() => {
        if (open) {
            setName(inspiration.name);
            setCategory(inspiration.category as Exclude<InspirationCategory, 'all'>);
            setImageUrl(inspiration.image_url || '');
            setLink(inspiration.link || '');
            setWhyILike(inspiration.why_i_like || '');
            setDescription(inspiration.description || '');
        }
    }, [open, inspiration]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name) {
            toast.error('Please fill in required fields');
            return;
        }

        onUpdate(inspiration.id, {
            name,
            category,
            image_url: imageUrl || undefined,
            link: link || undefined,
            why_i_like: whyILike || undefined,
            description: description || undefined,
        });

        toast.success('Inspiration updated');
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
                    <DialogTitle className="font-serif text-xl">Edit Inspiration</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-name">Name *</Label>
                        <Input
                            id="edit-inspiration-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-category">Category</Label>
                        <Select value={category} onValueChange={(v) => setCategory(v as Exclude<InspirationCategory, 'all'>)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                                <SelectItem value="thinkers">Thinkers</SelectItem>
                                <SelectItem value="creators">Creators</SelectItem>
                                <SelectItem value="artists-painters">Artists / Painters</SelectItem>
                                <SelectItem value="photographers">Photographers</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-image">Image URL</Label>
                        <Input
                            id="edit-inspiration-image"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-link">Link</Label>
                        <Input
                            id="edit-inspiration-link"
                            type="url"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-why">Why I like them</Label>
                        <Textarea
                            id="edit-inspiration-why"
                            value={whyILike}
                            onChange={(e) => setWhyILike(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-inspiration-notes">Additional notes</Label>
                        <Textarea
                            id="edit-inspiration-notes"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
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
