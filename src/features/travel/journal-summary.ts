import type { TravelTrip, TravelVisit } from './journal-types';

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
