import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { TravelJournalEditor, type JournalEdit } from './TravelJournalEditor';
import { ItineraryLog, ItineraryRows } from './TravelItineraryList';
import type { CityIdentity, TravelItinerary, TravelTrip } from './journal-types';
import { compareItineraryStart } from './journal-summary';
import type { JournalController } from './useTravelJournal';

interface Props {
  journal: JournalController;
  isAdmin: boolean;
  cities?: CityIdentity[];
  onSelectCity?: (city: CityIdentity) => void;
  /** The item whose detail is open in the inspector. */
  selectedItemId: string | null;
  onSelectItem: (item: TravelItinerary) => void;
}

export function TravelJournalWorkspace({ journal, isAdmin, cities = [], onSelectCity, selectedItemId, onSelectItem }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [edit, setEdit] = useState<JournalEdit | null>(null);
  const [error, setError] = useState('');
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { trips, visits, memories, itinerary } = journal.data;
  const trip = trips.find(item => item.id === selectedId);
  const availableCities = useMemo(() => [...new Map([...cities, ...visits, ...memories].map(city => [city.city_key, { country_code: city.country_code, city_key: city.city_key, city_name: city.city_name }])).values()], [cities, visits, memories]);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = trips.filter(item => {
    if (!needle) return true;
    const related = [...visits.filter(visit => visit.trip_id === item.id).flatMap(visit => [visit.city_name, visit.notes]), ...memories.filter(memory => memory.trip_id === item.id).flatMap(memory => [memory.city_name, memory.title, memory.body, memory.category]), ...itinerary.filter(entry => entry.trip_id === item.id).flatMap(entry => [entry.title, entry.origin ?? '', entry.destination ?? '', entry.notes])];
    return [item.title, item.notes, ...related].some(value => value.toLocaleLowerCase().includes(needle));
  }).sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '') || a.title.localeCompare(b.title));
  const tripVisits = visits.filter(visit => visit.trip_id === trip?.id).sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
  const tripItems = itinerary.filter(item => item.trip_id === trip?.id).sort(compareItineraryStart);
  const unassigned = itinerary.filter(item => !item.trip_id && (!needle || [item.title, item.origin, item.destination].some(value => value?.toLocaleLowerCase().includes(needle)))).sort(compareItineraryStart);

  function removeTrip(item: TravelTrip) {
    askDelete({ name: item.title, description: 'Remove this trip? Detach its visits, memories and itinerary items first. They are not deleted automatically.', onConfirm: async () => { try { await journal.remove('trips', item); setSelectedId(null); } catch { setError('Could not remove this trip. Check for linked records, then try again.'); } } });
  }

  return <section className="space-y-5" aria-label="Travel trips and itineraries">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="readout-label text-primary">Travel journal</p><h2 data-travel-heading tabIndex={-1} className="text-xl font-semibold">{trip?.title ?? 'Trips & memories'}</h2></div>{isAdmin && <Button disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'trips' })}><Plus className="mr-2 h-4 w-4" />Add trip</Button>}</div>
    {journal.loading && <p role="status" className="text-sm text-muted-foreground">Loading trips…</p>}
    {journal.error ? <div role="alert" className="space-y-2"><p className="text-sm">Could not load the travel journal.</p><Button size="sm" variant="outline" onClick={() => { void journal.refresh(); }}>Try again</Button></div> : null}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {trip ? <>
      <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}><ArrowLeft className="mr-1 h-3 w-3" />All trips</Button>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4"><p className="text-sm text-muted-foreground">{trip.start_date ?? 'Dates not recorded'}{trip.end_date ? ` – ${trip.end_date}` : ''} · {trip.status}{isAdmin ? ` · ${trip.is_public ? 'Published' : 'Private'}` : ''}</p>{trip.notes && <p className="whitespace-pre-wrap break-words text-sm">{trip.notes}</p>}{isAdmin && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={journal.busy} onClick={() => setEdit({ table: 'trips', row: trip })}>Edit trip</Button><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => removeTrip(trip)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button></div>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="readout-label">City visits</h3>{isAdmin && <Button size="sm" variant="outline" disabled={journal.busy || availableCities.length === 0} onClick={() => setEdit({ table: 'visits', tripId: trip.id })}><MapPin className="mr-1 h-3 w-3" />Add visit</Button>}</div>
      {availableCities.length === 0 && isAdmin && <p className="text-xs text-muted-foreground">Choose a city in Places first, then record its visit here.</p>}
      {tripVisits.length === 0 && <p className="text-sm text-muted-foreground">No city stays recorded. Flights and airport connections do not create visits automatically.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{tripVisits.map(visit => <article key={visit.id} className="rounded-xl border border-border/60 bg-card p-3 space-y-2"><button type="button" onClick={() => onSelectCity?.(visit)} className="text-sm font-medium underline underline-offset-4">{visit.city_name} · {visit.country_code}</button><p className="text-xs text-muted-foreground">{visit.start_date ?? 'Dates not recorded'}{visit.end_date ? ` – ${visit.end_date}` : ''} · {visit.status}</p>{visit.notes && <p className="whitespace-pre-wrap break-words text-sm">{visit.notes}</p>}{isAdmin && <Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => setEdit({ table: 'visits', row: visit, city: visit })}>Edit visit</Button>}</article>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="readout-label">Itinerary</h3>{isAdmin && <Button size="sm" variant="outline" disabled={journal.busy} onClick={() => setEdit({ table: 'itinerary', tripId: trip.id })}><Plus className="mr-1 h-3 w-3" />Add item</Button>}</div>
      {tripItems.length === 0 ? <p className="text-sm text-muted-foreground">Add flights, trains, stays or activities to this trip.</p> : <div className="rounded-xl border border-border/60 bg-card p-1.5"><ItineraryRows items={tripItems} selectedId={selectedItemId} onSelect={onSelectItem} /></div>}
      {memories.some(memory => memory.trip_id === trip.id) && <><h3 className="readout-label">Connected memories</h3><div className="flex flex-wrap gap-2">{memories.filter(memory => memory.trip_id === trip.id).map(memory => <Button key={memory.id} variant="outline" size="sm" onClick={() => onSelectCity?.(memory)}>{memory.title} · {memory.city_name}</Button>)}</div></>}
    </> : <>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search trips, cities and memories" placeholder="Search trips, cities and memories…" value={query} onChange={event => { setQuery(event.target.value); if (event.target.value.trim()) setLogOpen(true); }} className="pl-9" /></div>
      {!journal.loading && !journal.error && filtered.length === 0 && <div className="rounded-2xl border border-border/60 p-6 text-center space-y-2"><CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-sm">{needle ? 'No matching trips.' : 'Your journeys, one trip at a time.'}</p><p className="text-xs text-muted-foreground">{needle ? 'Try a city, favourite place or a word from a memory.' : isAdmin ? 'Start with a trip, then connect city visits and memories.' : 'Published journeys will appear here.'}</p></div>}
      <div className="grid gap-3 sm:grid-cols-2">{filtered.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="readout-label text-primary">{item.status}</span><h3 className="text-lg font-medium break-words">{item.title}</h3><p className="text-xs text-muted-foreground">{item.start_date ?? 'Dates not recorded'}{item.end_date ? ` – ${item.end_date}` : ''}</p>{item.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{item.notes}</p>}{isAdmin && <span className="block text-xs text-muted-foreground">{item.is_public ? 'Published' : 'Private'}</span>}</button>)}</div>
      {(isAdmin || unassigned.length > 0) && <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="readout-label">Unassigned itinerary</h3>{isAdmin && <Button variant="outline" size="sm" disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'itinerary' })}><Plus className="mr-1 h-3 w-3" />Add item</Button>}</div>{isAdmin && <p className="text-xs text-muted-foreground">Imported flights stay here until you attach them to a trip. Select one to see its details, assign or delete it.</p>}{unassigned.length > 0 && <ItineraryLog items={unassigned} selectedId={selectedItemId} onSelect={onSelectItem} open={logOpen} onOpenChange={setLogOpen} />}</div>}
    </>}
    {edit && isAdmin && <TravelJournalEditor key={`${edit.table}-${edit.row?.id ?? 'new'}`} edit={edit} journal={journal} cities={availableCities} onClose={() => setEdit(null)} />}
    {isAdmin && deleteDialog}
  </section>;
}
