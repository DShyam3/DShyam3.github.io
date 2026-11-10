import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { uploadTravelPhoto } from './journal-media';
import type { JournalController } from './useTravelJournal';
import { MAX_SORT_ORDER, MIN_SORT_ORDER, type CityIdentity, TravelItinerary, TravelMemory, TravelTrip, TravelVisit } from './journal-types';

export type JournalEdit =
  | { table: 'trips'; row?: TravelTrip }
  | { table: 'visits'; row?: TravelVisit; city?: CityIdentity; tripId?: string }
  | { table: 'memories'; row?: TravelMemory; city: CityIdentity; kind?: TravelMemory['kind']; tripId?: string }
  | { table: 'itinerary'; row?: TravelItinerary; tripId?: string };

interface Props {
  edit: JournalEdit;
  journal: JournalController;
  cities?: CityIdentity[];
  onClose: () => void;
}

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/** Mounted afresh for each edit, keeping failed saves and uploads in the form. */
export function TravelJournalEditor({ edit, journal, cities = [], onClose }: Props) {
  const id = useId();
  const row = edit.row;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoPath, setPhotoPath] = useState(edit.table === 'memories' ? edit.row?.photo_path ?? null : null);
  const uploadedFile = useRef<File | null>(null);
  const [kind, setKind] = useState(edit.table === 'memories' ? edit.row?.kind ?? edit.kind ?? 'note' : edit.table === 'itinerary' ? edit.row?.kind ?? 'activity' : '');
  const [tripId, setTripId] = useState(edit.table === 'trips' ? '' : edit.row?.trip_id ?? edit.tripId ?? '');
  const [visitId, setVisitId] = useState(edit.table === 'memories' ? edit.row?.visit_id ?? '' : '');
  const initialCity = edit.table === 'visits' || edit.table === 'memories' ? edit.row ?? edit.city : undefined;
  const [cityKey, setCityKey] = useState(initialCity?.city_key ?? cities[0]?.city_key ?? '');
  const cityOptions = [...new Map([...cities, ...(initialCity ? [initialCity] : [])].map(city => [city.city_key, { city_key: city.city_key, city_name: city.city_name, country_code: city.country_code }])).values()];
  const busy = saving || journal.busy;
  const isPhoto = edit.table === 'memories' && kind === 'photo';
  const isFlight = edit.table === 'itinerary' && kind === 'flight';
  const isMemory = edit.table === 'memories';
  const noun = edit.table === 'trips' ? 'trip' : edit.table === 'visits' ? 'visit' : edit.table === 'memories' ? kind : 'itinerary item';
  const selectedVisit = journal.data.visits.find(visit => visit.id === visitId);
  const parentTrip = journal.data.trips.find(trip => trip.id === tripId);
  const parentPrivate = Boolean((parentTrip && !parentTrip.is_public) || (selectedVisit && !selectedVisit.is_public));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const text = (name: string) => String(fields.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || null;
    const start = optional('start_date');
    const end = optional('end_date');
    const published = fields.get('is_public') === 'on' && !isFlight;
    if (!isFlight && start && end && end < start) { setError('The end date must be on or after the start date.'); return; }
    for (const name of ['time_zone', 'arrival_time_zone']) {
      const zone = optional(name);
      if (zone) {
        try { new Intl.DateTimeFormat('en', { timeZone: zone }); }
        catch { setError('Use an IANA time zone such as Europe/London, or leave it blank.'); return; }
      }
    }
    const city = cityOptions.find(option => option.city_key === cityKey);
    if ((edit.table === 'visits' || isMemory) && !city) { setError('Choose a city first.'); return; }
    const link = optional('link_url');
    if (link && (link.includes('\\') || !(/^https:\/\/[^\s]+$/i.test(link) || /^\/(?!\/)[^\s]*$/.test(link)))) { setError('Use an https link or a page path beginning with /.'); return; }
    setSaving(true);
    setError('');
    try {
      if (edit.table === 'trips') {
        await journal.save('trips', { title: text('title'), start_date: start, end_date: end, notes: text('notes'), status: text('status') as TravelTrip['status'], is_public: published }, edit.row);
      } else if (edit.table === 'visits') {
        await journal.save('visits', { ...city!, trip_id: tripId || null, start_date: start, end_date: end, notes: text('notes'), status: text('status') as TravelVisit['status'], is_public: published }, edit.row);
      } else if (edit.table === 'memories') {
        let uploaded = photoPath;
        const file = fields.get('photo');
        if (isPhoto && file instanceof File && file.size > 0 && file !== uploadedFile.current) {
          uploaded = await uploadTravelPhoto(file);
          setPhotoPath(uploaded);
          uploadedFile.current = file;
        }
        if (isPhoto && !uploaded) { setError('Choose a photo to upload.'); return; }
        await journal.save('memories', {
          ...city!, trip_id: tripId || null, visit_id: visitId || null,
          kind: kind as TravelMemory['kind'], title: text('title'), body: text('body'), category: text('category'),
          link_url: link, photo_path: isPhoto ? uploaded : null, is_cover: isPhoto && fields.get('is_cover') === 'on',
          sort_order: Number(text('sort_order') || 0), is_public: published,
        }, edit.row);
      } else {
        await journal.save('itinerary', {
          trip_id: tripId || null, kind: kind as TravelItinerary['kind'], title: text('title'), start_date: start, end_date: end,
          start_time: optional('start_time'), end_time: optional('end_time'), time_zone: optional('time_zone'), arrival_time_zone: optional('arrival_time_zone'),
          origin: optional('origin'), destination: optional('destination'), notes: text('notes'),
          source_key: edit.row?.source_key ?? null, source_name: edit.row?.source_name ?? null,
          status: text('status') as TravelItinerary['status'], is_public: published,
        }, edit.row);
      }
      onClose();
    } catch {
      setError('Could not save this record. Your changes are still here; please try again.');
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? 'Edit' : 'Add'} {noun}</DialogTitle>
          <DialogDescription>Keep a record of your travels. New records are private until you publish them.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            {edit.table !== 'visits' && <div className="space-y-2"><Label htmlFor={`${id}-title`}>{isPhoto ? 'Caption / image description' : 'Title'}</Label><Input id={`${id}-title`} name="title" required maxLength={200} defaultValue={row && 'title' in row ? row.title : ''} /></div>}
            {(isMemory || edit.table === 'itinerary') && <div className="space-y-2"><Label htmlFor={`${id}-kind`}>Type</Label><select id={`${id}-kind`} className={selectClass} value={kind} onChange={event => setKind(event.target.value)}>{(isMemory ? ['note', 'favourite', 'photo'] : ['activity', 'flight', 'train', 'stay']).map(value => <option key={value} value={value}>{value}</option>)}</select></div>}
            {(edit.table === 'visits' || isMemory) && <div className="space-y-2"><Label htmlFor={`${id}-city`}>City</Label><select id={`${id}-city`} className={selectClass} value={cityKey} required onChange={event => { setCityKey(event.target.value); setVisitId(''); }}>{cityOptions.length === 0 && <option value="">Choose a city from Places first</option>}{cityOptions.map(city => <option key={city.city_key} value={city.city_key}>{city.city_name} · {city.country_code}</option>)}</select></div>}
            {edit.table !== 'trips' && <div className="space-y-2"><Label htmlFor={`${id}-trip`}>Trip</Label><select id={`${id}-trip`} className={selectClass} value={tripId} onChange={event => { setTripId(event.target.value); setVisitId(''); }}><option value="">No trip attached</option>{journal.data.trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></div>}
            {isMemory && <div className="space-y-2"><Label htmlFor={`${id}-visit`}>Visit</Label><select id={`${id}-visit`} className={selectClass} value={visitId} onChange={event => { const visit = journal.data.visits.find(item => item.id === event.target.value); setVisitId(event.target.value); if (visit) setTripId(visit.trip_id ?? ''); }}><option value="">Across all visits</option>{journal.data.visits.filter(visit => visit.city_key === cityKey && (!tripId || visit.trip_id === tripId)).map(visit => <option key={visit.id} value={visit.id}>{visit.start_date ?? 'Dates not recorded'} · {visit.status}</option>)}</select></div>}
            {!isMemory && <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor={`${id}-start`}>Start date</Label><Input id={`${id}-start`} name="start_date" type="date" defaultValue={row && 'start_date' in row ? row.start_date ?? '' : ''} /></div>
                <div className="space-y-2"><Label htmlFor={`${id}-end`}>End date</Label><Input id={`${id}-end`} name="end_date" type="date" defaultValue={row && 'end_date' in row ? row.end_date ?? '' : ''} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Leave dates blank when they are not known. A flight or a planned stay does not count as a confirmed visit.</p>
              <div className="space-y-2"><Label htmlFor={`${id}-status`}>Status</Label><select id={`${id}-status`} name="status" className={selectClass} defaultValue={row && 'status' in row ? row.status : edit.table === 'visits' ? 'confirmed' : 'planned'}>{(edit.table === 'visits' ? ['confirmed', 'planned', 'transit'] : ['planned', 'completed', 'cancelled']).map(value => <option key={value} value={value}>{value}</option>)}</select></div>
            </>}
            {edit.table === 'itinerary' && <>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor={`${id}-origin`}>From / location</Label><Input id={`${id}-origin`} name="origin" maxLength={200} defaultValue={edit.row?.origin ?? ''} /></div><div className="space-y-2"><Label htmlFor={`${id}-destination`}>To</Label><Input id={`${id}-destination`} name="destination" maxLength={200} defaultValue={edit.row?.destination ?? ''} /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor={`${id}-time`}>Local start time</Label><Input id={`${id}-time`} name="start_time" type="time" defaultValue={edit.row?.start_time ?? ''} /></div><div className="space-y-2"><Label htmlFor={`${id}-end-time`}>Local end time</Label><Input id={`${id}-end-time`} name="end_time" type="time" defaultValue={edit.row?.end_time ?? ''} /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor={`${id}-zone`}>Start time zone</Label><Input id={`${id}-zone`} name="time_zone" placeholder="Europe/London" maxLength={100} defaultValue={edit.row?.time_zone ?? ''} /></div><div className="space-y-2"><Label htmlFor={`${id}-end-zone`}>End time zone</Label><Input id={`${id}-end-zone`} name="arrival_time_zone" placeholder="Europe/Lisbon" maxLength={100} defaultValue={edit.row?.arrival_time_zone ?? ''} /></div></div>
            </>}
            {isMemory && <>
              {kind === 'favourite' && <div className="space-y-2"><Label htmlFor={`${id}-category`}>Category</Label><Input id={`${id}-category`} name="category" placeholder="Coffee, food, walk, experience…" maxLength={100} defaultValue={edit.row?.category ?? ''} /></div>}
              <div className="space-y-2"><Label htmlFor={`${id}-link`}>Related page or place link</Label><Input id={`${id}-link`} name="link_url" placeholder="https://… or /books" maxLength={2000} defaultValue={edit.row?.link_url ?? ''} /></div>
              {isPhoto && <>
                <div className="space-y-2"><Label htmlFor={`${id}-photo`}>{photoPath ? 'Replace photo (optional)' : 'Photo'}</Label><Input id={`${id}-photo`} name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><p className="text-xs text-muted-foreground">JPEG, PNG or WebP. A resized copy without camera metadata is stored.</p></div>
                <label className="flex items-center gap-2 text-sm"><input name="is_cover" type="checkbox" defaultChecked={edit.row?.is_cover ?? false} /> Use as a city cover</label>
                <div className="space-y-2"><Label htmlFor={`${id}-order`}>Album order</Label><Input id={`${id}-order`} name="sort_order" type="number" min={MIN_SORT_ORDER} max={MAX_SORT_ORDER} defaultValue={edit.row?.sort_order ?? 0} /></div>
              </>}
            </>}
            <div className="space-y-2"><Label htmlFor={`${id}-notes`}>{isMemory ? 'Memory / why it matters' : 'Notes'}</Label><Textarea id={`${id}-notes`} name={isMemory ? 'body' : 'notes'} rows={4} maxLength={10000} defaultValue={row ? 'body' in row ? row.body : row.notes : ''} /></div>
            {isFlight ? <p className="text-xs text-muted-foreground">Flight records stay private. Publish a trip or city memory to share your travels.</p> : <><label className="flex items-center gap-2 text-sm"><input name="is_public" type="checkbox" defaultChecked={row?.is_public ?? false} /> Publish this record</label>{parentPrivate && <p className="text-xs text-muted-foreground">The linked trip or visit is private. This record becomes visible publicly only when its parents are published too.</p>}</>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{busy ? 'Saving…' : 'Save'}</Button></div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
