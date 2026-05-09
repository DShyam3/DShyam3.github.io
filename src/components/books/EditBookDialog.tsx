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
import { Book, BookCategory } from '@/types/books';
import { toast } from 'sonner';

interface EditBookDialogProps {
    book: Book;
    onUpdate: (id: string, updates: Partial<Omit<Book, 'id' | 'created_at'>>) => void;
}

export function EditBookDialog({ book, onUpdate }: EditBookDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(book.title);
    const [author, setAuthor] = useState(book.author);
    const [description, setDescription] = useState(book.description || '');
    const [category, setCategory] = useState<Exclude<BookCategory, 'all'>>(book.category);
    const [coverUrl, setCoverUrl] = useState(book.cover_url || '');
    const [link, setLink] = useState(book.link || '');

    useEffect(() => {
        if (open) {
            setTitle(book.title);
            setAuthor(book.author);
            setDescription(book.description || '');
            setCategory(book.category);
            setCoverUrl(book.cover_url || '');
            setLink(book.link || '');
        }
    }, [open, book]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title || !author) {
            toast.error('Please fill in required fields');
            return;
        }

        onUpdate(book.id, {
            title,
            author,
            description: description || undefined,
            category,
            cover_url: coverUrl || undefined,
            link: link || undefined,
        });

        toast.success('Book updated');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Edit Book</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-book-title">Title *</Label>
                        <Input
                            id="edit-book-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-book-author">Author *</Label>
                        <Input
                            id="edit-book-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-book-category">Category</Label>
                        <Select value={category} onValueChange={(v) => setCategory(v as Exclude<BookCategory, 'all'>)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="favourite">Favourite</SelectItem>
                                <SelectItem value="future">To Read</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-book-description">Description</Label>
                        <Textarea
                            id="edit-book-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-book-cover">Cover Image URL</Label>
                        <Input
                            id="edit-book-cover"
                            type="url"
                            value={coverUrl}
                            onChange={(e) => setCoverUrl(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-book-link">Purchase/Info Link</Label>
                        <Input
                            id="edit-book-link"
                            type="url"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
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
