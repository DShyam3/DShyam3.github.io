import { describe, expect, it } from 'vitest';
import { buildTravelBackup, importedRowMatches, parseTravelCsv, parseTravelIcs, validateTravelBackup } from './journal-import';
import type { TravelJournal, TravelItinerary } from './journal-types';

const owner = '11111111-1111-4111-8111-111111111111';
const tripId = '22222222-2222-4222-8222-222222222222';
const visitId = '33333333-3333-4333-8333-333333333333';
const memoryId = '44444444-4444-4444-8444-444444444444';
const base = { owner_id: owner, created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-01T12:00:00Z', is_public: false };
const city = { country_code: 'GB', city_key: 'GB:51.5000,-0.1000', city_name: 'London' };
function backup(): TravelJournal {
  return {
    trips: [{ ...base, id: tripId, title: 'Autumn trip', start_date: '2026-10-01', end_date: '2026-10-02', status: 'completed', notes: '' }],
    visits: [{ ...base, ...city, id: visitId, trip_id: tripId, start_date: '2026-10-01', end_date: '2026-10-02', status: 'confirmed', notes: '' }],
    memories: [{ ...base, ...city, id: memoryId, trip_id: tripId, visit_id: visitId, kind: 'photo', title: 'River walk', body: '', category: '', photo_path: `${owner}/55555555-5555-4555-8555-555555555555.jpg`, link_url: '/photos', is_cover: true, sort_order: 0 }],
    itinerary: [],
  };
}
const calendar = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
// Synthetic columns matching the owner-supplied export; no personal rows are stored here.
const flightyHeaders = 'Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID';
function flighty(overrides: Record<string, string> = {}) {
  const row: Record<string, string> = { Date: '2026-10-01', Airline: 'ZZ', Flight: '123', From: 'AAA', To: 'BBB', Canceled: 'false', 'Gate Departure (Scheduled)': '2026-10-01T22:30', 'Gate Arrival (Scheduled)': '2026-10-02T01:15', 'Gate Departure (Actual)': '2026-10-01T22:32:45', PNR: 'SENSITIVE', Seat: '12A', Notes: 'Do not import me', 'Flight Flighty ID': 'synthetic-flight-1', ...overrides };
  return `${flightyHeaders}\n${flightyHeaders.split(',').map(header => row[header] ?? '').join(',')}`;
}

describe('travel CSV import', () => {
  it('parses the supplied Flighty column shape using scheduled local times and no sensitive fields', () => {
    const parsed = parseTravelCsv(flighty());
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ kind: 'flight', title: 'ZZ 123 AAA → BBB', start_date: '2026-10-01', end_date: '2026-10-02', start_time: '22:30', end_time: '01:15', time_zone: null, status: 'planned', is_public: false, source_key: 'flighty:synthetic-flight-1' });
    expect(JSON.stringify(parsed.rows)).not.toMatch(/SENSITIVE|12A|Do not import me|22:32/);
  });
  it('keeps cancellation and refuses unresolved diversions', () => {
    expect(parseTravelCsv(flighty({ Canceled: 'true' })).rows[0].status).toBe('cancelled');
    expect(parseTravelCsv(flighty({ 'Diverted To': 'CCC' })).issues[0].message).toContain('Diverted');
  });
  it('permits flight arrival on an earlier local date without inventing UTC', () => {
    const result = parseTravelCsv(flighty({ 'Gate Arrival (Scheduled)': '2026-09-30T23:15' }));
    expect(result.rows[0].end_date).toBe('2026-09-30');
    expect(result.rows[0].arrival_time_zone).toBeNull();
    expect(parseTravelCsv('date,title,endDate\n2026-10-02,Walk,2026-10-01').rows).toEqual([]);
  });
  it('supports quoted newlines, escaped quotes and explicit mapping', () => {
    const result = parseTravelCsv('Day,What\n2026-01-01,"Museum, then\n""coffee"""', { date: 'Day', title: 'What' });
    expect(result.rows[0].title).toBe('Museum, then\n"coffee"');
    expect(result.rows[0].kind).toBe('activity');
  });
  it('does not silently repair malformed CSV, dates, times or column counts', () => {
    expect(() => parseTravelCsv('date,title\n2026-01-01,"open')).toThrow();
    expect(() => parseTravelCsv('date,date\n2026-01-01,x')).toThrow();
    expect(parseTravelCsv('date,title\n2026-02-30,Walk').issues).toHaveLength(1);
    expect(parseTravelCsv('date,title\n2026-99-30,Walk').issues).toHaveLength(1);
    expect(parseTravelCsv('date,title,startTime\n2026-01-01,Walk,25:00').issues).toHaveLength(1);
    expect(parseTravelCsv('date,title\n2026-01-01,Walk,Extra').issues).toHaveLength(1);
  });
  it('deduplicates source identities and recognises changes without overwriting', () => {
    const parsed = parseTravelCsv('date,title,id\n2026-01-01,Walk,one\n2026-01-02,Walk,one');
    expect(parsed.rows).toHaveLength(1); expect(parsed.issues).toHaveLength(1);
    const stored = { ...base, id: memoryId, ...parsed.rows[0] } as TravelItinerary;
    expect(importedRowMatches(stored, parsed.rows[0])).toBe(true);
    expect(importedRowMatches({ ...stored, title: 'Owner corrected title' }, parsed.rows[0])).toBe(false);
  });
  it('treats the status chosen at review as the owner\'s, but a newly cancelled journey as a change', () => {
    const parsed = parseTravelCsv('date,title,id\n2026-01-01,Walk,one');
    const stored = { ...base, id: memoryId, ...parsed.rows[0], status: 'completed' } as TravelItinerary;
    expect(importedRowMatches(stored, parsed.rows[0])).toBe(true);
    expect(importedRowMatches(stored, { ...parsed.rows[0], status: 'cancelled' })).toBe(false);
    expect(importedRowMatches({ ...stored, status: 'cancelled' }, { ...parsed.rows[0], status: 'cancelled' })).toBe(true);
  });
  it('caps file and row counts', () => {
    expect(() => parseTravelCsv('x'.repeat(5 * 1024 * 1024 + 1))).toThrow('5 MB');
    expect(() => parseTravelCsv(`date,title\n${'2026-01-01,Walk\n'.repeat(2001)}`)).toThrow('2,000');
  });
});

describe('calendar import', () => {
  it('preserves UTC and ignores booking descriptions, attendees and locations', () => {
    const row = parseTravelIcs(calendar('UID:utc-one\r\nDTSTART:20261101T120000Z\r\nDTEND:20261101T140000Z\r\nSUMMARY:Gallery\r\nDESCRIPTION:Booking secret\r\nATTENDEE:mailto:private@example.com\r\nLOCATION:Private address')).rows[0];
    expect(row).toMatchObject({ source_key: 'ics:utc-one', time_zone: 'UTC', start_time: '12:00', end_time: '14:00', status: 'planned', notes: '' });
    expect(JSON.stringify(row)).not.toMatch(/secret|private|address/);
  });
  it('preserves timezone IDs and converts exclusive all-day ends to inclusive dates', () => {
    expect(parseTravelIcs(calendar('UID:zone\r\nDTSTART;TZID=Europe/London:20261101T120000\r\nSUMMARY:Gallery')).rows[0].time_zone).toBe('Europe/London');
    expect(parseTravelIcs(calendar('UID:days\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261104\r\nSUMMARY:Trip')).rows[0]).toMatchObject({ start_date: '2026-11-01', end_date: '2026-11-03', start_time: null });
  });
  it('rejects floating time, recurrence, cancellation, seconds and malformed calendars', () => {
    for (const extra of ['DTSTART:20261101T120000', 'DTSTART:20261101T120001Z', 'DTSTART:20261101T120000Z\r\nRRULE:FREQ=DAILY', 'DTSTART:20261101T120000Z\r\nSTATUS:CANCELLED']) {
      expect(parseTravelIcs(calendar(`UID:one\r\n${extra}`)).issues).toHaveLength(1);
    }
    expect(() => parseTravelIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT')).toThrow();
  });
  it('unfolds lines and ignores nested alarms', () => {
    const parsed = parseTravelIcs(calendar('UID:one\r\nDTSTART;VALUE=DATE:20261101\r\nSUMMARY:A long\r\n  title\r\nBEGIN:VALARM\r\nSUMMARY:Ignore me\r\nEND:VALARM'));
    expect(parsed.rows[0].title).toBe('A long title');
  });
});

describe('portable travel metadata', () => {
  it('round trips records and links with an honest separate-media manifest', () => {
    const original = backup(), exported = buildTravelBackup(original);
    expect(validateTravelBackup(exported)).toEqual({ version: 1, ...original });
    expect(JSON.parse(exported).media_manifest).toHaveLength(1);
    expect(JSON.parse(exported).media_note).toContain('Metadata only');
  });
  it('rejects broken relationships, foreign owners, bad photos and unsafe links', () => {
    const invalid = [
      (data: TravelJournal) => { data.trips = []; },
      (data: TravelJournal) => { data.visits[0].owner_id = tripId; },
      (data: TravelJournal) => { data.memories[0].photo_path = 'https://example.com/photo.jpg'; },
      (data: TravelJournal) => { data.memories[0].link_url = '//example.com'; },
      (data: TravelJournal) => { data.memories[0].link_url = 'javascript:alert(1)'; },
      (data: TravelJournal) => { data.memories[0].city_key = 'wrong'; },
    ];
    for (const mutate of invalid) { const data = backup(); mutate(data); expect(() => validateTravelBackup(buildTravelBackup(data))).toThrow(); }
  });
  it('accepts sort_order only within the database range', () => {
    const accepted = backup(); accepted.memories[0].sort_order = 1_000_000;
    expect(() => validateTravelBackup(buildTravelBackup(accepted))).not.toThrow();
    const rejected = backup(); rejected.memories[0].sort_order = -1;
    expect(() => validateTravelBackup(buildTravelBackup(rejected))).toThrow();
  });
  it('strips unrecognised fields and rejects unknown versions', () => {
    const data = JSON.parse(buildTravelBackup(backup())); data.trips[0].booking_secret = 'excluded';
    expect(JSON.stringify(validateTravelBackup(JSON.stringify(data)))).not.toContain('excluded');
    data.version = 2; expect(() => validateTravelBackup(JSON.stringify(data))).toThrow('version');
  });
});
