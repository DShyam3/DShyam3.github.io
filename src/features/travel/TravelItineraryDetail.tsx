import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { formatDate } from '@/lib/format-date';
import { TravelJournalEditor } from './TravelJournalEditor';
import { airportCountry, countryName, type AirportCountries } from './journal-flights';
import type { TravelItinerary } from './journal-types';
import type { JournalController } from './useTravelJournal';

interface Props {
  item: TravelItinerary;
  journal: JournalController;
  isAdmin: boolean;
  airports: AirportCountries | null;
  onDeleted: () => void;
}

const statusLabel = { planned: 'Planned / unconfirmed', completed: 'Completed', cancelled: 'Cancelled' } as const;

function moment(date: string | null, time: string | null, zone: string | null): string {
  if (!date && !time) return 'Not recorded';
  return [date ? formatDate(date) || date : 'Date not recorded', time, zone ?? (time ? 'local time' : null)].filter(Boolean).join(' · ');
}

/** An itinerary item in the inspector: what the compact list leaves out, and its edit and delete. */
export function TravelItineraryDetail({ item, journal, isAdmin, airports, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const trip = journal.data.trips.find(candidate => candidate.id === item.trip_id);
  const place = (value: string | null) => {
    if (!value) return 'Not recorded';
    // Only a flight's ends are airport codes; a stay's location is a place name.
    const country = item.kind === 'flight' ? airportCountry(value, airports) : null;
    return country ? `${value} · ${countryName(country)}` : value;
  };
  const rows: [string, string][] = [
    ['Departs', moment(item.start_date, item.start_time, item.time_zone)],
    ...(item.end_date || item.end_time ? [['Arrives', moment(item.end_date, item.end_time, item.arrival_time_zone)] as [string, string]] : []),
    ...(item.origin || item.destination ? [['From', place(item.origin)], ['To', place(item.destination)]] as [string, string][] : []),
    ['Trip', trip?.title ?? 'Not assigned'],
    ['Status', statusLabel[item.status]],
    ...(isAdmin ? [['Visibility', item.is_public ? 'Published' : 'Private'] as [string, string]] : []),
    ...(isAdmin && item.source_name ? [['Source', item.source_name] as [string, string]] : []),
  ];

  function remove() {
    askDelete({
      name: item.title,
      onConfirm: async () => {
        try { await journal.remove('itinerary', item); onDeleted(); } catch { setError('Could not remove this item. Please try again.'); }
      },
    });
  }

  return <div className="space-y-4">
    {/* The inspector's own header already names the kind. */}
    <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
    <dl className="divide-y divide-border/40 rounded-xl border border-border/50 bg-background/45 px-3 py-1">
      {rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 py-2 text-xs">
        <dt className="shrink-0 text-muted-foreground">{label}</dt>
        <dd className="text-right font-medium">{value}</dd>
      </div>)}
    </dl>
    {item.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
    {item.kind === 'flight' && <p className="text-xs text-muted-foreground">A flight does not record a city visit. Add stays from the city's journal.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {isAdmin && <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={journal.busy} onClick={() => setEditing(true)}><Pencil className="mr-1 h-3 w-3" />{item.trip_id ? 'Edit' : 'Assign to a trip'}</Button>
      <Button size="sm" variant="ghost" disabled={journal.busy} onClick={remove}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
    </div>}
    {editing && isAdmin && <TravelJournalEditor key={`itinerary-${item.id}`} edit={{ table: 'itinerary', row: item }} journal={journal} onClose={() => setEditing(false)} />}
    {isAdmin && deleteDialog}
  </div>;
}
