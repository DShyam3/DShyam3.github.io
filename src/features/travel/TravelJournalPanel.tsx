import { useId, useState } from 'react';
import { Camera, ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { safeHref } from '@/lib/safe-url';
import { citySummary } from './journal-summary';
import { useTravelPhoto } from './journal-media';
import { TravelJournalEditor, type JournalEdit } from './TravelJournalEditor';
import type { CityIdentity, TravelMemory, TravelVisit } from './journal-types';
import type { JournalController } from './useTravelJournal';

interface Props { city: CityIdentity; journal: JournalController; isAdmin: boolean; legacyVisited: boolean }

function Photo({ memory, onOpen }: { memory: TravelMemory; onOpen: () => void }) {
  const { url, loading } = useTravelPhoto(memory.photo_path);
  return <button type="button" onClick={onOpen} className="w-full overflow-hidden rounded-xl border border-border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open photo: ${memory.title}`}>
    {url ? <img src={url} alt={memory.title} loading="lazy" className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center gap-2 text-xs text-muted-foreground"><Camera className="h-4 w-4" />{loading ? 'Loading photo…' : 'Photo unavailable'}</span>}
    <span className="block p-2 text-xs break-words">{memory.title}</span>
  </button>;
}

function PhotoView({ memory, onClose }: { memory: TravelMemory; onClose: () => void }) {
  const { url, loading } = useTravelPhoto(memory.photo_path);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{memory.title}</DialogTitle><DialogDescription>{memory.city_name}{memory.body ? ` · ${memory.body}` : ''}</DialogDescription></DialogHeader>{url ? <img src={url} alt={memory.title} className="max-h-[65dvh] w-full object-contain rounded-xl" /> : <p>{loading ? 'Loading photo…' : 'This photo could not be loaded.'}</p>}</DialogContent></Dialog>;
}

export function TravelJournalPanel({ city, journal, isAdmin, legacyVisited }: Props) {
  const id = useId();
  const [tab, setTab] = useState('Overview');
  const [edit, setEdit] = useState<JournalEdit | null>(null);
  const [photo, setPhoto] = useState<TravelMemory | null>(null);
  const [visitFilter, setVisitFilter] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [error, setError] = useState('');
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const visits = journal.data.visits.filter(visit => visit.city_key === city.city_key).sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  const memories = journal.data.memories.filter(memory => memory.city_key === city.city_key).sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
  const summary = citySummary(journal.data.visits, city.city_key, journal.data.trips);
  const favourites = memories.filter(memory => memory.kind === 'favourite');
  const photos = memories.filter(memory => memory.kind === 'photo');
  const notes = memories.filter(memory => memory.kind === 'note');
  const cover = photos.find(memory => memory.is_cover);
  const selectedPhotos = photos.filter(memory => (!visitFilter || memory.visit_id === visitFilter) && (!tripFilter || memory.trip_id === tripFilter));

  function removeMemory(memory: TravelMemory) {
    askDelete({ name: memory.title, description: 'Remove this memory from the journal? Its image file stays in private storage but is no longer included in backups.', onConfirm: async () => { try { await journal.remove('memories', memory); } catch { setError('Could not remove this memory. Please try again.'); } } });
  }
  function removeVisit(visit: TravelVisit) {
    askDelete({ name: `${city.city_name} visit`, description: 'Remove this visit? Detach its linked memories first; they are never deleted automatically.', onConfirm: async () => { try { await journal.remove('visits', visit); } catch { setError('Could not remove this visit. Check for linked memories, then try again.'); } } });
  }

  const memoryItem = (memory: TravelMemory) => {
    const external = safeHref(memory.link_url);
    const local = memory.link_url && /^\/(?!\/)[^\s\\]*$/.test(memory.link_url) ? memory.link_url : undefined;
    const link = local ?? external;
    return <article key={memory.id} className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="text-sm font-medium break-words">{memory.title}</h3>{memory.category && <p className="text-xs text-muted-foreground">{memory.category}</p>}</div>{isAdmin && <span className="text-xs text-muted-foreground">{memory.is_public ? 'Published' : 'Private'}</span>}</div>
      {memory.body && <p className="text-sm whitespace-pre-wrap break-words">{memory.body}</p>}
      {link && <a href={link} target={local ? undefined : '_blank'} rel={local ? undefined : 'noopener noreferrer'} className="inline-flex items-center gap-1 text-xs underline underline-offset-4">Related place or memory <ExternalLink className="h-3 w-3" /></a>}
      {memory.visit_id && <p className="text-xs text-muted-foreground">Visit: {visits.find(visit => visit.id === memory.visit_id)?.start_date ?? 'Dates not recorded'}</p>}
      {isAdmin && <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => setEdit({ table: 'memories', row: memory, city })}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => removeMemory(memory)} aria-label={`Delete ${memory.title}`}><Trash2 className="h-3 w-3" /></Button></div>}
    </article>;
  };

  return <div className="space-y-4">
    <header className="space-y-2"><p className="readout-label text-primary">City journal · {city.country_code}</p><h2 className="text-xl font-semibold">{city.city_name}</h2><p className="text-sm text-muted-foreground">{summary.count === 0 && legacyVisited ? 'Visited · dates not recorded' : `${summary.count} recorded ${summary.count === 1 ? 'visit' : 'visits'}`}</p>{summary.first && <p className="text-xs text-muted-foreground">First recorded: {summary.first} · Latest: {summary.last ?? summary.first}</p>}<p className="text-xs text-muted-foreground">Earlier travel may be undated. This is a record of confirmed visits, not a lifetime total.</p></header>
    {journal.loading && <p role="status" className="text-sm text-muted-foreground">Loading your journal…</p>}
    {journal.error ? <div role="alert" className="space-y-2 text-sm"><p>Could not load the travel journal.</p><Button variant="outline" size="sm" onClick={() => { void journal.refresh(); }}>Try again</Button></div> : null}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="City journal sections">{['Overview', 'Visits', 'Favourites', 'Photos'].map((value, index, tabs) => <Button key={value} id={`${id}-${value}`} aria-controls={`${id}-panel`} role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} variant={tab === value ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab(value)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined; if (next !== undefined) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`${id}-${tabs[next]}`)?.focus(); } }}>{value}</Button>)}</div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="space-y-3">
      {tab === 'Overview' && <>
        {cover && <Photo memory={cover} onOpen={() => setPhoto(cover)} />}
        {notes.length > 0 ? notes.map(memoryItem) : <p className="text-sm text-muted-foreground">No city memories recorded yet.</p>}
        {isAdmin && <Button size="sm" variant="outline" disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'memories', city, kind: 'note' })}><Plus className="mr-1 h-3 w-3" />Add a memory</Button>}
        {favourites.length > 0 && <><h3 className="readout-label pt-2">Favourite places</h3>{favourites.slice(0, 3).map(memoryItem)}</>}
        {photos.length > 0 && <><h3 className="readout-label pt-2">Moments here</h3><div className="grid grid-cols-2 gap-2">{photos.slice(0, 4).map(memory => <Photo key={memory.id} memory={memory} onOpen={() => { setTab('Photos'); setPhoto(memory); }} />)}</div></>}
      </>}
      {tab === 'Visits' && <>
        {isAdmin && <Button size="sm" variant="outline" disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'visits', city })}><Plus className="mr-1 h-3 w-3" />Add visit</Button>}
        {visits.length === 0 && <p className="text-sm text-muted-foreground">Dates not recorded. Add a stay or day visit when you know it; airport connections do not count.</p>}
        {visits.map(visit => <article key={visit.id} className="space-y-2 rounded-xl border border-border/60 p-3"><div className="flex items-center gap-2"><MapPin className="h-3 w-3 shrink-0" /><h3 className="text-sm font-medium">{visit.start_date ?? 'Dates not recorded'}{visit.end_date && visit.end_date !== visit.start_date ? ` – ${visit.end_date}` : ''}</h3></div><p className="text-xs text-muted-foreground">{visit.status}{isAdmin ? ` · ${visit.is_public ? 'Published' : 'Private'}` : ''}</p>{visit.trip_id && <p className="text-xs">{journal.data.trips.find(trip => trip.id === visit.trip_id)?.title ?? 'Linked trip'}</p>}{visit.notes && <p className="text-sm whitespace-pre-wrap break-words">{visit.notes}</p>}{isAdmin && <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => setEdit({ table: 'visits', row: visit, city })}>Edit</Button><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => removeVisit(visit)} aria-label={`Delete visit ${visit.start_date ?? 'without dates'}`}><Trash2 className="h-3 w-3" /></Button></div>}</article>)}
      </>}
      {tab === 'Favourites' && <>{isAdmin && <Button size="sm" variant="outline" disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'memories', city, kind: 'favourite' })}><Plus className="mr-1 h-3 w-3" />Add favourite</Button>}{favourites.length > 0 ? favourites.map(memoryItem) : <p className="text-sm text-muted-foreground">Save the places and experiences you would come back for.</p>}</>}
      {tab === 'Photos' && <>
        {isAdmin && <Button size="sm" variant="outline" disabled={journal.busy || Boolean(journal.error)} onClick={() => setEdit({ table: 'memories', city, kind: 'photo' })}><Camera className="mr-1 h-3 w-3" />Add photo</Button>}
        {journal.data.trips.some(trip => photos.some(memory => memory.trip_id === trip.id)) && <label className="block space-y-2 text-xs">Filter album by trip<select className="h-9 w-full rounded-md border border-input bg-background px-2" value={tripFilter} onChange={event => setTripFilter(event.target.value)}><option value="">All trips</option>{journal.data.trips.filter(trip => photos.some(memory => memory.trip_id === trip.id)).map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>}
        {visits.length > 0 && <label className="block space-y-2 text-xs">Filter album by visit<select className="h-9 w-full rounded-md border border-input bg-background px-2" value={visitFilter} onChange={event => setVisitFilter(event.target.value)}><option value="">All visits</option>{visits.map(visit => <option key={visit.id} value={visit.id}>{visit.start_date ?? 'Dates not recorded'} · {visit.status}</option>)}</select></label>}
        {selectedPhotos.length === 0 && <p className="text-sm text-muted-foreground">No photos in this album yet.</p>}
        <div className="grid grid-cols-2 gap-2">{selectedPhotos.map(memory => <div key={memory.id} className="space-y-1"><Photo memory={memory} onOpen={() => setPhoto(memory)} />{isAdmin && <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => setEdit({ table: 'memories', row: memory, city })}>Edit</Button><Button size="sm" variant="ghost" disabled={journal.busy} onClick={() => removeMemory(memory)} aria-label={`Delete ${memory.title}`}><Trash2 className="h-3 w-3" /></Button></div>}</div>)}</div>
      </>}
    </div>
    {edit && isAdmin && <TravelJournalEditor key={`${edit.table}-${edit.row?.id ?? ('kind' in edit ? edit.kind : 'new')}`} edit={edit} journal={journal} cities={[city]} onClose={() => setEdit(null)} />}
    {photo && photos.some(memory => memory.id === photo.id) && <PhotoView memory={photo} onClose={() => setPhoto(null)} />}
    {isAdmin && deleteDialog}
  </div>;
}
