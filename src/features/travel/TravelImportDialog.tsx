import { useId, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inferTravelColumns, importedRowMatches, parseTravelCsv, parseTravelIcs, TRAVEL_IMPORT_MAX_BYTES, type TravelColumn, type TravelColumnMapping } from './journal-import';
import type { JournalDraft, TravelItinerary, TravelTrip } from './journal-types';

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
  const available = rows.map((row, index) => ({ row, index })).filter(({ row }) => !bySource.has(row.source_key));
  const chosen = available.filter(({ index }) => !excluded.has(index));
  const busy = reading || saving;
  const reset = () => { readGeneration.current++; setText(''); setMapping({}); setExcluded(new Set()); setStatuses({}); setTripId(''); setError(null); setReading(false); };
  const changeOpen = (next: boolean) => { if (saving) return; if (!next) reset(); onOpenChange(next); };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const generation = ++readGeneration.current;
    setError(null); setText(''); setMapping({}); setExcluded(new Set()); setStatuses({});
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
            <p className="text-sm" aria-live="polite">{chosen.length} selected · {rows.length - available.length} already saved · {parsed.result.issues.length} need review</p>
            {available.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.length === available.length} onChange={event => setExcluded(event.target.checked ? new Set() : new Set(available.map(({ index }) => index)))} /> Select all new items</label>}
            {rows.length > 0 && <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm"><caption className="sr-only">Import preview. Existing source records cannot be overwritten.</caption>
                <thead className="sticky top-0 bg-background"><tr><th className="p-2 text-left">Save</th><th className="p-2 text-left">Journey / activity</th><th className="p-2 text-left">Status</th></tr></thead>
                <tbody>{rows.map((row, index) => {
                  const previous = bySource.get(row.source_key);
                  return <tr key={row.source_key} className="border-t border-border">
                    <td className="p-2 align-top"><input type="checkbox" aria-label={`Import ${row.title}`} checked={!previous && !excluded.has(index)} disabled={Boolean(previous)} onChange={event => setExcluded(current => { const next = new Set(current); if (event.target.checked) next.delete(index); else next.add(index); return next; })} /></td>
                    <td className="p-2 min-w-40"><p>{row.title}</p><p className="text-xs text-muted-foreground">{row.start_date}{row.start_time ? ` · ${row.start_time}` : ''}{row.time_zone ? ` ${row.time_zone}` : row.start_time ? ' · local time, zone unknown' : ''}</p>{row.end_date && <p className="text-xs text-muted-foreground">Until {row.end_date}{row.end_time ? ` · ${row.end_time}` : ''}{row.arrival_time_zone ? ` ${row.arrival_time_zone}` : ''}</p>}
                      {previous && <p className="text-xs text-muted-foreground">{importedRowMatches(previous, row) ? 'Already imported — skipped' : 'Changed or edited since import — skipped; review the saved item'}</p>}
                    </td>
                    <td className="p-2 align-top"><select aria-label={`Status for ${row.title}`} disabled={Boolean(previous)} className="rounded-md border border-input bg-background p-1 text-xs" value={statuses[index] ?? row.status} onChange={event => setStatuses(current => ({ ...current, [index]: event.target.value as TravelItinerary['status'] }))}><option value="planned">Planned / unconfirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td>
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
          <Button disabled={busy || chosen.length === 0} onClick={() => { void save(); }}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : `Save ${chosen.length} private items`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
