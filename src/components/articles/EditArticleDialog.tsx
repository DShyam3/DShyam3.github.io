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
import { Article, ArticleCategory } from '@/types/articles';
import { toast } from 'sonner';

interface EditArticleDialogProps {
    article: Article;
    onUpdate: (id: string, updates: Partial<Omit<Article, 'id' | 'created_at'>>) => void;
    trigger?: React.ReactNode;
}

export function EditArticleDialog({ article, onUpdate, trigger }: EditArticleDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(article.title);
    const [author, setAuthor] = useState(article.author || '');
    const [notes, setNotes] = useState(article.notes || '');
    const [category, setCategory] = useState<Exclude<ArticleCategory, 'all'>>(article.category as Exclude<ArticleCategory, 'all'>);
    const [imageUrl, setImageUrl] = useState(article.image_url || '');
    const [link, setLink] = useState(article.link || '');

    useEffect(() => {
        if (open) {
            setTitle(article.title);
            setAuthor(article.author || '');
            setNotes(article.notes || '');
            setCategory(article.category as Exclude<ArticleCategory, 'all'>);
            setImageUrl(article.image_url || '');
            setLink(article.link || '');
        }
    }, [open, article]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title) {
            toast.error('Please fill in required fields');
            return;
        }

        onUpdate(article.id, {
            title,
            author: author || undefined,
            notes: notes || undefined,
            category,
            image_url: imageUrl || undefined,
            link: link || undefined,
        });

        toast.success('Article updated');
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
                    <DialogTitle className="font-serif text-xl">Edit Article</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-article-title">Title *</Label>
                        <Input
                            id="edit-article-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-article-author">Author</Label>
                        <Input
                            id="edit-article-author"
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-article-category">Type</Label>
                        <Select value={category} onValueChange={(v) => setCategory(v as Exclude<ArticleCategory, 'all'>)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="articles">Article</SelectItem>
                                <SelectItem value="publications">Publication</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-article-notes">Notes</Label>
                        <Textarea
                            id="edit-article-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-article-image">Image URL</Label>
                        <Input
                            id="edit-article-image"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-article-link">Link</Label>
                        <Input
                            id="edit-article-link"
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
