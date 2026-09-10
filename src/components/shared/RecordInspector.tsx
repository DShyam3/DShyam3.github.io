import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** Contextual details with a native trigger, focus restoration and a scrollable body. */
export function RecordInspector({ title, subtitle, value, palette = 'sky', children, onInspect }: {
  title: string;
  subtitle: string;
  value: string;
  palette?: 'sky' | 'sage' | 'lavender' | 'peach' | 'rose';
  children: ReactNode;
  onInspect?: () => void;
}) {
  return (
    <Dialog onOpenChange={(open) => { if (open) onInspect?.(); }}>
      <DialogTrigger asChild>
        <button type="button" className="ambient-card record-preview group rounded-3xl border p-5 text-left min-w-0 space-y-5" data-palette={palette}>
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block font-medium break-words">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span></span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </span>
          <span className="block text-2xl font-bold tabular-nums break-words">{value}</span>
          <span className="block text-xs text-primary">View details</span>
        </button>
      </DialogTrigger>
      <DialogContent className="record-inspector sm:max-w-xl gap-6 p-6 sm:p-8">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle className="font-serif text-2xl leading-snug break-words">{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="ambient-card rounded-2xl border p-5" data-palette={palette}>
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className="text-3xl font-bold tabular-nums mt-2 break-words">{value}</p>
        </div>
        <div className="space-y-6 min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
