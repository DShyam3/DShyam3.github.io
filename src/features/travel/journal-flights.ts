import { useEffect, useState } from 'react';
import type { InspectorMetadataRow } from '@/contexts/WorkspaceInspectorContext';
import { formatDate } from '@/lib/format-date';
import type { TravelItinerary } from './journal-types';

/** IATA airport code -> ISO 3166-1 alpha-2 country code. */
export type AirportCountries = ReadonlyMap<string, string>;

/** Unpacks the generated table, where each country holds its codes run together, three letters each. */
export function airportLookup(codesByCountry: Readonly<Record<string, string>>): AirportCountries {
  const lookup = new Map<string, string>();
  for (const [country, codes] of Object.entries(codesByCountry)) {
    for (let index = 0; index + 3 <= codes.length; index += 3) lookup.set(codes.slice(index, index + 3), country);
  }
  return lookup;
}

let cached: AirportCountries | null = null;
let pending: Promise<AirportCountries> | null = null;

/** The table is ~30 KB, so it is fetched as its own chunk, once, and only when a flight or a country is open. */
export function loadAirportCountries(): Promise<AirportCountries> {
  if (cached) return Promise.resolve(cached);
  pending ??= import('./airport-countries.data')
    .then(module => (cached = airportLookup(module.AIRPORT_CODES_BY_COUNTRY)))
    .catch(error => { pending = null; throw error; });
  return pending;
}

/** The airport table once loaded; null while loading, or if it could not be. Country rows stay hidden until then. */
export function useAirportCountries(enabled: boolean): AirportCountries | null {
  const [lookup, setLookup] = useState<AirportCountries | null>(cached);
  useEffect(() => {
    if (!enabled || lookup) return;
    let live = true;
    loadAirportCountries().then(table => { if (live) setLookup(table); }).catch(() => undefined);
    return () => { live = false; };
  }, [enabled, lookup]);
  return lookup;
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en-GB'], { type: 'region' }) : null;

/** English country name for an ISO code, or the code itself where the runtime has no name for it. */
export function countryName(code: string): string {
  try { return regionNames?.of(code) ?? code; } catch { return code; }
}

/**
 * The airport's country, for an itinerary end stored as an airport code; null for anything else.
 * Only three capitals count: a place typed by hand ("Goa", "Ulm") is a name, not a code,
 * and folding its case would file it under whichever airport shares the letters.
 */
export function airportCountry(place: string | null, airports: AirportCountries | null): string | null {
  const code = place?.trim();
  return code && airports && /^[A-Z]{3}$/.test(code) ? airports.get(code) ?? null : null;
}

export interface CountryFlightSummary {
  /** Completed flights departing from or arriving in the country. A domestic flight counts once. */
  flown: number;
  /** Planned or unconfirmed flights, which are not counted as flown. */
  planned: number;
  /** Airports in the country, most used first, counting each departure and arrival there. */
  airports: { code: string; count: number }[];
  /** Earliest and latest departure date among completed flights. */
  first: string | null;
  last: string | null;
}

/** Flights touching a country, read from airport codes. Cancelled flights never count. */
export function countryFlightSummary(itinerary: TravelItinerary[], country: string, airports: AirportCountries): CountryFlightSummary {
  const uses = new Map<string, number>();
  let flown = 0, planned = 0, first: string | null = null, last: string | null = null;
  for (const item of itinerary) {
    if (item.kind !== 'flight' || item.status === 'cancelled') continue;
    const here = [item.origin, item.destination].filter(place => airportCountry(place, airports) === country);
    if (!here.length) continue;
    for (const place of here) { const code = place!.trim(); uses.set(code, (uses.get(code) ?? 0) + 1); }
    if (item.status === 'planned') { planned++; continue; }
    flown++;
    if (item.start_date && (!first || item.start_date < first)) first = item.start_date;
    if (item.start_date && (!last || item.start_date > last)) last = item.start_date;
  }
  const ranked = [...uses].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return { flown, planned, airports: ranked, first, last };
}

/** Readout rows for a country's inspector; none when no flight touches it. */
export function countryFlightRows(summary: CountryFlightSummary): InspectorMetadataRow[] {
  if (summary.flown + summary.planned === 0) return [];
  const shown = summary.airports.slice(0, 3).map(({ code, count }) => count > 1 ? `${code} ×${count}` : code);
  const more = summary.airports.length - shown.length;
  return [
    { label: 'Flights', value: `${summary.flown} flown${summary.planned ? ` · ${summary.planned} planned` : ''}`, tone: 'sky' },
    { label: 'Airports', value: `${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}` },
    ...(summary.first ? [{ label: 'First flight', value: formatDate(summary.first) }] : []),
    ...(summary.last && summary.last !== summary.first ? [{ label: 'Latest flight', value: formatDate(summary.last) }] : []),
  ];
}

/** Year groups in the order given, keeping each group's order; undated items under "Undated". */
export function groupByYear<T extends Pick<TravelItinerary, 'start_date'>>(items: T[]): { year: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const year = item.start_date?.slice(0, 4) ?? 'Undated';
    const group = groups.get(year);
    if (group) group.push(item); else groups.set(year, [item]);
  }
  return [...groups].map(([year, grouped]) => ({ year, items: grouped }));
}
