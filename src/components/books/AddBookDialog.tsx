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
import { Book, BookCategory } from '@/types/books';
import { toast } from 'sonner';

interface AddBookDialogProps {
    onAdd: (book: Omit<Book, 'id' | 'created_at'>) => void;
}

export function AddBookDialog({ onAdd }: AddBookDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<Exclude<BookCategory, 'all'>>('future');
    const [coverUrl, setCoverUrl] = useState('');
    const [link, setLink] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title || !author) {
            toast.error('Please fill in required fields');
            return;
        }

        onAdd({
            title,
            author,
            description: description || undefined,
            category,
            cover_url: coverUrl || undefined,
            link: link || undefined,
        });

        toast.success('Book added');
        setOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setTitle('');
        setAuthor('');
        setDescription('');
        setCategory('future');
        setCoverUrl('');
        setLink('');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Book
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Add New Book</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="book-title">Title *</Label>
                        <Input
                            id="book-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="The Great Gatsby"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-author">Author *</Label>
                        <Input
                            id="book-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            placeholder="F. Scott Fitzgerald"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-category">Category</Label>
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
                        <Label htmlFor="book-description">Description</Label>
                        <Textarea
                            id="book-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this book about?"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-cover">Cover Image URL</Label>
                        <Input
                            id="book-cover"
                            type="url"
                            value={coverUrl}
                            onChange={(e) => setCoverUrl(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="book-link">Purchase/Info Link</Label>
                        <Input
                            id="book-link"
                            type="url"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            Add Book
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
