import { useId } from 'react';
import { BedDouble, ChevronDown, Plane, Ticket, TrainFront } from 'lucide-react';
import { formatDayMonth } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { groupByYear } from './journal-flights';
import type { TravelItinerary } from './journal-types';

const kindIcon = { flight: Plane, train: TrainFront, stay: BedDouble, activity: Ticket } as const;
const kindLabel = { flight: 'Flight', train: 'Train', stay: 'Stay', activity: 'Activity' } as const;

interface RowsProps {
  items: TravelItinerary[];
  selectedId: string | null;
  onSelect: (item: TravelItinerary) => void;
  /** Under a year heading the year is already said, so rows drop it. */
  withYear?: boolean;
}

/** One line per item; the selected item's detail opens in the inspector. */
export function ItineraryRows({ items, selectedId, onSelect, withYear = true }: RowsProps) {
  return <ul className="space-y-0.5">{items.map(item => {
    const Icon = kindIcon[item.kind];
    const selected = item.id === selectedId;
    return <li key={item.id}>
      <button type="button" aria-current={selected ? 'true' : undefined} onClick={() => onSelect(item)}
        className={cn('grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'bg-accent')}>
        <span className={cn('text-xs tabular-nums text-muted-foreground', withYear ? 'w-24' : 'w-14')}>{formatDayMonth(item.start_date, { withYear }) || 'No date'}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /><span className="sr-only">{kindLabel[item.kind]}</span>
        <span className={cn('truncate', item.status === 'cancelled' && 'text-muted-foreground line-through')}>{item.title}</span>
        {item.status !== 'completed' && <span className="text-xs text-muted-foreground">{item.status === 'planned' ? 'Planned' : 'Cancelled'}</span>}
      </button>
    </li>;
  })}</ul>;
}

interface LogProps extends Omit<RowsProps, 'withYear'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A long history folded to one line, opening into rows grouped by year, oldest first. */
export function ItineraryLog({ items, selectedId, onSelect, open, onOpenChange }: LogProps) {
  const id = useId();
  const groups = groupByYear(items);
  const years = groups.map(group => group.year).filter(year => year !== 'Undated');
  const span = years.length === 0 ? '' : years[0] === years[years.length - 1] ? ` · ${years[0]}` : ` · ${years[0]}–${years[years.length - 1]}`;
  const noun = items.every(item => item.kind === 'flight') ? 'flight' : 'item';
  return <div className="rounded-xl border border-border/60 bg-card">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}
      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span>{items.length} {noun}{items.length === 1 ? '' : 's'}{span}</span>
      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
    </button>
    {/* Groups, not sections: a decade of years would otherwise be a decade of landmarks. */}
    {open && <div id={id} className="space-y-3 border-t border-border/60 p-1.5">{groups.map(group => <div key={group.year} role="group" aria-labelledby={`${id}-${group.year}`}>
      <h4 id={`${id}-${group.year}`} className="readout-label px-2 pb-1 pt-2">{group.year} · {group.items.length}</h4>
      <ItineraryRows items={group.items} selectedId={selectedId} onSelect={onSelect} withYear={group.year === 'Undated'} />
    </div>)}</div>}
  </div>;
}
