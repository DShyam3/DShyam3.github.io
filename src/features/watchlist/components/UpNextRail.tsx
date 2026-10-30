import { Tv } from 'lucide-react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { UpNextRailItem } from '@/features/watchlist/useUpNext';
import { providerSearchUrl } from '@/features/watchlist/provider-links';
import { SectionFailure } from './SectionFailure';

interface UpNextRailProps {
  items: UpNextRailItem[];
  onSelect: (tvShowId: number) => void;
  plannedDays?: Record<string, string>;
  /** The view could not be read: say so rather than hide the rail. */
  failed?: boolean;
}

/** Details and provider links are separate controls, usable by touch or keyboard. */
export function UpNextRail({ items, onSelect, plannedDays, failed }: UpNextRailProps) {
  if (!items.length) {
    return (
      <section className="news-pane news-pane-watch-next min-w-0 space-y-3" tabIndex={0} role="region" aria-label="Watch next">
        <div className="news-pane-heading"><DotMatrixText text="WATCH NEXT" size="xs" /></div>
        {failed ? <SectionFailure>Could not load what to watch next</SectionFailure> : <p className="text-sm text-muted-foreground">Nothing to watch next</p>}
      </section>
    );
  }
  return (
    <section className="news-pane news-pane-watch-next min-w-0 space-y-3" tabIndex={0} role="region" aria-label="Watch next">
      <div className="news-pane-heading"><DotMatrixText text="WATCH NEXT" size="xs" /></div>
      {/* Cached rows stay up; without this an episode just marked watched
          would still lead the rail with no sign the list is old. */}
      {failed && <SectionFailure>Could not refresh — showing the list from the last load</SectionFailure>}
      <div className="content-rail flex gap-4 p-1 pb-3" role="region" aria-label="Watch next titles">
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
