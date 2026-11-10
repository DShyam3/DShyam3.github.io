export const MIN_SORT_ORDER = 0;
export const MAX_SORT_ORDER = 1_000_000;

export interface JournalRow {
  id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

export interface TravelTrip extends JournalRow {
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: 'planned' | 'completed' | 'cancelled';
  notes: string;
}

export interface CityIdentity {
  country_code: string;
  city_key: string;
  city_name: string;
}

export interface TravelVisit extends JournalRow, CityIdentity {
  trip_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'confirmed' | 'planned' | 'transit';
  notes: string;
}

export interface TravelMemory extends JournalRow, CityIdentity {
  trip_id: string | null;
  visit_id: string | null;
  kind: 'note' | 'favourite' | 'photo';
  title: string;
  body: string;
  category: string;
  link_url: string | null;
  photo_path: string | null;
  is_cover: boolean;
  sort_order: number;
}

export interface TravelItinerary extends JournalRow {
  trip_id: string | null;
  kind: 'flight' | 'train' | 'stay' | 'activity';
  title: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  time_zone: string | null;
  arrival_time_zone: string | null;
  origin: string | null;
  destination: string | null;
  notes: string;
  source_key: string | null;
  source_name: string | null;
  status: 'planned' | 'completed' | 'cancelled';
}

export interface TravelJournal {
  trips: TravelTrip[];
  visits: TravelVisit[];
  memories: TravelMemory[];
  itinerary: TravelItinerary[];
}

export type JournalTable = 'trips' | 'visits' | 'memories' | 'itinerary';
export interface JournalRows {
  trips: TravelTrip;
  visits: TravelVisit;
  memories: TravelMemory;
  itinerary: TravelItinerary;
}
export type JournalDraft<T extends JournalRow> = Omit<T, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export const EMPTY_JOURNAL: TravelJournal = { trips: [], visits: [], memories: [], itinerary: [] };

/** Coordinates disambiguate cities sharing a name; no public legacy ID becomes a foreign key. */
export function cityIdentity(city: { country_code: string; city_name: string; lat: number; lon: number }): CityIdentity {
  return { country_code: city.country_code, city_name: city.city_name, city_key: `${city.country_code}:${city.lat.toFixed(4)},${city.lon.toFixed(4)}` };
}
