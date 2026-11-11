import { describe, expect, it } from 'vitest';
import { AIRPORT_CODES_BY_COUNTRY } from './airport-countries.data';
import { airportCountry, airportLookup, countryFlightRows, countryFlightSummary, groupByYear } from './journal-flights';
import type { TravelItinerary } from './journal-types';

// Synthetic codes only; the table under test is a made-up two-country one.
const airports = airportLookup({ AA: 'AAAAAB', BB: 'BBB' });
const flight = (id: string, changes: Partial<TravelItinerary> = {}): TravelItinerary => ({
  id, owner_id: 'owner', created_at: '', updated_at: '', is_public: false, trip_id: null, kind: 'flight',
  title: id, start_date: '2026-01-01', end_date: null, start_time: null, end_time: null, time_zone: null,
  arrival_time_zone: null, origin: 'AAA', destination: 'BBB', notes: '', source_key: null, source_name: null,
  status: 'completed', ...changes,
});

describe('airport lookup', () => {
  it('splits each country into three-letter codes and reads only a stored code, never a place name', () => {
    expect(airports.get('AAB')).toBe('AA');
    expect(airportCountry(' BBB ', airports)).toBe('BB');
    // A hand-typed place that happens to share an airport's letters is not that airport.
    expect(airportCountry('bbb', airports)).toBeNull();
    expect(airportCountry('Bbb', airports)).toBeNull();
    expect(airportCountry('Lisbon', airports)).toBeNull();
    expect(airportCountry('AAA', null)).toBeNull();
  });

  it('ships a generated table of well-formed codes', () => {
    const table = airportLookup(AIRPORT_CODES_BY_COUNTRY);
    expect(table.size).toBeGreaterThan(5000);
    // Closed airports keep their codes, since older flights still carry them.
    expect(table.get('TXL')).toBe('DE');
    expect(table.get('LHR')).toBe('GB');
    for (const [country, codes] of Object.entries(AIRPORT_CODES_BY_COUNTRY)) {
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(codes).toMatch(/^(?:[A-Z]{3})+$/);
    }
  });
});

describe('countryFlightSummary', () => {
  it('counts completed flights touching a country once each, ranks its airports, and dates them', () => {
    const summary = countryFlightSummary([
      flight('out', { start_date: '2024-05-01' }),
      flight('back', { origin: 'BBB', destination: 'AAB', start_date: '2025-02-01' }),
      flight('domestic', { origin: 'AAA', destination: 'AAB', start_date: '2023-09-09' }),
    ], 'AA', airports);
    expect(summary).toEqual({ flown: 3, planned: 0, airports: [{ code: 'AAA', count: 2 }, { code: 'AAB', count: 2 }], first: '2023-09-09', last: '2025-02-01' });
  });

  it('keeps planned flights apart, drops cancelled ones and anything that is not a flight', () => {
    const summary = countryFlightSummary([
      flight('planned', { status: 'planned', start_date: '2030-01-01' }),
      flight('cancelled', { status: 'cancelled' }),
      flight('train', { kind: 'train' }),
      flight('elsewhere', { origin: 'BBB', destination: 'ZZZ' }),
    ], 'AA', airports);
    expect(summary).toEqual({ flown: 0, planned: 1, airports: [{ code: 'AAA', count: 1 }], first: null, last: null });
  });

  it('ignores hand-typed places, even ones spelt like an airport code', () => {
    expect(countryFlightSummary([flight('typed', { origin: 'aaa', destination: 'Bbb' })], 'AA', airports).flown).toBe(0);
  });

  it('does not invent dates for undated flights', () => {
    expect(countryFlightSummary([flight('undated', { start_date: null })], 'BB', airports)).toMatchObject({ flown: 1, first: null, last: null });
  });
});

describe('countryFlightRows', () => {
  const summary = { flown: 4, planned: 1, first: '2016-03-02', last: '2019-07-01', airports: [
    { code: 'AAA', count: 3 }, { code: 'AAB', count: 1 }, { code: 'AAC', count: 1 }, { code: 'AAD', count: 1 }, { code: 'AAE', count: 1 },
  ] };

  it('shows counts, the three most used airports with the rest counted, and UK dates', () => {
    expect(countryFlightRows(summary)).toEqual([
      { label: 'Flights', value: '4 flown · 1 planned', tone: 'sky' },
      { label: 'Airports', value: 'AAA ×3, AAB, AAC, +2 more' },
      { label: 'First flight', value: '02/03/2016' },
      { label: 'Latest flight', value: '01/07/2019' },
    ]);
  });

  it('says one date once, leaves out dates it does not have, and shows nothing without flights', () => {
    expect(countryFlightRows({ ...summary, planned: 0, last: summary.first, airports: [{ code: 'AAA', count: 1 }] }).map(row => row.value))
      .toEqual(['4 flown', 'AAA', '02/03/2016']);
    expect(countryFlightRows({ ...summary, flown: 0, first: null, last: null }).map(row => row.label)).toEqual(['Flights', 'Airports']);
    expect(countryFlightRows({ flown: 0, planned: 0, airports: [], first: null, last: null })).toEqual([]);
  });
});

describe('groupByYear', () => {
  it('groups in the order given and puts undated items under their own heading', () => {
    const groups = groupByYear([flight('a', { start_date: '2016-01-01' }), flight('b', { start_date: '2016-12-31' }), flight('c', { start_date: '2018-03-01' }), flight('d', { start_date: null })]);
    expect(groups.map(group => [group.year, group.items.map(item => item.id)])).toEqual([['2016', ['a', 'b']], ['2018', ['c']], ['Undated', ['d']]]);
  });
});
