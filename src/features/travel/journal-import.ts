import { MAX_SORT_ORDER, MIN_SORT_ORDER, type JournalDraft, type TravelItinerary, type TravelJournal, type TravelMemory, type TravelTrip, type TravelVisit } from './journal-types';

export const TRAVEL_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const TRAVEL_IMPORT_MAX_ROWS = 2000;
export const TRAVEL_BACKUP_MAX_RECORDS = 10000;
export type TravelColumn = 'date' | 'title' | 'origin' | 'destination' | 'flightNumber' | 'airline' | 'endDate' | 'startTime' | 'endTime' | 'timeZone' | 'arrivalTimeZone' | 'status' | 'sourceId';
export type TravelColumnMapping = Partial<Record<TravelColumn, string>>;
export interface TravelImportResult {
  headers: string[];
  rows: JournalDraft<TravelItinerary>[];
  issues: { row: number; message: string }[];
}
export interface TravelBackup extends TravelJournal { version: 1 }

const aliases: Record<TravelColumn, string[]> = {
  date: ['date', 'startdate', 'departuredate'], title: ['title', 'summary', 'activity'],
  origin: ['from', 'origin', 'departureairport'], destination: ['to', 'destination', 'arrivalairport'],
  flightNumber: ['flightnumber', 'flight', 'number'], airline: ['airline'],
  endDate: ['enddate', 'arrivaldate'], startTime: ['starttime', 'departuretime'], endTime: ['endtime', 'arrivaltime'],
  timeZone: ['timezone', 'departuretimezone'], arrivalTimeZone: ['arrivaltimezone'],
  status: ['status'], sourceId: ['flightflightyid', 'sourceid', 'id'],
};
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function inferTravelColumns(headers: string[]): TravelColumnMapping {
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.find(header => names.includes(normalize(header))) ?? '']));
}
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const validZone = (value: string) => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } };
const sourceLabel = (value: string) => value.slice(0, 200);
const emptyRow = (): JournalDraft<TravelItinerary> => ({
  trip_id: null, kind: 'activity', title: '', start_date: null, end_date: null, start_time: null, end_time: null,
  time_zone: null, arrival_time_zone: null, origin: null, destination: null, notes: '', source_key: null,
  source_name: null, status: 'planned', is_public: false,
});
function assertSize(text: string) {
  if (new TextEncoder().encode(text).length > TRAVEL_IMPORT_MAX_BYTES) throw new Error('Choose a file smaller than 5 MB.');
}

/** Quoted commas/newlines are supported; malformed quoting never silently changes columns. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const finishRow = () => {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
    if (rows.length > TRAVEL_IMPORT_MAX_ROWS + 1) throw new Error('Import at most 2,000 rows at a time.');
    row = []; cell = ''; closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',' ) { row.push(cell); cell = ''; closed = false; }
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); }
    else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === '"' || (closed && char.trim())) throw new Error('Malformed CSV quoting. Export the file again.');
    else if (!closed) cell += char;
  }
  if (quoted) throw new Error('Unclosed quoted field in CSV.');
  finishRow();
  return rows;
}

export function parseTravelCsv(text: string, mapping?: TravelColumnMapping, sourceName = 'CSV import'): TravelImportResult {
  assertSize(text);
  const [rawHeaders = [], ...records] = csvRows(text.replace(/^\uFEFF/, ''));
  const headers = rawHeaders.map(value => value.trim());
  if (new Set(headers).size !== headers.length || headers.some(header => !header)) throw new Error('CSV headers must be unique and nonempty.');
  const columns = { ...inferTravelColumns(headers), ...mapping };
  const flighty = ['Flight Flighty ID', 'Canceled', 'Gate Departure (Scheduled)', 'Gate Arrival (Scheduled)'].every(header => headers.includes(header));
  const result: TravelImportResult = { headers, rows: [], issues: [] };
  if (!columns.date) { result.issues.push({ row: 1, message: 'Choose the date column before importing.' }); return result; }
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const issue = (message: string) => result.issues.push({ row: index + 2, message });
    if (record.length !== headers.length) { issue('Column count does not match the header.'); return; }
    const get = (field: TravelColumn) => record[headers.indexOf(columns[field] ?? '')]?.trim() ?? '';
    const named = (header: string) => record[headers.indexOf(header)]?.trim() ?? '';
    const row = emptyRow();
    row.start_date = get('date'); row.end_date = get('endDate') || null;
    if (!validDate(row.start_date) || (row.end_date && !validDate(row.end_date))) { issue('Use ISO dates (YYYY-MM-DD); dates were not guessed.'); return; }
    row.origin = get('origin') || null; row.destination = get('destination') || null;
    const flight = get('flightNumber'), airline = get('airline');
    row.kind = row.origin || row.destination || flight ? 'flight' : 'activity';
    if (row.kind !== 'flight' && row.end_date && row.end_date < row.start_date) { issue('End date precedes the start date.'); return; }
    if (row.kind === 'flight' && (!row.origin || !row.destination)) { issue('A flight needs both origin and destination.'); return; }
    row.title = get('title') || [airline, flight, row.origin && row.destination ? `${row.origin} → ${row.destination}` : ''].filter(Boolean).join(' ');
    if (!row.title || row.title.length > 200 || (row.origin?.length ?? 0) > 200 || (row.destination?.length ?? 0) > 200) { issue('Provide a title and locations of at most 200 characters.'); return; }
    row.start_time = get('startTime') || null; row.end_time = get('endTime') || null;
    if (flighty) {
      if (named('Diverted To')) { issue('Diverted flight: confirm the actual destination manually before importing.'); return; }
      for (const [header, dateField, timeField] of [
        ['Gate Departure (Scheduled)', 'start_date', 'start_time'],
        ['Gate Arrival (Scheduled)', 'end_date', 'end_time'],
      ] as const) {
        const value = named(header);
        if (value && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDate(value.slice(0, 10)) || !validTime(value.slice(11)))) {
          issue('Unrecognised Flighty scheduled timestamp; dates and time zones were not guessed.'); return;
        }
        if (value) { row[dateField] = value.slice(0, 10); row[timeField] = value.slice(11); }
      }
      // Scheduled airport-local times remain local. Missing actuals never establish whether a flight occurred.
      row.notes = 'Scheduled local airport times from Flighty. Time zones were not included in the export.';
    }
    if ([row.start_time, row.end_time].some(value => value && !validTime(value))) { issue('Times must be HH:MM; timestamps need separate date/time columns.'); return; }
    row.time_zone = get('timeZone') || null; row.arrival_time_zone = get('arrivalTimeZone') || null;
    if ([row.time_zone, row.arrival_time_zone].some(value => value && !validZone(value))) { issue('Use an IANA time zone such as Europe/London.'); return; }
    const status = get('status').toLowerCase();
    if (status && !['planned', 'completed', 'cancelled', 'canceled'].includes(status)) { issue('Unrecognised status; map or correct it before importing.'); return; }
    row.status = status === 'canceled' ? 'cancelled' : (status || 'planned') as TravelItinerary['status'];
    if (flighty) {
      const cancelled = named('Canceled').toLowerCase();
      if (!['true', 'false'].includes(cancelled)) { issue('Unrecognised Flighty cancellation flag.'); return; }
      if (cancelled === 'true') row.status = 'cancelled';
    }
    const sourceId = get('sourceId');
    const provider = headers.some(header => normalize(header).includes('flighty')) ? 'flighty' : 'csv';
    row.source_key = sourceId ? `${provider}:${sourceId}` : `csv:${JSON.stringify([row.start_date, airline, flight, row.origin, row.destination, row.kind === 'activity' ? row.title : ''])}`;
    if (row.source_key.length > 500) { issue('Source identity is too long.'); return; }
    if (seen.has(row.source_key)) { issue('Duplicate source record in this file; review the first occurrence.'); return; }
    seen.add(row.source_key);
    row.source_name = flighty ? 'Flighty CSV' : sourceLabel(sourceName);
    result.rows.push(row);
  });
  return result;
}

interface CalendarValue { value: string; params: Record<string, string> }
function calendarDate(property: CalendarValue): { date: string; time: string | null; zone: string | null } {
  const { value, params } = property;
  if (/^\d{8}$/.test(value) && (params.VALUE === 'DATE' || !params.VALUE)) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    if (!validDate(date)) throw new Error('Invalid calendar date.');
    return { date, time: null, zone: null };
  }
  if (!/^\d{8}T\d{6}Z?$/.test(value) || value.slice(13, 15) !== '00') throw new Error('Only dates or minute-precision calendar times are supported.');
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const time = `${value.slice(9, 11)}:${value.slice(11, 13)}`;
  const zone = value.endsWith('Z') ? 'UTC' : params.TZID;
  if (!validDate(date) || !validTime(time)) throw new Error('Invalid calendar date or time.');
  if (!zone || !validZone(zone)) throw new Error('A timed event needs UTC or a recognised TZID; floating times were not guessed.');
  return { date, time, zone };
}
const calendarText = (value: string) => value.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');

/** Deliberately bounded ICS subset. Recurrences/overrides and floating times need manual review. */
export function parseTravelIcs(text: string, sourceName = 'Calendar import'): TravelImportResult {
  assertSize(text);
  const result: TravelImportResult = { headers: [], rows: [], issues: [] };
  if (!/^BEGIN:VCALENDAR\s*$/m.test(text.replace(/\r/g, ''))) throw new Error('Choose an iCalendar (.ics) file.');
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: Map<string, CalendarValue>[] = [];
  let event: Map<string, CalendarValue> | null = null, nested = 0;
  let cancelCalendar = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'METHOD:CANCEL' && !event) cancelCalendar = true;
    if (line === 'BEGIN:VEVENT') { if (event) throw new Error('Malformed nested calendar event.'); event = new Map(); nested = 0; }
    else if (line === 'END:VEVENT') { if (!event) throw new Error('Malformed calendar event.'); events.push(event); event = null; }
    else if (event && line.startsWith('BEGIN:')) nested++;
    else if (event && line.startsWith('END:')) nested--;
    else if (event && nested === 0) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [key, ...parameters] = line.slice(0, colon).split(';');
      const params = Object.fromEntries(parameters.map(parameter => { const at = parameter.indexOf('='); return [parameter.slice(0, at).toUpperCase(), parameter.slice(at + 1).replace(/^"|"$/g, '')]; }));
      if (event.has(key.toUpperCase())) { if (['UID', 'DTSTART', 'DTEND', 'SUMMARY'].includes(key.toUpperCase())) throw new Error('Duplicate calendar field.'); }
      event.set(key.toUpperCase(), { value: line.slice(colon + 1), params });
    }
  }
  if (event || !lines.some(line => line.trim() === 'END:VCALENDAR')) throw new Error('Incomplete calendar file.');
  if (events.length > TRAVEL_IMPORT_MAX_ROWS) throw new Error('Import at most 2,000 events at a time.');
  const seen = new Set<string>();
  events.forEach((properties, index) => {
    try {
      if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some(key => properties.has(key))) throw new Error('Recurring events and exceptions need manual entry.');
      const uid = properties.get('UID')?.value;
      if (!uid || uid.length > 490) throw new Error('Event needs a stable UID of at most 490 characters.');
      if (seen.has(uid)) throw new Error('Repeated UID in this calendar; review revisions separately.');
      seen.add(uid);
      const status = properties.get('STATUS')?.value.toUpperCase();
      if (cancelCalendar || status === 'CANCELLED') throw new Error(`Cancelled event (${uid}); update the existing item manually, no automatic overwrite.`);
      const start = properties.get('DTSTART');
      if (!start) throw new Error('Event has no start date.');
      const row = emptyRow(), parsedStart = calendarDate(start);
      row.start_date = parsedStart.date; row.start_time = parsedStart.time; row.time_zone = parsedStart.zone;
      const end = properties.get('DTEND');
      if (end) {
        const parsedEnd = calendarDate(end);
        if (Boolean(parsedEnd.time) !== Boolean(parsedStart.time)) throw new Error('Start and end must both be dates or both be timed.');
        row.end_date = parsedEnd.date; row.end_time = parsedEnd.time; row.arrival_time_zone = parsedEnd.zone;
        if (!parsedEnd.time) {
          const inclusive = new Date(`${row.end_date}T00:00:00Z`); inclusive.setUTCDate(inclusive.getUTCDate() - 1);
          row.end_date = inclusive.toISOString().slice(0, 10);
        }
        if (row.end_date < row.start_date) throw new Error('End date precedes start date.');
        if (row.end_date === row.start_date && row.time_zone === row.arrival_time_zone && row.end_time && row.start_time && row.end_time < row.start_time) throw new Error('End time precedes start time.');
      }
      if (properties.has('DURATION')) throw new Error('Duration-based events need explicit end dates; review manually.');
      row.title = calendarText(properties.get('SUMMARY')?.value ?? 'Calendar activity');
      if (row.title.length > 200) throw new Error('Event title exceeds 200 characters.');
      // DESCRIPTION/LOCATION/ATTENDEE are intentionally not copied: bookings and other people can appear there.
      row.source_key = `ics:${uid}`; row.source_name = sourceLabel(sourceName);
      result.rows.push(row);
    } catch (error) { result.issues.push({ row: index + 1, message: error instanceof Error ? error.message : 'Unsupported event.' }); }
  });
  return result;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Backup contains an invalid record.');
  return value as Record<string, unknown>;
}
function stringField(row: Record<string, unknown>, key: string, max = 200, nullable = false): string | null {
  const value = row[key];
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new Error(`Invalid ${key} in backup.`);
  return value;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function idField(row: Record<string, unknown>, key: string, nullable = false) {
  const value = stringField(row, key, 36, nullable);
  if (value !== null && !uuid.test(value)) throw new Error(`Invalid ${key} in backup.`);
  return value;
}
function enumField<T extends string>(row: Record<string, unknown>, key: string, values: readonly T[]): T {
  if (!values.includes(row[key] as T)) throw new Error(`Invalid ${key} in backup.`);
  return row[key] as T;
}
function booleanField(row: Record<string, unknown>, key: string): boolean {
  if (typeof row[key] !== 'boolean') throw new Error(`Invalid ${key} in backup.`);
  return row[key] as boolean;
}
function base(row: Record<string, unknown>) {
  const created_at = stringField(row, 'created_at', 40), updated_at = stringField(row, 'updated_at', 40);
  if (![created_at, updated_at].every(value => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)))) throw new Error('Invalid record timestamps.');
  return { id: idField(row, 'id'), owner_id: idField(row, 'owner_id'), created_at, updated_at, is_public: booleanField(row, 'is_public') };
}
function dates(row: Record<string, unknown>, allowEarlierEnd = false) {
  const start_date = stringField(row, 'start_date', 10, true), end_date = stringField(row, 'end_date', 10, true);
  if ([start_date, end_date].some(value => value !== null && !validDate(value)) || (!allowEarlierEnd && start_date && end_date && end_date < start_date)) throw new Error('Invalid date range in backup.');
  return { start_date, end_date };
}
function city(row: Record<string, unknown>) {
  const country_code = stringField(row, 'country_code', 2), city_name = stringField(row, 'city_name', 200), city_key = stringField(row, 'city_key', 200);
  if (!/^[A-Z]{2}$/.test(country_code) || !city_name.trim() || !city_key.trim()) throw new Error('Invalid city identity in backup.');
  return { country_code, city_name, city_key };
}
export function validateTravelBackup(text: string): TravelBackup {
  if (new TextEncoder().encode(text).length > 8 * 1024 * 1024) throw new Error('Choose a backup smaller than 8 MB.');
  const payload = object(JSON.parse(text));
  if (payload.version !== 1) throw new Error('Unsupported travel backup version.');
  const read = <T>(key: string, parse: (row: Record<string, unknown>) => T): T[] => {
    if (!Array.isArray(payload[key]) || payload[key].length > TRAVEL_BACKUP_MAX_RECORDS) throw new Error(`Invalid ${key} collection or too many records.`);
    return (payload[key] as unknown[]).map(value => parse(object(value)));
  };
  const trips = read<TravelTrip>('trips', row => ({ ...base(row), ...dates(row), title: stringField(row, 'title'), notes: stringField(row, 'notes', 20000), status: enumField(row, 'status', ['planned', 'completed', 'cancelled']) }));
  const visits = read<TravelVisit>('visits', row => ({ ...base(row), ...dates(row), ...city(row), trip_id: idField(row, 'trip_id', true), notes: stringField(row, 'notes', 20000), status: enumField(row, 'status', ['confirmed', 'planned', 'transit']) }));
  const memories = read<TravelMemory>('memories', row => {
    const record = { ...base(row), ...city(row), trip_id: idField(row, 'trip_id', true), visit_id: idField(row, 'visit_id', true), kind: enumField(row, 'kind', ['note', 'favourite', 'photo']), title: stringField(row, 'title'), body: stringField(row, 'body', 20000), category: stringField(row, 'category', 100), link_url: stringField(row, 'link_url', 2048, true), photo_path: stringField(row, 'photo_path', 100, true), is_cover: booleanField(row, 'is_cover'), sort_order: row.sort_order as number };
    if (!Number.isSafeInteger(record.sort_order) || record.sort_order < MIN_SORT_ORDER || record.sort_order > MAX_SORT_ORDER) throw new Error(`Photo ordering must be between ${MIN_SORT_ORDER} and ${MAX_SORT_ORDER}.`);
    if (record.is_cover && record.kind !== 'photo') throw new Error('Only photos may be covers.');
    if (record.link_url && !(/^https:\/\/[^\s\\]+$/.test(record.link_url) || /^\/(?!\/)[^\s\\]+$/.test(record.link_url))) throw new Error('Invalid memory link.');
    if (record.link_url?.startsWith('https://')) { try { if (new URL(record.link_url).protocol !== 'https:') throw new Error(); } catch { throw new Error('Invalid memory link.'); } }
    if (record.kind === 'photo') {
      const [owner, filename, extra] = (record.photo_path ?? '').split('/');
      if (owner !== record.owner_id || extra || !filename?.endsWith('.jpg') || !uuid.test(filename.slice(0, -4))) throw new Error('Invalid private photo path.');
    } else if (record.photo_path !== null) throw new Error('Only photos may have an image path.');
    return record;
  });
  const itinerary = read<TravelItinerary>('itinerary', row => {
    const record = { ...base(row), ...dates(row, row.kind === 'flight'), trip_id: idField(row, 'trip_id', true), kind: enumField(row, 'kind', ['flight', 'train', 'stay', 'activity']), title: stringField(row, 'title'), notes: stringField(row, 'notes', 20000), status: enumField(row, 'status', ['planned', 'completed', 'cancelled']), start_time: stringField(row, 'start_time', 5, true), end_time: stringField(row, 'end_time', 5, true), time_zone: stringField(row, 'time_zone', 100, true), arrival_time_zone: stringField(row, 'arrival_time_zone', 100, true), origin: stringField(row, 'origin', 200, true), destination: stringField(row, 'destination', 200, true), source_key: stringField(row, 'source_key', 500, true), source_name: stringField(row, 'source_name', 200, true) };
    if ([record.start_time, record.end_time].some(value => value && !validTime(value)) || [record.time_zone, record.arrival_time_zone].some(value => value && !validZone(value))) throw new Error('Invalid itinerary time or zone.');
    if (record.kind === 'flight' && record.is_public) throw new Error('Flight records must remain private.');
    return record;
  });
  const all = [...trips, ...visits, ...memories, ...itinerary];
  if (all.length > TRAVEL_BACKUP_MAX_RECORDS) throw new Error(`Restore at most ${TRAVEL_BACKUP_MAX_RECORDS.toLocaleString('en-GB')} records at a time.`);
  if (all.some(row => 'title' in row && !row.title.trim())) throw new Error('Record titles must not be empty.');
  if (new Set(all.map(row => row.owner_id)).size > 1) throw new Error('A backup must belong to one owner.');
  for (const rows of [trips, visits, memories, itinerary]) if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate record identity in backup.');
  const tripIds = new Set(trips.map(row => row.id)), visitById = new Map(visits.map(row => [row.id, row]));
  for (const row of [...visits, ...memories, ...itinerary]) if (row.trip_id && !tripIds.has(row.trip_id)) throw new Error('Missing linked trip in backup.');
  for (const row of memories) if (row.visit_id) {
    const visit = visitById.get(row.visit_id);
    if (!visit || visit.city_key !== row.city_key || visit.country_code !== row.country_code || (row.trip_id && visit.trip_id !== row.trip_id)) throw new Error('Missing or mismatched linked visit in backup.');
  }
  const sources = itinerary.map(row => row.source_key).filter(Boolean);
  if (new Set(sources).size !== sources.length) throw new Error('Duplicate imported source identity in backup.');
  return { version: 1, trips, visits, memories, itinerary };
}

/** Metadata export; image bytes must be downloaded separately using the manifest. */
export function buildTravelBackup(data: TravelJournal): string {
  return JSON.stringify({ version: 1, ...data, media_manifest: data.memories.filter(row => row.photo_path).map(row => ({ memory_id: row.id, path: row.photo_path })), media_note: 'Metadata only. Download the photo files separately; this manifest does not contain image bytes.' }, null, 2);
}

export function importedRowMatches(existing: TravelItinerary, incoming: JournalDraft<TravelItinerary>): boolean {
  return (['kind', 'title', 'start_date', 'end_date', 'start_time', 'end_time', 'time_zone', 'arrival_time_zone', 'origin', 'destination', 'status'] as const).every(field => existing[field] === incoming[field]);
}
