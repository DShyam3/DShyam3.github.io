import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';
import { useArticles } from '@/hooks/useArticles';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ExternalLink, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArticleCategory, Article } from '@/types/articles';
import { cn } from '@/lib/utils';
import { CardDetailDialog, DetailSection } from '@/components/cards/CardDetailDialog';

const Articles = () => {
  const { isAdmin } = useAuth();
  const { articles, addArticle, removeArticle, loading, categories, activeCategory, setActiveCategory, getCategoryCount } = useArticles();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>('articles');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addArticle({ title: title.trim(), author: author.trim() || undefined, link: link.trim() || undefined, image_url: imageUrl.trim() || undefined, notes: notes.trim() || undefined, category });
    setTitle(''); setAuthor(''); setLink(''); setImageUrl(''); setNotes(''); setCategory('articles'); setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Articles & Publications" subtitle="What I've been reading" />

        <div className="flex flex-wrap justify-center gap-2 px-4 md:px-0 mt-4 mb-6">
          {categories.map((cat) => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key as ArticleCategory)} className={cn('px-3 py-1.5 text-sm rounded-full transition-colors', activeCategory === cat.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {cat.label} ({getCategoryCount(cat.key as ArticleCategory)})
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${articles.length} articles`}</p>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Article</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle className="font-serif">Add Article</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="title">Title *</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="author">Author</Label><Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Type</Label>
                    <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="articles">Article</SelectItem><SelectItem value="publications">Publication</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="link">Link</Label><Input id="link" value={link} onChange={(e) => setLink(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="imageUrl">Image URL</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="notes">What I liked about it</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
                  <Button type="submit" className="w-full">Add Article</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="px-4 md:px-0 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {loading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />) :
            articles.length === 0 ? <p className="col-span-full text-center py-16 text-muted-foreground">No articles yet</p> :
              articles.map((a) => <ArticleCard key={a.id} article={a} onRemove={isAdmin ? removeArticle : undefined} />)}
        </div>

        <Footer />
      </div>
    </div>
  );
};

// Article Card Component
function ArticleCard({ article: a, onRemove }: {
  article: Article;
  onRemove?: (id: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div className="item-card group relative flex flex-col cursor-pointer" onClick={() => setDetailOpen(true)}>
        {a.image_url ?
          <img src={a.image_url} alt={a.title} className="w-full h-40 object-cover rounded-t-lg" /> :
          <div className="w-full h-40 bg-muted rounded-t-lg flex items-center justify-center"><FileText className="h-10 w-10 text-muted-foreground/30" /></div>
        }
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium line-clamp-2">{a.title}</h3>
              {a.author && <p className="text-sm text-muted-foreground mt-1">by {a.author}</p>}
            </div>
            {onRemove && <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onRemove(a.id); }}><Trash2 className="h-4 w-4" /></Button>}
          </div>
          {a.notes && <p className="text-sm text-muted-foreground line-clamp-3 mb-2 flex-1">{a.notes}</p>}
        </div>
      </div>

      <CardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={a.title}
        subtitle={a.author ? `by ${a.author}` : undefined}
        imageUrl={a.image_url}
        link={a.link}
        badge={a.category === 'publications' ? 'Publication' : 'Article'}
      >
        {a.notes && (
          <DetailSection label="Notes">
            <p className="whitespace-pre-wrap">{a.notes}</p>
          </DetailSection>
        )}
      </CardDetailDialog>
    </>
  );
}

export default Articles;