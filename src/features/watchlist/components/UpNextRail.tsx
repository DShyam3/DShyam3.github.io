import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { UpNextRailItem } from '@/features/watchlist/useUpNext';
import { providerSearchUrl } from '@/features/watchlist/provider-links';

interface UpNextRailProps {
  items: UpNextRailItem[];
  onSelect: (tvShowId: number) => void;
  plannedDays?: Record<string, string>;
}

/** Details and provider links are separate controls, usable by touch or keyboard. */
export function UpNextRail({ items, onSelect, plannedDays }: UpNextRailProps) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const el = rail.current;
    if (el) setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  };
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [items.length]);
  if (!items.length) return null;
  const scroll = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8, behavior: 'auto' });
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <DotMatrixText text="WATCH NEXT" size="xs" />
        {(edges.left || edges.right) && <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Previous watch next titles" disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="More watch next titles" disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight /></Button>
        </div>}
      </div>
      <div ref={rail} onScroll={measure} className="content-rail flex gap-4 overflow-x-auto p-1 pb-3" tabIndex={0} role="region" aria-label="Watch next titles, scroll horizontally for more">
        {items.map(item => {
          const url = providerSearchUrl(item.platform, item.title);
          return <article key={item.tv_show_id} className="item-card min-w-[16rem] max-w-[20rem] flex-1 basis-0 flex flex-col">
            <button type="button" onClick={() => onSelect(item.tv_show_id)} aria-label={`${item.title} — open details`} className="flex flex-1 items-center gap-3 p-3 text-left rounded-t-2xl">
              <span className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded bg-muted">
                {item.poster ? <img src={item.poster} alt="" className="h-full w-full object-contain" loading="lazy" /> : <span className="missing-art flex h-full items-center justify-center"><Tv /></span>}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium leading-snug">{item.title}</span>
                <span className="block text-xs text-muted-foreground">S{item.season_number}E{item.episode_number}{item.episode_title && ` · ${item.episode_title}`}</span>
                {plannedDays?.[String(item.tv_show_id)] && <span className="block text-xs text-primary">Planned for {plannedDays[String(item.tv_show_id)]}</span>}
              </span>
            </button>
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center border-t px-3 py-2 text-sm text-primary underline underline-offset-4">Watch on {item.platform}</a>}
          </article>;
        })}
      </div>
    </section>
  );
}
