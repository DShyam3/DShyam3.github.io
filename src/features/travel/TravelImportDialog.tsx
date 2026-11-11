import { useId, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inferTravelColumns, importedRowMatches, parseTravelCsv, parseTravelIcs, TRAVEL_IMPORT_MAX_BYTES, type TravelColumn, type TravelColumnMapping } from './journal-import';
import type { JournalDraft, TravelItinerary, TravelTrip } from './journal-types';
import { compareItineraryStart } from './journal-summary';

interface TravelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: TravelItinerary[];
  trips: TravelTrip[];
  onImport: (rows: JournalDraft<TravelItinerary>[]) => Promise<void>;
}
const fields: [TravelColumn, string][] = [
  ['date', 'Departure / start date'], ['title', 'Title'], ['origin', 'From'], ['destination', 'To'],
  ['airline', 'Airline'], ['flightNumber', 'Flight number'], ['endDate', 'Arrival / end date'],
  ['startTime', 'Departure / start time'], ['endTime', 'Arrival / end time'], ['timeZone', 'Departure time zone'],
  ['arrivalTimeZone', 'Arrival time zone'], ['status', 'Status'], ['sourceId', 'Source ID'],
];

export function TravelImportDialog({ open, onOpenChange, existing, trips, onImport }: TravelImportDialogProps) {
  const id = useId();
  const readGeneration = useRef(0);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<'csv' | 'ics'>('csv');
  const [mapping, setMapping] = useState<TravelColumnMapping>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<number, TravelItinerary['status']>>({});
  const [showSaved, setShowSaved] = useState(false);
  const [tripId, setTripId] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => {
    if (!text) return { result: null, error: null };
    try { return { result: format === 'ics' ? parseTravelIcs(text) : parseTravelCsv(text, mapping), error: null }; }
    catch (failure) { return { result: null, error: failure instanceof Error ? failure.message : 'Could not read this file.' }; }
  }, [text, format, mapping]);
  const bySource = useMemo(() => new Map(existing.filter(row => row.source_key).map(row => [row.source_key, row])), [existing]);
  const rows = parsed.result?.rows ?? [];
  // Preview in date order; `index` stays the row's position in the file, which keys selection and status.
  const ordered = rows.map((row, index) => ({ row, index })).sort((a, b) => compareItineraryStart(a.row, b.row));
  const available = ordered.filter(({ row }) => !bySource.has(row.source_key));
  const chosen = available.filter(({ index }) => !excluded.has(index));
  // An export repeats the whole history, so rows already saved and unchanged are hidden unless asked for.
  const unchanged = new Set(ordered.filter(({ row }) => { const previous = bySource.get(row.source_key); return previous ? importedRowMatches(previous, row) : false; }).map(({ index }) => index));
  const changedCount = rows.length - available.length - unchanged.size;
  const shown = showSaved ? ordered : ordered.filter(({ index }) => !unchanged.has(index));
  const busy = reading || saving;
  const reset = () => { readGeneration.current++; setText(''); setMapping({}); setExcluded(new Set()); setStatuses({}); setShowSaved(false); setTripId(''); setError(null); setReading(false); };
  const changeOpen = (next: boolean) => { if (saving) return; if (!next) reset(); onOpenChange(next); };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const generation = ++readGeneration.current;
    setError(null); setText(''); setMapping({}); setExcluded(new Set()); setStatuses({}); setShowSaved(false);
    if (file.size > TRAVEL_IMPORT_MAX_BYTES) { setError('Choose a file smaller than 5 MB.'); return; }
    setReading(true);
    try {
      const content = await file.text();
      if (generation !== readGeneration.current) return;
      const isCalendar = /^BEGIN:VCALENDAR\s*$/m.test(content.replace(/\r/g, ''));
      setFormat(isCalendar ? 'ics' : 'csv'); setText(content);
    } catch { if (generation === readGeneration.current) setError('Could not read the file. Try exporting it again.'); }
    finally { if (generation === readGeneration.current) setReading(false); }
  };
  const save = async () => {
    if (!chosen.length || busy) return;
    setSaving(true); setError(null);
    try {
      await onImport(chosen.map(({ row, index }) => ({ ...row, trip_id: tripId || null, status: statuses[index] ?? row.status, is_public: false })));
      reset(); onOpenChange(false);
    } catch { setError('Could not save the import. Your preview is preserved; try again.'); }
    finally { setSaving(false); }
  };
  const autoMapping = inferTravelColumns(parsed.result?.headers ?? []);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-3xl" onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Import an itinerary</DialogTitle>
          <DialogDescription>Review Flighty CSV, a structured itinerary CSV, or an iCalendar file before saving. Everything starts private. Flights do not create city visits.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-4 min-w-0">
          <div className="space-y-2">
            <Label htmlFor={`${id}-file`}>CSV or calendar file · up to 5 MB / 2,000 rows</Label>
            <Input id={`${id}-file`} type="file" accept=".csv,.ics,text/csv,text/calendar" onChange={event => { void readFile(event.target.files?.[0]); }} />
            <p className="text-xs text-muted-foreground">Parsed on this device. Reservation codes, seats, passenger details and source notes are not imported. Flighty times are scheduled airport-local times, with no assumed time zone.</p>
          </div>
          {reading && <p role="status" className="text-sm">Reading file…</p>}
          {(error || parsed.error) && <p role="alert" className="text-sm text-destructive">{error || parsed.error}</p>}
          {parsed.result && format === 'csv' && <details className="rounded-xl border border-border p-3">
            <summary className="text-sm cursor-pointer">Review column mapping</summary>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              {fields.map(([field, label]) => <div key={field} className="space-y-1">
                <Label htmlFor={`${id}-${field}`}>{label}</Label>
                <select id={`${id}-${field}`} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={mapping[field] ?? autoMapping[field] ?? ''} onChange={event => { setMapping(current => ({ ...current, [field]: event.target.value })); setExcluded(new Set()); setStatuses({}); }}>
                  <option value="">Not provided</option>
                  {parsed.result.headers.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>)}
            </div>
          </details>}
          {parsed.result && <>
            <div className="space-y-1">
              <Label htmlFor={`${id}-trip`}>Attach selected items to a trip</Label>
              <select id={`${id}-trip`} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={tripId} onChange={event => setTripId(event.target.value)}>
                <option value="">Leave unassigned</option>
                {trips.map(trip => <option value={trip.id} key={trip.id}>{trip.title}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm" aria-live="polite">{chosen.length} selected · {unchanged.size} already saved{changedCount > 0 ? ` · ${changedCount} changed since import` : ''} · {parsed.result.issues.length} need review</p>
              {unchanged.size > 0 && <Button type="button" variant="link" size="sm" className="min-h-0 px-0 py-0" onClick={() => setShowSaved(current => !current)}>{showSaved ? 'Hide already saved' : `Show ${unchanged.size} already saved`}</Button>}
            </div>
            {rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing new to save: every journey read from this file is already saved.</p>}
            {available.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.length === available.length} onChange={event => setExcluded(event.target.checked ? new Set() : new Set(available.map(({ index }) => index)))} /> Select all new items</label>
              {/* An export marks every flight planned; whether each happened stays the owner's call, made here. */}
              {chosen.length > 0 && <Button type="button" size="sm" variant="outline" onClick={() => setStatuses(current => ({ ...current, ...Object.fromEntries(chosen.filter(({ row }) => row.status !== 'cancelled').map(({ index }) => [index, 'completed' as const])) }))}>Mark selected completed</Button>}
            </div>}
            {shown.length > 0 && <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm"><caption className="sr-only">Import preview. Existing source records cannot be overwritten.</caption>
                <thead className="sticky top-0 bg-background"><tr><th className="p-2 text-left">Save</th><th className="p-2 text-left">Journey / activity</th><th className="p-2 text-left">Status</th></tr></thead>
                <tbody>{shown.map(({ row, index }) => {
                  const previous = bySource.get(row.source_key);
                  return <tr key={row.source_key} className="border-t border-border">
                    <td className="p-2 align-top"><input type="checkbox" aria-label={`Import ${row.title}`} checked={!previous && !excluded.has(index)} disabled={Boolean(previous)} onChange={event => setExcluded(current => { const next = new Set(current); if (event.target.checked) next.delete(index); else next.add(index); return next; })} /></td>
                    <td className="p-2 min-w-40"><p>{row.title}</p><p className="text-xs text-muted-foreground">{row.start_date}{row.start_time ? ` · ${row.start_time}` : ''}{row.time_zone ? ` ${row.time_zone}` : row.start_time ? ' · local time, zone unknown' : ''}</p>{row.end_date && <p className="text-xs text-muted-foreground">Until {row.end_date}{row.end_time ? ` · ${row.end_time}` : ''}{row.arrival_time_zone ? ` ${row.arrival_time_zone}` : ''}</p>}
                      {previous && <p className="text-xs text-muted-foreground">{unchanged.has(index) ? 'Already imported — skipped' : row.status === 'cancelled' && previous.status !== 'cancelled' ? 'Cancelled at source — skipped; review the saved item' : 'Changed since import — skipped; review the saved item'}</p>}
                    </td>
                    <td className="p-2 align-top"><select aria-label={`Status for ${row.title}`} disabled={Boolean(previous)} className="rounded-md border border-input bg-background p-1 text-xs" value={previous ? previous.status : statuses[index] ?? row.status} onChange={event => setStatuses(current => ({ ...current, [index]: event.target.value as TravelItinerary['status'] }))}><option value="planned">Planned / unconfirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
            {parsed.result.issues.length > 0 && <details open className="rounded-xl border border-border p-3"><summary className="text-sm">Rows not included</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{parsed.result.issues.map((issue, index) => <li key={`${issue.row}-${index}`}>Row/event {issue.row}: {issue.message}</li>)}</ul></details>}
            <p className="text-xs text-muted-foreground">A past date does not prove a journey happened. Confirm status here, then record your actual city stays separately. Calendar descriptions, locations, attendees, recurring events and cancellations need manual review.</p>
          </>}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => changeOpen(false)}>Cancel</Button>
          <Button disabled={busy || chosen.length === 0} onClick={() => { void save(); }}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : `Save ${chosen.length} private item${chosen.length === 1 ? '' : 's'}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
