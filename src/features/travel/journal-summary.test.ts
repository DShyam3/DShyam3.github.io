import { describe, expect, it } from 'vitest';
import { citySummary, compareItineraryStart } from './journal-summary';
import type { TravelItinerary, TravelTrip, TravelVisit } from './journal-types';

const visit = (id: string, changes: Partial<TravelVisit> = {}): TravelVisit => ({
  id, owner_id: 'owner', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  is_public: false, trip_id: null, city_key: 'JP:35.0000,139.0000', country_code: 'JP', city_name: 'Tokyo',
  start_date: null, end_date: null, status: 'confirmed', notes: '', ...changes,
});
const trip = (id: string, status: TravelTrip['status']): TravelTrip => ({
  id, status, owner_id: 'owner', created_at: '', updated_at: '', is_public: false,
  title: id, start_date: null, end_date: null, notes: '',
});
const city = visit('a').city_key;

describe('citySummary', () => {
  it('counts confirmed stays, excluding planned visits, transit and other cities', () => {
    expect(citySummary([
      visit('a'), visit('b', { status: 'planned' }), visit('c', { status: 'transit' }),
      visit('d', { city_key: 'GB:51.0000,0.0000' }), visit('e'),
    ], city)).toEqual({ count: 2, first: null, last: null });
  });

  it('counts undated stays without inventing dates, and uses the departure for the latest date', () => {
    expect(citySummary([
      visit('a'), visit('b', { start_date: '2024-02-01', end_date: '2024-02-04' }),
      visit('c', { start_date: '2023-10-01' }),
    ], city)).toEqual({ count: 3, first: '2023-10-01', last: '2024-02-04' });
  });

  it('retains a known end date without inventing an arrival', () => {
    expect(citySummary([visit('a', { end_date: '2024-12-31' })], city))
      .toEqual({ count: 1, first: null, last: '2024-12-31' });
  });

  it('deduplicates the same visit ID', () => {
    const stay = visit('a', { start_date: '2024-01-01' });
    expect(citySummary([stay, stay], city)).toEqual({ count: 1, first: '2024-01-01', last: '2024-01-01' });
  });

  it('excludes planned, cancelled and unavailable linked trips when trip context is supplied', () => {
    expect(citySummary([
      visit('a', { trip_id: 'done' }), visit('b', { trip_id: 'planned' }),
      visit('c', { trip_id: 'cancelled' }), visit('d', { trip_id: 'missing' }), visit('e'),
    ], city, [trip('done', 'completed'), trip('planned', 'planned'), trip('cancelled', 'cancelled')]))
      .toEqual({ count: 2, first: null, last: null });
  });

  it('supports visit-only summaries and leaves visibility filtering to the data boundary', () => {
    expect(citySummary([visit('a', { trip_id: 'done' }), visit('b', { is_public: true })], city).count).toBe(2);
  });

  it('returns an empty summary when there are no recorded stays', () => {
    expect(citySummary([], city, [])).toEqual({ count: 0, first: null, last: null });
  });
});

describe('compareItineraryStart', () => {
  const item = (title: string, start_date: string | null, start_time: string | null = null) =>
    ({ title, start_date, start_time }) satisfies Pick<TravelItinerary, 'title' | 'start_date' | 'start_time'>;

  it('orders by date then time, earliest first, whatever the file order', () => {
    const rows = [item('Late', '2021-05-05', '21:00'), item('Same day early', '2021-05-05', '06:00'), item('Old', '2019-01-01', '12:00')];
    expect([...rows].sort(compareItineraryStart).map(row => row.title)).toEqual(['Old', 'Same day early', 'Late']);
  });

  it('puts untimed items after timed ones on the same day, undated items last, and ties by title', () => {
    const rows = [item('Undated', null), item('B all day', '2026-01-01'), item('A all day', '2026-01-01'), item('Morning', '2026-01-01', '09:00')];
    expect([...rows].sort(compareItineraryStart).map(row => row.title)).toEqual(['Morning', 'A all day', 'B all day', 'Undated']);
  });
});
