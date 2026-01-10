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
import { Belief } from '@/types/beliefs';
import { toast } from 'sonner';

interface EditBeliefDialogProps {
    belief: Belief;
    onUpdate: (id: string, updates: Partial<Omit<Belief, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditBeliefDialog({ belief, onUpdate, trigger }: EditBeliefDialogProps) {
    const [open, setOpen] = useState(false);
    const [quote, setQuote] = useState(belief.quote);
    const [author, setAuthor] = useState(belief.author || '');

    useEffect(() => {
        if (open) {
            setQuote(belief.quote);
            setAuthor(belief.author || '');
        }
    }, [open, belief]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!quote) {
            toast.error('Please fill in required fields');
            return;
        }

        onUpdate(belief.id, {
            quote,
            author: author || undefined,
        });

        toast.success('Belief updated');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Edit Belief</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-belief-quote">Belief *</Label>
                        <Textarea
                            id="edit-belief-quote"
                            value={quote}
                            onChange={(e) => setQuote(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-belief-author">Source / Author</Label>
                        <Input
                            id="edit-belief-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
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
