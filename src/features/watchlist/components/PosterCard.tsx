import { useState, type ReactNode, type Ref } from 'react';
import { Calendar, Film } from 'lucide-react';

/** Shared poster anatomy keeps every row's metadata and action baseline aligned. */
export function PosterCard({ title, poster, subtitle, meta, actions, scheduled, onSchedule, onOpen, cardRef }: {
  title: string;
  poster?: string | null;
  subtitle: ReactNode;
  meta: ReactNode;
  actions?: ReactNode;
  scheduled?: boolean;
  onSchedule?: () => void;
  onOpen: () => void;
  cardRef?: Ref<HTMLButtonElement>;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <article className="item-card watchlist-poster-card group relative flex h-full min-w-0 flex-col text-left">
      <div className="relative">
        <button ref={cardRef} type="button" onClick={onOpen} aria-label={`${title} — open details`} className="block w-full overflow-hidden rounded-t-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <div className="aspect-[2/3] overflow-hidden bg-muted">
            {poster && poster !== failed ? <img src={poster} alt={title} loading="lazy" onError={() => setFailed(poster)} className="h-full w-full object-contain" /> : <div className="missing-art flex h-full flex-col items-center justify-center gap-3 p-4"><Film className="h-6 w-6" /><span className="text-xs">No poster available</span></div>}
          </div>
        </button>
        {actions}
      </div>
      <div className="card-body flex flex-1 flex-col gap-1.5">
        <button type="button" onClick={onOpen} className="card-title flex items-start text-left font-medium leading-snug" title={title} aria-label={`${title} — open details`}><span className="line-clamp-2">{title}</span></button>
        <div className="card-sub text-xs text-muted-foreground">{subtitle}</div>
        <div className="card-meta mt-auto grid gap-1">{meta}</div>
      </div>
      {onSchedule && <button type="button" onClick={onSchedule} className="schedule-action flex min-h-11 w-full shrink-0 items-center justify-center gap-2 border-t px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10" aria-label={`${scheduled ? 'Remove' : 'Add'} ${title} ${scheduled ? 'from' : 'to'} schedule`}><Calendar className="h-4 w-4 shrink-0" /><span>{scheduled ? 'Scheduled · remove' : 'Add to schedule'}</span></button>}
    </article>
  );
}
