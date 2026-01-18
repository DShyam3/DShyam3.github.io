import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';
import { useBeliefs } from '@/hooks/useBeliefs';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Quote as QuoteIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EditBeliefDialog } from '@/components/beliefs/EditBeliefDialog';
import { Navigate } from 'react-router-dom';

const Beliefs = () => {
  const { isAdmin } = useAuth();
  const { beliefs, addBelief, removeBelief, updateBelief, loading } = useBeliefs();
  const [open, setOpen] = useState(false);
  const [belief, setBelief] = useState('');
  const [author, setAuthor] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!belief.trim()) return;
    addBelief({ quote: belief.trim(), author: author.trim() || undefined });
    setBelief(''); setAuthor(''); setOpen(false);
  };

  // Redirect to home if not logged in
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Beliefs" subtitle="Principles I live by" />

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">{loading ? '...' : `${beliefs.length} beliefs`}</p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Belief</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle className="font-serif">Add a Belief</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="belief">Belief *</Label><Textarea id="belief" value={belief} onChange={(e) => setBelief(e.target.value)} required rows={3} /></div>
                <div className="space-y-2"><Label htmlFor="author">Source / Author</Label><Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
                <Button type="submit" className="w-full">Add Belief</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="px-4 md:px-0 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />) :
            beliefs.length === 0 ? <p className="col-span-full text-center py-16 text-muted-foreground">No beliefs yet</p> :
              beliefs.map((b) => (
                <div key={b.id} className="item-card p-6 group relative">
                  <QuoteIcon className="h-6 w-6 text-muted-foreground/20 absolute top-4 left-4" />
                  <p className="text-base font-serif italic pl-8 line-clamp-4">"{b.quote}"</p>
                  {b.author && <p className="text-sm text-muted-foreground mt-2 pl-8">— {b.author}</p>}
                  <div className="flex items-center justify-end gap-1 mt-4 pl-8">
                    <EditBeliefDialog belief={b} onUpdate={updateBelief} />
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => removeBelief(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Beliefs;