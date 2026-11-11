import type { TravelItinerary, TravelTrip, TravelVisit } from './journal-types';

type Timed = Pick<TravelItinerary, 'start_date' | 'start_time' | 'title'>;
const startKey = (item: Timed) => `${item.start_date ?? '9999-12-31'}T${item.start_time ?? '99:99'}`;

/** Earliest first by recorded local date, then time; undated items last, ties by title. */
export function compareItineraryStart(a: Timed, b: Timed): number {
  const left = startKey(a);
  const right = startKey(b);
  return left < right ? -1 : left > right ? 1 : a.title.localeCompare(b.title);
}

/** Summarises only recorded stays. Callers supply rows already filtered by RLS. */
export function citySummary(visits: readonly TravelVisit[], cityKey: string, trips?: readonly TravelTrip[]) {
  const tripStatus = trips && new Map(trips.map(trip => [trip.id, trip.status]));
  const seen = new Set<string>();
  let count = 0;
  let first: string | null = null;
  let last: string | null = null;

  for (const visit of visits) {
    if (visit.city_key !== cityKey || visit.status !== 'confirmed' || seen.has(visit.id)) continue;
    // A missing parent cannot establish a completed trip either. Unlinked,
    // manually confirmed stays remain valid even when no trips are recorded.
    if (visit.trip_id && tripStatus && tripStatus.get(visit.trip_id) !== 'completed') continue;
    seen.add(visit.id);
    count++;
    if (visit.start_date && (!first || visit.start_date < first)) first = visit.start_date;
    const latest = visit.end_date ?? visit.start_date;
    if (latest && (!last || latest > last)) last = latest;
  }
  return { count, first, last };
}
