import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, Loader2, Book as BookIcon } from 'lucide-react';
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
import { useGoogleBooks } from '@/hooks/useGoogleBooks';
import { cn } from '@/lib/utils';

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

    const [searchTerm, setSearchTerm] = useState('');
    const [showResults, setShowResults] = useState(false);
    const { results: searchResults, loading: searchLoading, search } = useGoogleBooks();
    const searchRef = useRef<HTMLDivElement>(null);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.trim().length >= 2) {
            setShowResults(true);
            search(value);
        } else {
            setShowResults(false);
        }
    };

    const handleSelectBook = (book: any) => {
        const info = book.volumeInfo;
        setTitle(info.title || '');
        setAuthor(info.authors?.join(', ') || '');
        setDescription(info.description || '');
        setCoverUrl(info.imageLinks?.thumbnail?.replace('http:', 'https:') || '');
        setLink(info.infoLink || info.previewLink || '');
        setShowResults(false);
        setSearchTerm('');
        toast.info(`Selected "${info.title}"`);
    };

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
        setSearchTerm('');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Book
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl border-b pb-2">Add New Book</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Search Section */}
                    <div className="space-y-2 relative" ref={searchRef}>
                        <Label htmlFor="book-search" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <Search className="w-3.5 h-3.5" />
                            Search Google Books
                        </Label>
                        <div className="relative">
                            <Input
                                id="book-search"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)}
                                placeholder="Search by title, author, or ISBN..."
                                className="pr-10 bg-secondary/30 border-transparent focus:border-border transition-[border-color,background-color] duration-200"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {searchLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <BookIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && (searchTerm.trim().length >= 2) && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {searchLoading ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Searching...
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {searchResults.map((book: any) => (
                                            <button
                                                key={book.id}
                                                type="button"
                                                onClick={() => handleSelectBook(book)}
                                                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted border-b last:border-0 transition-colors"
                                            >
                                                <div className="w-10 h-14 bg-secondary/50 flex-shrink-0 rounded overflow-hidden shadow-sm">
                                                    {book.volumeInfo.imageLinks?.smallThumbnail ? (
                                                        <img 
                                                            src={book.volumeInfo.imageLinks.smallThumbnail.replace('http:', 'https:')} 
                                                            alt="" 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <BookIcon className="w-4 h-4 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium leading-tight line-clamp-1">{book.volumeInfo.title}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                        {book.volumeInfo.authors?.join(', ') || 'Unknown Author'}
                                                    </p>
                                                    {book.volumeInfo.publishedDate && (
                                                        <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase">
                                                            {book.volumeInfo.publishedDate.split('-')[0]}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        No books found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-dashed" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or Enter Details Manually</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="book-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title *</Label>
                                <Input
                                    id="book-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="The Great Gatsby"
                                    className="bg-secondary/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="book-author" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Author *</Label>
                                <Input
                                    id="book-author"
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                    placeholder="F. Scott Fitzgerald"
                                    className="bg-secondary/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="book-category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as Exclude<BookCategory, 'all'>)}>
                                <SelectTrigger className="bg-secondary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="reading">Reading</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="wishlist">To Read</SelectItem>
                                    <SelectItem value="favourite">Favourite</SelectItem>
                                    <SelectItem value="future">Reference</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="book-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
                            <Textarea
                                id="book-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this book about?"
                                rows={3}
                                className="bg-secondary/20 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="book-cover" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Image URL</Label>
                                <Input
                                    id="book-cover"
                                    type="url"
                                    value={coverUrl}
                                    onChange={(e) => setCoverUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="bg-secondary/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="book-link" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Info Link</Label>
                                <Input
                                    id="book-link"
                                    type="url"
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    placeholder="https://..."
                                    className="bg-secondary/20"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1">
                                Add to Library
                            </Button>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
